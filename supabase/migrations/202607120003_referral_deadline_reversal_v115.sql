-- WMCPLAYER V115 - PRAZO DE 10 DIAS, PREMIO +1 MES E REVERSAO AUTOMATICA
begin;

alter table public.referrals add column if not exists payment_deadline timestamptz null;
alter table public.referrals add column if not exists reward_reversed_at timestamptz null;
alter table public.referrals add column if not exists reward_reversal_reason text null;
alter table public.referrals add column if not exists reversal_count integer not null default 0;

update public.referrals
set payment_deadline = created_at + interval '10 days'
where payment_deadline is null;

alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals
  add constraint referrals_status_check
  check (status in ('pending','converted','rewarded','rejected','expired','approved'));

create or replace function public.wmc_set_referral_deadline()
returns trigger language plpgsql as $$
begin
  if new.payment_deadline is null then
    new.payment_deadline := coalesce(new.created_at, now()) + interval '10 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_referral_deadline on public.referrals;
create trigger trg_set_referral_deadline
before insert or update of created_at, payment_deadline on public.referrals
for each row execute function public.wmc_set_referral_deadline();

create or replace function public.refresh_my_referral_deadlines()
returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Não autorizado'; end if;
  update public.referrals
  set status='expired',
      notes=concat_ws(E'\n', nullif(notes,''), 'Não pago: prazo de 10 dias corridos encerrado.'),
      updated_at=now()
  where referrer_id=auth.uid()
    and status='pending'
    and coalesce(payment_deadline, created_at + interval '10 days') < now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.refresh_my_referral_deadlines() from public;
grant execute on function public.refresh_my_referral_deadlines() to authenticated, service_role;

create or replace function public.refresh_all_referral_deadlines()
returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if auth.uid() is not null and not public.wmc_is_admin(auth.uid()) then raise exception 'Apenas administradores'; end if;
  update public.referrals
  set status='expired',
      notes=concat_ws(E'\n', nullif(notes,''), 'Não pago: prazo de 10 dias corridos encerrado.'),
      updated_at=now()
  where status='pending'
    and coalesce(payment_deadline, created_at + interval '10 days') < now();
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.refresh_all_referral_deadlines() from public;
grant execute on function public.refresh_all_referral_deadlines() to authenticated, service_role;

create or replace function public.process_referral_first_payment(p_referred_id uuid, p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_referral public.referrals%rowtype;
  v_payment public.iptv_payments%rowtype;
  v_referrer public.profiles%rowtype;
  v_start date; v_end date; v_months integer; v_message text;
begin
  select * into v_payment from public.iptv_payments
  where id=p_payment_id and user_id=p_referred_id for update;
  if not found then return jsonb_build_object('success',false,'rewarded',false,'reason','payment_not_found'); end if;
  if v_payment.status not in ('paid_pending_activation','confirmed','paid') then
    return jsonb_build_object('success',false,'rewarded',false,'reason','payment_not_confirmed');
  end if;

  select * into v_referral from public.referrals where referred_id=p_referred_id limit 1 for update;
  if not found then return jsonb_build_object('success',true,'rewarded',false,'reason','no_referral'); end if;

  if v_referral.status='rewarded' or v_referral.rewarded_at is not null then
    return jsonb_build_object('success',true,'rewarded',false,'already_rewarded',true,
      'referral_id',v_referral.id,'referrer_id',v_referral.referrer_id,'referred_id',p_referred_id,
      'first_payment_id',v_referral.first_payment_id,'reward_months',v_referral.reward_months,
      'reward_period_start',v_referral.reward_period_start,'reward_period_end',v_referral.reward_period_end,
      'reward_message',v_referral.reward_message);
  end if;

  if coalesce(v_referral.payment_deadline, v_referral.created_at + interval '10 days') < coalesce(v_payment.payment_date,v_payment.created_at,now()) then
    update public.referrals set status='expired', first_payment_id=p_payment_id,
      notes=concat_ws(E'\n',nullif(notes,''),'Não pago: primeiro pagamento realizado após o prazo de 10 dias corridos.'), updated_at=now()
    where id=v_referral.id;
    return jsonb_build_object('success',true,'rewarded',false,'reason','deadline_expired','referral_id',v_referral.id);
  end if;

  if v_referral.status in ('rejected','expired') then
    return jsonb_build_object('success',true,'rewarded',false,'reason','referral_not_eligible');
  end if;

  if exists(select 1 from public.iptv_payments p where p.user_id=p_referred_id and p.id<>p_payment_id
    and p.status in ('paid_pending_activation','confirmed','paid')
    and coalesce(p.payment_date,p.created_at)<=coalesce(v_payment.payment_date,v_payment.created_at,now())) then
    update public.referrals set status='converted', converted_at=coalesce(converted_at,now()),
      first_payment_id=coalesce(first_payment_id,p_payment_id), updated_at=now() where id=v_referral.id;
    return jsonb_build_object('success',true,'rewarded',false,'reason','not_first_payment');
  end if;

  select * into v_referrer from public.profiles where id=v_referral.referrer_id for update;
  if not found then return jsonb_build_object('success',false,'rewarded',false,'reason','referrer_not_found'); end if;

  v_months:=greatest(1,coalesce(v_referral.reward_months,1));
  v_start:=coalesce(v_referrer.iptv_expiry,current_date);
  v_end:=public.wmc_add_months_fixed_day(v_start,v_months);
  v_message:=format('Seu indicado realizou o 1° pagamento e você ganhou o próximo período de %s a %s gratuitamente! Obrigado por apoiar esse projeto!',to_char(v_start,'DD/MM/YYYY'),to_char(v_end,'DD/MM/YYYY'));

  update public.profiles set iptv_expiry=v_end where id=v_referral.referrer_id;
  update public.referrals set status='rewarded', converted_at=coalesce(converted_at,now()), rewarded_at=now(),
    first_payment_id=p_payment_id,reward_period_start=v_start,reward_period_end=v_end,reward_message=v_message,
    reward_reversed_at=null,reward_reversal_reason=null,
    notes=concat_ws(E'\n',nullif(notes,''),format('Benefício automático gerado pelo pagamento %s. Ativação no servidor deve ser conferida pelo administrador.',p_payment_id)),updated_at=now()
  where id=v_referral.id;
  insert into public.balance_history(user_id,amount,type,description) values(v_referral.referrer_id,0,'referral',v_message);
  begin
    insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
    select ur.user_id,'referral_reward_requires_server_activation','referrals',v_referral.id,
      jsonb_build_object('referrer_id',v_referral.referrer_id,'referred_id',p_referred_id,'payment_id',p_payment_id,'new_expiry',v_end,'message','Prêmio de indicação liberado. Atualize a validade no servidor da TV.')
    from public.user_roles ur where ur.role='admin' limit 1;
  exception when others then null; end;

  return jsonb_build_object('success',true,'rewarded',true,'referral_id',v_referral.id,'referrer_id',v_referral.referrer_id,
    'referred_id',p_referred_id,'first_payment_id',p_payment_id,'reward_months',v_months,
    'reward_period_start',v_start,'reward_period_end',v_end,'new_expiry',v_end,'reward_message',v_message);
end; $$;
revoke all on function public.process_referral_first_payment(uuid,uuid) from public;
grant execute on function public.process_referral_first_payment(uuid,uuid) to service_role;

create or replace function public.reverse_referral_reward_by_payment(p_payment_id uuid,p_reason text default 'Pagamento revertido, removido ou não pago')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_ref public.referrals%rowtype; v_profile public.profiles%rowtype; v_new_expiry date; v_new_status text;
begin
  select * into v_ref from public.referrals where first_payment_id=p_payment_id limit 1 for update;
  if not found or v_ref.rewarded_at is null then return jsonb_build_object('success',true,'reversed',false,'reason','no_active_reward'); end if;
  select * into v_profile from public.profiles where id=v_ref.referrer_id for update;
  v_new_expiry := (coalesce(v_profile.iptv_expiry,current_date)::timestamp - make_interval(months=>greatest(1,coalesce(v_ref.reward_months,1))))::date;
  v_new_status := case when coalesce(v_ref.payment_deadline,v_ref.created_at+interval '10 days') >= now() then 'pending' else 'expired' end;
  update public.profiles set iptv_expiry=v_new_expiry where id=v_ref.referrer_id;
  update public.referrals set status=v_new_status,converted_at=null,rewarded_at=null,first_payment_id=null,
    reward_period_start=null,reward_period_end=null,reward_message=null,reward_reversed_at=now(),
    reward_reversal_reason=p_reason,reversal_count=coalesce(reversal_count,0)+1,
    notes=concat_ws(E'\n',nullif(notes,''),format('Benefício revertido: %s. Nova validade do indicador: %s.',p_reason,to_char(v_new_expiry,'DD/MM/YYYY'))),updated_at=now()
  where id=v_ref.id;
  insert into public.balance_history(user_id,amount,type,description)
  values(v_ref.referrer_id,0,'referral_reversal',format('Mês grátis de indicação revertido. %s',p_reason));
  begin
    insert into public.admin_audit_logs(admin_id,action,target_table,target_id,details)
    select ur.user_id,'referral_reward_reversed','referrals',v_ref.id,jsonb_build_object('referrer_id',v_ref.referrer_id,'payment_id',p_payment_id,'new_expiry',v_new_expiry,'status',v_new_status,'reason',p_reason)
    from public.user_roles ur where ur.role='admin' limit 1;
  exception when others then null; end;
  return jsonb_build_object('success',true,'reversed',true,'referral_id',v_ref.id,'referrer_id',v_ref.referrer_id,'new_expiry',v_new_expiry,'new_status',v_new_status);
end; $$;
revoke all on function public.reverse_referral_reward_by_payment(uuid,text) from public;
grant execute on function public.reverse_referral_reward_by_payment(uuid,text) to service_role;

create or replace function public.wmc_referral_payment_reversal_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    perform public.reverse_referral_reward_by_payment(old.id,'Pagamento excluído');
    return old;
  end if;
  if old.status in ('paid_pending_activation','confirmed','paid') and new.status not in ('paid_pending_activation','confirmed','paid') then
    perform public.reverse_referral_reward_by_payment(new.id,format('Pagamento alterado de %s para %s',old.status,new.status));
  end if;
  return new;
end; $$;

drop trigger if exists trg_referral_payment_reversal on public.iptv_payments;
create trigger trg_referral_payment_reversal
after update of status or delete on public.iptv_payments
for each row execute function public.wmc_referral_payment_reversal_trigger();

commit;

begin;
create or replace function public.get_my_referral_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_rows jsonb;
begin
  if v_user_id is null then raise exception 'Não autorizado'; end if;
  perform public.refresh_my_referral_deadlines();
  select jsonb_build_object('is_active',coalesce(s.is_active,true),'default_reward_months',coalesce(s.default_reward_months,1),'updated_at',s.updated_at)
  into v_settings from public.referral_settings s where s.id=1;
  select coalesce(jsonb_agg(item order by (item->>'created_at')::timestamptz desc),'[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'id',r.id,'referrer_id',r.referrer_id,'referred_id',r.referred_id,'status',r.status,
      'reward_type',r.reward_type,'reward_months',r.reward_months,'reward_amount',r.reward_amount,
      'first_payment_id',r.first_payment_id,'converted_at',r.converted_at,'rewarded_at',r.rewarded_at,
      'reward_period_start',r.reward_period_start,'reward_period_end',r.reward_period_end,
      'reward_message',r.reward_message,'notes',r.notes,'created_at',r.created_at,'updated_at',r.updated_at,
      'payment_deadline',coalesce(r.payment_deadline,r.created_at+interval '10 days'),
      'reward_reversed_at',r.reward_reversed_at,'reward_reversal_reason',r.reward_reversal_reason,
      'referred_name',p.name,'referred_username',p.username,'referred_iptv_user',p.iptv_user
    ) item
    from public.referrals r join public.profiles p on p.id=r.referred_id
    where r.referrer_id=v_user_id
  ) q;
  return jsonb_build_object('settings',coalesce(v_settings,jsonb_build_object('is_active',true,'default_reward_months',1)),'referrals',coalesce(v_rows,'[]'::jsonb));
end; $$;
revoke all on function public.get_my_referral_dashboard() from public;
grant execute on function public.get_my_referral_dashboard() to authenticated,service_role;
commit;
