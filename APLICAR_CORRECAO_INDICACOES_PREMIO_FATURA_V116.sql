-- WMCPLAYER V116
-- CORRIGE PREMIO DE INDICACAO, FATURA PAGA COMO PREMIO, ALERTA FIXO NO ADMIN TV
-- E BLOQUEIO DA PROMOCAO PARA USUARIOS QUE NAO ESTAO ATIVOS.

begin;

alter table public.referrals add column if not exists reward_payment_id uuid null;
alter table public.referrals add column if not exists reward_payment_was_created boolean not null default false;
alter table public.referrals add column if not exists reward_payment_previous jsonb null;
alter table public.referrals add column if not exists server_activation_required boolean not null default false;
alter table public.referrals add column if not exists server_activation_action text null;
alter table public.referrals add column if not exists server_activation_target_expiry date null;
alter table public.referrals add column if not exists server_activation_completed_at timestamptz null;
alter table public.referrals add column if not exists server_activation_completed_by uuid null;

alter table public.referrals drop constraint if exists referrals_server_activation_action_check;
alter table public.referrals
  add constraint referrals_server_activation_action_check
  check (server_activation_action is null or server_activation_action in ('extend','revert'));

create index if not exists referrals_server_activation_pending_idx
  on public.referrals (server_activation_required, updated_at desc)
  where server_activation_required = true;

-- Um codigo somente pode valer quando o dono esta realmente ativo e fora do teste gratis.
create or replace function public.resolve_referral_code(
  p_referral_code text,
  p_referred_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_referrer public.profiles%rowtype;
  v_settings public.referral_settings%rowtype;
  v_existing public.referrals%rowtype;
begin
  select * into v_settings from public.referral_settings where id = 1;

  if coalesce(v_settings.is_active, true) = false then
    return jsonb_build_object('valid', false, 'promotion_active', false, 'error', 'Promocao encerrada.');
  end if;

  if v_code = '' then
    return jsonb_build_object('valid', false, 'promotion_active', true, 'error', 'Informe o codigo de indicacao.');
  end if;

  select * into v_referrer
  from public.profiles
  where upper(trim(referral_code)) = v_code
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'promotion_active', true, 'error', 'Codigo de indicacao nao encontrado.');
  end if;

  if lower(coalesce(v_referrer.status, '')) <> 'active'
     or lower(coalesce(v_referrer.iptv_status, '')) <> 'active'
     or coalesce(v_referrer.trial_enabled, false) = true then
    return jsonb_build_object(
      'valid', false,
      'promotion_active', true,
      'error', 'Este codigo nao esta disponivel porque o indicador nao possui uma assinatura ativa.'
    );
  end if;

  if p_referred_user_id is not null and v_referrer.id = p_referred_user_id then
    return jsonb_build_object('valid', false, 'promotion_active', true, 'error', 'Voce nao pode indicar a si mesmo.');
  end if;

  if p_referred_user_id is not null then
    select * into v_existing
    from public.referrals
    where referred_id = p_referred_user_id
    limit 1;

    if found then
      return jsonb_build_object(
        'valid', false,
        'promotion_active', true,
        'error', 'Este cliente ja possui uma indicacao vinculada.',
        'existing_referral_id', v_existing.id,
        'referrer_id', v_existing.referrer_id
      );
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'promotion_active', true,
    'referrer_id', v_referrer.id,
    'referrer_name', v_referrer.name,
    'referrer_username', v_referrer.username,
    'referral_code', v_referrer.referral_code,
    'reward_months', coalesce(v_settings.default_reward_months, 1)
  );
end;
$$;

revoke all on function public.resolve_referral_code(text, uuid) from public;
grant execute on function public.resolve_referral_code(text, uuid) to authenticated, service_role;

-- Cria uma fatura paga como PREMIO ou aproveita uma fatura pendente sem PIX ativo.
create or replace function public.wmc_apply_referral_reward_invoice(
  p_referral_id uuid,
  p_referrer_id uuid,
  p_period_start date,
  p_period_end date,
  p_months integer,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_referral public.referrals%rowtype;
  v_payment public.iptv_payments%rowtype;
  v_payment_id uuid;
  v_created boolean := false;
  v_previous jsonb := null;
begin
  select * into v_existing_referral
  from public.referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'Indicacao nao encontrada.';
  end if;

  if v_existing_referral.reward_payment_id is not null then
    select * into v_payment
    from public.iptv_payments
    where id = v_existing_referral.reward_payment_id;

    if found and v_payment.status = 'confirmed' and v_payment.payment_method = 'referral_reward' then
      return jsonb_build_object(
        'payment_id', v_payment.id,
        'created', coalesce(v_existing_referral.reward_payment_was_created, false),
        'payment', to_jsonb(v_payment)
      );
    end if;
  end if;

  -- Somente reaproveita fatura pendente que ainda nao possui cobranca PIX ativa.
  select * into v_payment
  from public.iptv_payments
  where user_id = p_referrer_id
    and status = 'pending'
    and coalesce(payment_method, '') <> 'referral_reward'
    and pix_txid is null
  order by
    case when period_start = p_period_start then 0 else 1 end,
    case when period_end >= p_period_start then 0 else 1 end,
    created_at asc
  limit 1
  for update;

  if found then
    v_payment_id := v_payment.id;
    v_created := false;
    v_previous := to_jsonb(v_payment);

    update public.iptv_payments
    set amount = 0,
        months = greatest(1, p_months),
        period_start = p_period_start,
        period_end = p_period_end,
        status = 'confirmed',
        payment_method = 'referral_reward',
        payment_date = now(),
        pix_copia_cola = null,
        pix_location = null,
        pix_txid = null,
        notes = concat_ws(E'\n', nullif(notes, ''), 'Fatura quitada com premio de indicacao.', p_message)
    where id = v_payment_id;
  else
    insert into public.iptv_payments (
      user_id,
      amount,
      months,
      period_start,
      period_end,
      status,
      payment_method,
      payment_date,
      notes
    ) values (
      p_referrer_id,
      0,
      greatest(1, p_months),
      p_period_start,
      p_period_end,
      'confirmed',
      'referral_reward',
      now(),
      concat('Premio de indicacao. ', p_message)
    )
    returning id into v_payment_id;

    v_created := true;
  end if;

  update public.referrals
  set reward_payment_id = v_payment_id,
      reward_payment_was_created = v_created,
      reward_payment_previous = v_previous,
      updated_at = now()
  where id = p_referral_id;

  select * into v_payment from public.iptv_payments where id = v_payment_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'created', v_created,
    'payment', to_jsonb(v_payment)
  );
end;
$$;

revoke all on function public.wmc_apply_referral_reward_invoice(uuid, uuid, date, date, integer, text) from public;
grant execute on function public.wmc_apply_referral_reward_invoice(uuid, uuid, date, date, integer, text) to service_role;

-- O pagamento elegivel e o primeiro pagamento APOS a indicacao, nao o primeiro pagamento da vida do cliente.
create or replace function public.process_referral_first_payment(p_referred_id uuid, p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_payment public.iptv_payments%rowtype;
  v_referrer public.profiles%rowtype;
  v_paid_at timestamptz;
  v_start date;
  v_end date;
  v_months integer;
  v_message text;
  v_invoice jsonb;
  v_new_iptv_status text;
begin
  select * into v_payment
  from public.iptv_payments
  where id = p_payment_id
    and user_id = p_referred_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'rewarded', false, 'reason', 'payment_not_found');
  end if;

  if v_payment.status not in ('paid_pending_activation', 'confirmed', 'paid') then
    return jsonb_build_object('success', false, 'rewarded', false, 'reason', 'payment_not_confirmed');
  end if;

  if coalesce(v_payment.payment_method, '') = 'referral_reward' then
    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'reward_invoice_ignored');
  end if;

  select * into v_referral
  from public.referrals
  where referred_id = p_referred_id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'no_referral');
  end if;

  if v_referral.status = 'rewarded' or v_referral.rewarded_at is not null then
    return jsonb_build_object(
      'success', true,
      'rewarded', false,
      'already_rewarded', true,
      'referral_id', v_referral.id,
      'referrer_id', v_referral.referrer_id,
      'referred_id', p_referred_id,
      'first_payment_id', v_referral.first_payment_id,
      'reward_payment_id', v_referral.reward_payment_id,
      'reward_months', v_referral.reward_months,
      'reward_period_start', v_referral.reward_period_start,
      'reward_period_end', v_referral.reward_period_end,
      'new_expiry', v_referral.reward_period_end,
      'reward_message', v_referral.reward_message
    );
  end if;

  v_paid_at := coalesce(v_payment.payment_date, v_payment.created_at, now());

  if v_paid_at < v_referral.created_at then
    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'payment_before_referral');
  end if;

  if coalesce(v_referral.payment_deadline, v_referral.created_at + interval '10 days') < v_paid_at then
    update public.referrals
    set status = 'expired',
        first_payment_id = p_payment_id,
        notes = concat_ws(E'\n', nullif(notes, ''), 'Nao pago: pagamento realizado depois do prazo de 10 dias corridos.'),
        updated_at = now()
    where id = v_referral.id;

    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'deadline_expired', 'referral_id', v_referral.id);
  end if;

  if v_referral.status in ('rejected', 'expired') then
    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'referral_not_eligible');
  end if;

  select * into v_referrer
  from public.profiles
  where id = v_referral.referrer_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'rewarded', false, 'reason', 'referrer_not_found');
  end if;

  v_months := greatest(1, coalesce(v_referral.reward_months, 1));
  v_start := coalesce(v_referrer.iptv_expiry, current_date);
  v_end := public.wmc_add_months_fixed_day(v_start, v_months);
  v_message := format(
    'Parabéns! Seu indicado realizou o 1° pagamento e você ganhou o próximo período de %s a %s gratuitamente! Obrigado por apoiar esse projeto!',
    to_char(v_start, 'DD/MM/YYYY'),
    to_char(v_end, 'DD/MM/YYYY')
  );

  v_new_iptv_status := case
    when lower(coalesce(v_referrer.iptv_status, '')) in ('disabled', 'maintenance', 'unstable') then v_referrer.iptv_status
    else 'active'
  end;

  update public.profiles
  set iptv_expiry = v_end,
      iptv_status = v_new_iptv_status
  where id = v_referral.referrer_id;

  update public.referrals
  set status = 'rewarded',
      converted_at = coalesce(converted_at, now()),
      rewarded_at = now(),
      first_payment_id = p_payment_id,
      reward_period_start = v_start,
      reward_period_end = v_end,
      reward_message = v_message,
      reward_reversed_at = null,
      reward_reversal_reason = null,
      server_activation_required = true,
      server_activation_action = 'extend',
      server_activation_target_expiry = v_end,
      server_activation_completed_at = null,
      server_activation_completed_by = null,
      notes = concat_ws(E'\n', nullif(notes, ''), format('Premio gerado pelo pagamento %s. Atualizar a validade no servidor da TV.', p_payment_id)),
      updated_at = now()
  where id = v_referral.id;

  v_invoice := public.wmc_apply_referral_reward_invoice(
    v_referral.id,
    v_referral.referrer_id,
    v_start,
    v_end,
    v_months,
    v_message
  );

  insert into public.balance_history (user_id, amount, type, description)
  values (v_referral.referrer_id, 0, 'referral', v_message);

  begin
    insert into public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    select ur.user_id,
           'referral_reward_requires_server_activation',
           'referrals',
           v_referral.id,
           jsonb_build_object(
             'referrer_id', v_referral.referrer_id,
             'referred_id', p_referred_id,
             'payment_id', p_payment_id,
             'reward_payment_id', v_invoice ->> 'payment_id',
             'new_expiry', v_end,
             'message', 'Premio de indicacao liberado. Atualize a validade no servidor da TV.'
           )
    from public.user_roles ur
    where ur.role = 'admin'
    limit 1;
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'success', true,
    'rewarded', true,
    'referral_id', v_referral.id,
    'referrer_id', v_referral.referrer_id,
    'referred_id', p_referred_id,
    'first_payment_id', p_payment_id,
    'reward_payment_id', v_invoice ->> 'payment_id',
    'reward_payment', v_invoice -> 'payment',
    'reward_months', v_months,
    'reward_period_start', v_start,
    'reward_period_end', v_end,
    'new_expiry', v_end,
    'new_iptv_status', v_new_iptv_status,
    'reward_message', v_message,
    'server_activation_required', true
  );
end;
$$;

revoke all on function public.process_referral_first_payment(uuid, uuid) from public;
grant execute on function public.process_referral_first_payment(uuid, uuid) to service_role;

create or replace function public.reverse_referral_reward_by_payment(
  p_payment_id uuid,
  p_reason text default 'Pagamento revertido, removido ou nao pago'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals%rowtype;
  v_profile public.profiles%rowtype;
  v_new_expiry date;
  v_new_status text;
  v_previous jsonb;
  v_restored_payment_status text;
begin
  select * into v_ref
  from public.referrals
  where first_payment_id = p_payment_id
  limit 1
  for update;

  if not found or v_ref.rewarded_at is null then
    return jsonb_build_object('success', true, 'reversed', false, 'reason', 'no_active_reward');
  end if;

  select * into v_profile
  from public.profiles
  where id = v_ref.referrer_id
  for update;

  v_new_expiry := (
    coalesce(v_profile.iptv_expiry, current_date)::timestamp
    - make_interval(months => greatest(1, coalesce(v_ref.reward_months, 1)))
  )::date;

  v_new_status := case
    when coalesce(v_ref.payment_deadline, v_ref.created_at + interval '10 days') >= now() then 'pending'
    else 'expired'
  end;

  if v_ref.reward_payment_id is not null then
    if coalesce(v_ref.reward_payment_was_created, false) then
      update public.iptv_payments
      set status = 'reversed',
          notes = concat_ws(E'\n', nullif(notes, ''), concat('Premio revertido: ', p_reason))
      where id = v_ref.reward_payment_id;
    elsif v_ref.reward_payment_previous is not null then
      v_previous := v_ref.reward_payment_previous;
      v_restored_payment_status := coalesce(v_previous ->> 'status', 'pending');

      update public.iptv_payments
      set amount = coalesce((v_previous ->> 'amount')::numeric, amount),
          months = coalesce((v_previous ->> 'months')::integer, months),
          period_start = coalesce(nullif(v_previous ->> 'period_start', '')::date, period_start),
          period_end = coalesce(nullif(v_previous ->> 'period_end', '')::date, period_end),
          status = v_restored_payment_status,
          payment_method = coalesce(nullif(v_previous ->> 'payment_method', ''), payment_method),
          payment_date = coalesce(nullif(v_previous ->> 'payment_date', '')::timestamptz, payment_date),
          pix_copia_cola = v_previous ->> 'pix_copia_cola',
          pix_location = v_previous ->> 'pix_location',
          pix_txid = v_previous ->> 'pix_txid',
          notes = v_previous ->> 'notes'
      where id = v_ref.reward_payment_id;
    end if;
  end if;

  update public.profiles
  set iptv_expiry = v_new_expiry,
      iptv_status = case
        when lower(coalesce(iptv_status, '')) in ('disabled', 'maintenance', 'unstable') then iptv_status
        when v_new_expiry < current_date then 'blocked'
        else 'active'
      end
  where id = v_ref.referrer_id;

  update public.referrals
  set status = v_new_status,
      converted_at = null,
      rewarded_at = null,
      first_payment_id = null,
      reward_period_start = null,
      reward_period_end = null,
      reward_message = null,
      reward_reversed_at = now(),
      reward_reversal_reason = p_reason,
      reversal_count = coalesce(reversal_count, 0) + 1,
      reward_payment_id = null,
      reward_payment_was_created = false,
      reward_payment_previous = null,
      server_activation_required = true,
      server_activation_action = 'revert',
      server_activation_target_expiry = v_new_expiry,
      server_activation_completed_at = null,
      server_activation_completed_by = null,
      notes = concat_ws(E'\n', nullif(notes, ''), format('Beneficio revertido: %s. Nova validade: %s.', p_reason, to_char(v_new_expiry, 'DD/MM/YYYY'))),
      updated_at = now()
  where id = v_ref.id;

  insert into public.balance_history (user_id, amount, type, description)
  values (v_ref.referrer_id, 0, 'referral_reversal', format('Mes gratis de indicacao revertido. %s', p_reason));

  begin
    insert into public.admin_audit_logs (admin_id, action, target_table, target_id, details)
    select ur.user_id,
           'referral_reward_reversed',
           'referrals',
           v_ref.id,
           jsonb_build_object(
             'referrer_id', v_ref.referrer_id,
             'payment_id', p_payment_id,
             'new_expiry', v_new_expiry,
             'status', v_new_status,
             'reason', p_reason,
             'server_action', 'revert'
           )
    from public.user_roles ur
    where ur.role = 'admin'
    limit 1;
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'success', true,
    'reversed', true,
    'referral_id', v_ref.id,
    'referrer_id', v_ref.referrer_id,
    'new_expiry', v_new_expiry,
    'new_status', v_new_status,
    'server_activation_required', true,
    'server_activation_action', 'revert'
  );
end;
$$;

revoke all on function public.reverse_referral_reward_by_payment(uuid, text) from public;
grant execute on function public.reverse_referral_reward_by_payment(uuid, text) to service_role;

-- Processa automaticamente quando um pagamento real muda para pago.
create or replace function public.wmc_referral_payment_reward_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('paid_pending_activation', 'confirmed', 'paid')
     or coalesce(new.payment_method, '') = 'referral_reward' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.process_referral_first_payment(new.user_id, new.id);
  elsif old.status not in ('paid_pending_activation', 'confirmed', 'paid')
        or old.payment_date is distinct from new.payment_date then
    perform public.process_referral_first_payment(new.user_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_referral_payment_reward on public.iptv_payments;
create trigger trg_referral_payment_reward
after insert or update of status, payment_date on public.iptv_payments
for each row execute function public.wmc_referral_payment_reward_trigger();

-- A reversao precisa acontecer ANTES da exclusao, pois o pagamento ainda deve existir para localizar a indicacao.
drop trigger if exists trg_referral_payment_reversal on public.iptv_payments;
drop trigger if exists trg_referral_payment_reversal_update on public.iptv_payments;
drop trigger if exists trg_referral_payment_reversal_delete on public.iptv_payments;

create or replace function public.wmc_referral_payment_reversal_update_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('paid_pending_activation', 'confirmed', 'paid')
     and new.status not in ('paid_pending_activation', 'confirmed', 'paid')
     and coalesce(old.payment_method, '') <> 'referral_reward' then
    perform public.reverse_referral_reward_by_payment(new.id, format('Pagamento alterado de %s para %s', old.status, new.status));
  end if;
  return new;
end;
$$;

create trigger trg_referral_payment_reversal_update
after update of status on public.iptv_payments
for each row execute function public.wmc_referral_payment_reversal_update_trigger();

create or replace function public.wmc_referral_payment_reversal_delete_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('paid_pending_activation', 'confirmed', 'paid')
     and coalesce(old.payment_method, '') <> 'referral_reward' then
    perform public.reverse_referral_reward_by_payment(old.id, 'Pagamento excluido');
  end if;
  return old;
end;
$$;

create trigger trg_referral_payment_reversal_delete
before delete on public.iptv_payments
for each row execute function public.wmc_referral_payment_reversal_delete_trigger();

-- Repara indicacoes que ficaram como CONVERTIDAS sem premio em versoes anteriores.
create or replace function public.repair_referral_rewards_v116(p_referrer_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref record;
  v_payment record;
  v_result jsonb;
  v_count integer := 0;
begin
  if auth.uid() is not null
     and not public.wmc_is_admin(auth.uid())
     and coalesce(p_referrer_id, auth.uid()) <> auth.uid() then
    raise exception 'Nao autorizado';
  end if;

  for v_ref in
    select r.*
    from public.referrals r
    where r.rewarded_at is null
      and r.status in ('pending', 'converted', 'approved')
      and (p_referrer_id is null or r.referrer_id = p_referrer_id)
    order by r.created_at asc
  loop
    select p.* into v_payment
    from public.iptv_payments p
    where p.user_id = v_ref.referred_id
      and p.status in ('paid_pending_activation', 'confirmed', 'paid')
      and coalesce(p.payment_method, '') <> 'referral_reward'
      and coalesce(p.payment_date, p.created_at) >= v_ref.created_at
      and coalesce(p.payment_date, p.created_at) <= coalesce(v_ref.payment_deadline, v_ref.created_at + interval '10 days')
    order by coalesce(p.payment_date, p.created_at) asc
    limit 1;

    if found then
      v_result := public.process_referral_first_payment(v_ref.referred_id, v_payment.id);
      if coalesce((v_result ->> 'rewarded')::boolean, false) then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.repair_referral_rewards_v116(uuid) from public;
grant execute on function public.repair_referral_rewards_v116(uuid) to authenticated, service_role;

-- Fila fixa do Admin > TV para atualizar a validade no servidor externo.
create or replace function public.get_pending_referral_server_activations()
returns table (
  referral_id uuid,
  referrer_id uuid,
  referrer_name text,
  referrer_username text,
  referrer_iptv_user text,
  referrer_server text,
  referred_id uuid,
  referred_name text,
  action text,
  target_expiry date,
  reward_period_start date,
  reward_period_end date,
  reward_months integer,
  reward_message text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.wmc_is_admin(auth.uid()) then
    raise exception 'Apenas administradores';
  end if;

  return query
  select
    r.id,
    r.referrer_id,
    referrer.name,
    referrer.username,
    referrer.iptv_user,
    referrer.iptv_server,
    r.referred_id,
    referred.name,
    coalesce(r.server_activation_action, 'extend'),
    r.server_activation_target_expiry,
    r.reward_period_start,
    r.reward_period_end,
    greatest(1, coalesce(r.reward_months, 1)),
    r.reward_message,
    r.updated_at
  from public.referrals r
  join public.profiles referrer on referrer.id = r.referrer_id
  join public.profiles referred on referred.id = r.referred_id
  where r.server_activation_required = true
  order by r.updated_at asc;
end;
$$;

revoke all on function public.get_pending_referral_server_activations() from public;
grant execute on function public.get_pending_referral_server_activations() to authenticated, service_role;

create or replace function public.complete_referral_server_activation(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.referrals%rowtype;
begin
  if auth.uid() is not null and not public.wmc_is_admin(auth.uid()) then
    raise exception 'Apenas administradores';
  end if;

  update public.referrals
  set server_activation_required = false,
      server_activation_completed_at = now(),
      server_activation_completed_by = auth.uid(),
      updated_at = now()
  where id = p_referral_id
  returning * into v_row;

  if not found then
    raise exception 'Aviso de ativacao nao encontrado.';
  end if;

  return jsonb_build_object(
    'success', true,
    'referral_id', v_row.id,
    'referrer_id', v_row.referrer_id,
    'action', v_row.server_activation_action,
    'target_expiry', v_row.server_activation_target_expiry
  );
end;
$$;

revoke all on function public.complete_referral_server_activation(uuid) from public;
grant execute on function public.complete_referral_server_activation(uuid) to authenticated, service_role;

-- Dashboard do cliente: bloqueia a promocao para teste, bloqueado, aguardando ou desativado.
create or replace function public.get_my_referral_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_settings jsonb;
  v_rows jsonb;
  v_access_allowed boolean;
  v_access_message text;
begin
  if v_user_id is null then
    raise exception 'Nao autorizado';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    raise exception 'Perfil nao encontrado';
  end if;

  v_access_allowed := lower(coalesce(v_profile.status, '')) = 'active'
                      and lower(coalesce(v_profile.iptv_status, '')) = 'active'
                      and coalesce(v_profile.trial_enabled, false) = false;

  if coalesce(v_profile.trial_enabled, false) = true then
    v_access_message := 'A promocao Indique e ganhe nao esta disponivel durante o teste gratis. Ative seu plano para participar.';
  elsif lower(coalesce(v_profile.status, '')) <> 'active' then
    v_access_message := 'A promocao Indique e ganhe esta disponivel somente para usuarios ativos.';
  elsif lower(coalesce(v_profile.iptv_status, '')) <> 'active' then
    v_access_message := 'Regularize ou ative sua assinatura para acessar a promocao Indique e ganhe.';
  else
    v_access_message := '';
  end if;

  perform public.refresh_my_referral_deadlines();
  perform public.repair_referral_rewards_v116(v_user_id);

  select jsonb_build_object(
    'is_active', coalesce(s.is_active, true),
    'default_reward_months', coalesce(s.default_reward_months, 1),
    'updated_at', s.updated_at
  )
  into v_settings
  from public.referral_settings s
  where s.id = 1;

  select coalesce(jsonb_agg(item order by (item ->> 'created_at')::timestamptz desc), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', r.id,
      'referrer_id', r.referrer_id,
      'referred_id', r.referred_id,
      'status', r.status,
      'reward_type', r.reward_type,
      'reward_months', r.reward_months,
      'reward_amount', r.reward_amount,
      'first_payment_id', r.first_payment_id,
      'reward_payment_id', r.reward_payment_id,
      'converted_at', r.converted_at,
      'rewarded_at', r.rewarded_at,
      'reward_period_start', r.reward_period_start,
      'reward_period_end', r.reward_period_end,
      'reward_message', r.reward_message,
      'notes', r.notes,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'payment_deadline', coalesce(r.payment_deadline, r.created_at + interval '10 days'),
      'reward_reversed_at', r.reward_reversed_at,
      'reward_reversal_reason', r.reward_reversal_reason,
      'server_activation_required', r.server_activation_required,
      'referred_name', p.name,
      'referred_username', p.username,
      'referred_iptv_user', p.iptv_user
    ) item
    from public.referrals r
    join public.profiles p on p.id = r.referred_id
    where r.referrer_id = v_user_id
  ) q;

  return jsonb_build_object(
    'settings', coalesce(v_settings, jsonb_build_object('is_active', true, 'default_reward_months', 1)),
    'access', jsonb_build_object('allowed', v_access_allowed, 'message', v_access_message),
    'referrals', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_referral_dashboard() from public;
grant execute on function public.get_my_referral_dashboard() to authenticated, service_role;

-- Recria a fatura de premio e o aviso fixo para recompensas antigas que ja estavam liberadas.
do $$
declare
  v_ref record;
begin
  for v_ref in
    select r.*
    from public.referrals r
    where r.rewarded_at is not null
      and r.reward_period_start is not null
      and r.reward_period_end is not null
      and r.reward_payment_id is null
  loop
    perform public.wmc_apply_referral_reward_invoice(
      v_ref.id,
      v_ref.referrer_id,
      v_ref.reward_period_start,
      v_ref.reward_period_end,
      greatest(1, coalesce(v_ref.reward_months, 1)),
      coalesce(v_ref.reward_message, 'Premio de indicacao')
    );

    update public.referrals
    set server_activation_required = true,
        server_activation_action = 'extend',
        server_activation_target_expiry = v_ref.reward_period_end,
        server_activation_completed_at = null,
        server_activation_completed_by = null,
        updated_at = now()
    where id = v_ref.id;
  end loop;
end;
$$;

-- Repara imediatamente as indicacoes que ficaram convertidas sem premio.
select public.repair_referral_rewards_v116(null);

commit;

-- Atualiza o cache do PostgREST quando suportado.
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  null;
end;
$$;
