-- WMCPLAYER V114 - INDICACOES REAIS + LEITURA ADMIN SEM DEPENDER DE FK EMBUTIDA
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Projeto: vywtzzrvpdjqpcnixskz
-- Pode ser executado novamente sem duplicar indicacoes.

begin;

create unique index if not exists referrals_one_per_referred_idx
  on public.referrals (referred_id);

-- Resolve o valor antigo de profiles.referred_by. Aceita:
-- UUID do indicador salvo como texto, codigo de indicacao, login ou usuario da TV.
create or replace function public.wmc_resolve_legacy_referrer(
  p_legacy_value text,
  p_referred_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select candidate.id
  from public.profiles candidate
  where candidate.id <> p_referred_id
    and trim(coalesce(p_legacy_value, '')) <> ''
    and (
      candidate.id::text = trim(p_legacy_value)
      or upper(trim(coalesce(candidate.referral_code, ''))) = upper(trim(p_legacy_value))
      or lower(trim(coalesce(candidate.username, ''))) = lower(trim(p_legacy_value))
      or lower(trim(coalesce(candidate.iptv_user, ''))) = lower(trim(p_legacy_value))
    )
  order by case
    when candidate.id::text = trim(p_legacy_value) then 0
    when upper(trim(coalesce(candidate.referral_code, ''))) = upper(trim(p_legacy_value)) then 1
    when lower(trim(coalesce(candidate.username, ''))) = lower(trim(p_legacy_value)) then 2
    else 3
  end
  limit 1;
$$;

revoke all on function public.wmc_resolve_legacy_referrer(text, uuid) from public;
grant execute on function public.wmc_resolve_legacy_referrer(text, uuid) to service_role;

-- Converte os vinculos reais antigos de profiles.referred_by em linhas da tabela referrals.
create or replace function public.wmc_repair_legacy_referrals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.referrals (
    referrer_id,
    referred_id,
    status,
    reward_type,
    reward_months,
    reward_amount,
    notes,
    updated_by,
    updated_at
  )
  select
    resolved.referrer_id,
    p.id,
    'pending',
    'free_month',
    greatest(1, coalesce((select default_reward_months from public.referral_settings where id = 1), 1)),
    0,
    'Indicacao real recuperada automaticamente de profiles.referred_by. Aguardando o primeiro pagamento.',
    auth.uid(),
    now()
  from public.profiles p
  cross join lateral (
    select public.wmc_resolve_legacy_referrer(p.referred_by::text, p.id) as referrer_id
  ) resolved
  where p.referred_by is not null
    and trim(p.referred_by::text) <> ''
    and resolved.referrer_id is not null
    and not exists (
      select 1
      from public.referrals r
      where r.referred_id = p.id
    )
  on conflict (referred_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- A tabela referrals e a fonte principal. Mantem o campo antigo sincronizado.
  update public.profiles p
  set referred_by = r.referrer_id::text
  from public.referrals r
  where r.referred_id = p.id
    and p.referred_by::text is distinct from r.referrer_id::text;

  return v_inserted;
end;
$$;

revoke all on function public.wmc_repair_legacy_referrals() from public;
grant execute on function public.wmc_repair_legacy_referrals() to service_role;

-- Leitura completa para o painel administrativo. A funcao valida o papel admin,
-- ignora RLS de forma controlada e nao depende dos nomes das foreign keys do PostgREST.
create or replace function public.get_admin_referral_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrals jsonb := '[]'::jsonb;
  v_users jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_unresolved jsonb := '[]'::jsonb;
  v_repaired integer := 0;
begin
  if auth.uid() is null or not public.wmc_is_admin(auth.uid()) then
    raise exception 'Apenas administradores';
  end if;

  v_repaired := public.wmc_repair_legacy_referrals();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'referrer_id', r.referrer_id,
        'referred_id', r.referred_id,
        'status', r.status,
        'reward_type', r.reward_type,
        'reward_months', r.reward_months,
        'reward_amount', r.reward_amount,
        'first_payment_id', r.first_payment_id,
        'bonus_payment_id', r.bonus_payment_id,
        'converted_at', r.converted_at,
        'rewarded_at', r.rewarded_at,
        'reward_period_start', r.reward_period_start,
        'reward_period_end', r.reward_period_end,
        'reward_message', r.reward_message,
        'notes', r.notes,
        'created_at', r.created_at,
        'updated_at', r.updated_at,
        'referrer', jsonb_build_object(
          'id', referrer.id,
          'name', referrer.name,
          'username', referrer.username,
          'referral_code', referrer.referral_code,
          'iptv_user', referrer.iptv_user,
          'iptv_expiry', referrer.iptv_expiry,
          'status', referrer.status
        ),
        'referred', jsonb_build_object(
          'id', referred.id,
          'name', referred.name,
          'username', referred.username,
          'referral_code', referred.referral_code,
          'referred_by', referred.referred_by,
          'iptv_user', referred.iptv_user,
          'iptv_expiry', referred.iptv_expiry,
          'status', referred.status
        )
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_referrals
  from public.referrals r
  join public.profiles referrer on referrer.id = r.referrer_id
  join public.profiles referred on referred.id = r.referred_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'username', p.username,
        'referral_code', p.referral_code,
        'referred_by', p.referred_by,
        'iptv_user', p.iptv_user,
        'iptv_expiry', p.iptv_expiry,
        'status', p.status
      )
      order by coalesce(p.name, p.username, p.id::text)
    ),
    '[]'::jsonb
  )
  into v_users
  from public.profiles p;

  select jsonb_build_object(
    'id', coalesce(s.id, 1),
    'is_active', coalesce(s.is_active, true),
    'default_reward_months', greatest(1, coalesce(s.default_reward_months, 1)),
    'updated_at', s.updated_at
  )
  into v_settings
  from public.referral_settings s
  where s.id = 1;

  if v_settings is null then
    v_settings := jsonb_build_object(
      'id', 1,
      'is_active', true,
      'default_reward_months', 1,
      'updated_at', null
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'referred_id', p.id,
        'referred_name', coalesce(p.name, p.username, 'Cliente'),
        'referred_by', p.referred_by
      )
      order by coalesce(p.name, p.username, p.id::text)
    ),
    '[]'::jsonb
  )
  into v_unresolved
  from public.profiles p
  where p.referred_by is not null
    and trim(p.referred_by::text) <> ''
    and not exists (select 1 from public.referrals r where r.referred_id = p.id)
    and public.wmc_resolve_legacy_referrer(p.referred_by::text, p.id) is null;

  return jsonb_build_object(
    'success', true,
    'referrals', v_referrals,
    'users', v_users,
    'settings', v_settings,
    'repaired_legacy_count', v_repaired,
    'unresolved_legacy', v_unresolved
  );
end;
$$;

revoke all on function public.get_admin_referral_dashboard() from public;
grant execute on function public.get_admin_referral_dashboard() to authenticated, service_role;

-- Executa a recuperacao imediatamente nesta atualizacao.
select public.wmc_repair_legacy_referrals();

notify pgrst, 'reload schema';

commit;
