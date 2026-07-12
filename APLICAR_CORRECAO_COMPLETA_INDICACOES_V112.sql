-- WMCPLAYER V112 - CORRECAO COMPLETA DO SISTEMA DE INDICACOES
-- Corrige compatibilidade entre profiles.referred_by TEXT e IDs UUID.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Projeto: vywtzzrvpdjqpcnixskz
-- Este script e idempotente e pode ser executado novamente se necessario.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. CONFIGURACAO GLOBAL DA PROMOCAO
-- ---------------------------------------------------------------------------
create table if not exists public.referral_settings (
  id smallint primary key default 1,
  is_active boolean not null default true,
  default_reward_months integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint referral_settings_singleton check (id = 1),
  constraint referral_settings_reward_months_check check (default_reward_months between 1 and 120)
);

insert into public.referral_settings (id, is_active, default_reward_months)
values (1, true, 1)
on conflict (id) do nothing;

alter table public.referral_settings enable row level security;

drop policy if exists referral_settings_read_authenticated on public.referral_settings;
create policy referral_settings_read_authenticated
on public.referral_settings
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- 2. ESTRUTURA COMPLETA DA TABELA DE INDICACOES
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  reward_type text not null default 'free_month',
  reward_months integer not null default 1,
  reward_amount numeric not null default 0,
  first_payment_id uuid null references public.iptv_payments(id) on delete set null,
  bonus_payment_id uuid null references public.iptv_payments(id) on delete set null,
  converted_at timestamptz null,
  rewarded_at timestamptz null,
  reward_period_start date null,
  reward_period_end date null,
  reward_message text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

alter table public.referrals add column if not exists converted_at timestamptz null;
alter table public.referrals add column if not exists reward_period_start date null;
alter table public.referrals add column if not exists reward_period_end date null;
alter table public.referrals add column if not exists reward_message text null;
alter table public.referrals add column if not exists updated_at timestamptz not null default now();
alter table public.referrals add column if not exists updated_by uuid null;

update public.referrals
set status = 'rewarded',
    converted_at = coalesce(converted_at, rewarded_at, created_at),
    rewarded_at = coalesce(rewarded_at, created_at),
    updated_at = now()
where status = 'approved';

update public.referrals
set reward_months = greatest(1, coalesce(reward_months, 1)),
    reward_type = coalesce(nullif(reward_type, ''), 'free_month'),
    reward_amount = coalesce(reward_amount, 0),
    updated_at = coalesce(updated_at, created_at, now());

-- Remove somente duplicidades corrompidas do mesmo indicado, preservando a linha
-- mais importante: premiada > convertida > pendente > recusada.
with ranked as (
  select
    id,
    row_number() over (
      partition by referred_id
      order by
        case status
          when 'rewarded' then 1
          when 'converted' then 2
          when 'pending' then 3
          when 'rejected' then 4
          else 5
        end,
        coalesce(rewarded_at, converted_at, created_at) desc,
        created_at desc
    ) as rn
  from public.referrals
)
delete from public.referrals r
using ranked x
where r.id = x.id
  and x.rn > 1;

create unique index if not exists referrals_one_per_referred_idx
  on public.referrals (referred_id);

create unique index if not exists referrals_first_payment_unique_idx
  on public.referrals (first_payment_id)
  where first_payment_id is not null;

alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals
  add constraint referrals_status_check
  check (status in ('pending', 'converted', 'rewarded', 'rejected'));

alter table public.referrals drop constraint if exists referrals_no_self_check;
alter table public.referrals
  add constraint referrals_no_self_check
  check (referrer_id <> referred_id);

alter table public.referrals drop constraint if exists referrals_reward_months_check;
alter table public.referrals
  add constraint referrals_reward_months_check
  check (reward_months between 1 and 120);

alter table public.referrals enable row level security;

drop policy if exists referrals_client_read_own on public.referrals;
create policy referrals_client_read_own
on public.referrals
for select
to authenticated
using (referrer_id = auth.uid() or referred_id = auth.uid());

-- Escritas ficam bloqueadas diretamente para clientes. O painel usa Edge Function
-- autenticada e as funcoes SECURITY DEFINER abaixo.

-- ---------------------------------------------------------------------------
-- 3. FUNCOES AUXILIARES SEGURAS
-- ---------------------------------------------------------------------------
create or replace function public.wmc_is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'admin'
  );
$$;

revoke all on function public.wmc_is_admin(uuid) from public;
grant execute on function public.wmc_is_admin(uuid) to authenticated, service_role;

create or replace function public.wmc_add_months_fixed_day(p_date date, p_months integer)
returns date
language plpgsql
immutable
as $$
declare
  v_month_start date;
  v_last_day integer;
  v_target_day integer;
begin
  v_month_start := (date_trunc('month', p_date)::date + make_interval(months => greatest(1, p_months)))::date;
  v_last_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;
  v_target_day := least(extract(day from p_date)::integer, v_last_day);
  return make_date(extract(year from v_month_start)::integer, extract(month from v_month_start)::integer, v_target_day);
end;
$$;

create or replace function public.get_referral_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_active', coalesce(s.is_active, true),
    'default_reward_months', coalesce(s.default_reward_months, 1),
    'updated_at', s.updated_at
  )
  from public.referral_settings s
  where s.id = 1;
$$;

revoke all on function public.get_referral_settings() from public;
grant execute on function public.get_referral_settings() to authenticated, service_role;

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
    return jsonb_build_object(
      'valid', false,
      'promotion_active', false,
      'error', 'Promoção encerrada.'
    );
  end if;

  if v_code = '' then
    return jsonb_build_object('valid', false, 'promotion_active', true, 'error', 'Informe o código de indicação.');
  end if;

  select * into v_referrer
  from public.profiles
  where upper(trim(referral_code)) = v_code
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'promotion_active', true, 'error', 'Código de indicação não encontrado.');
  end if;

  if p_referred_user_id is not null and v_referrer.id = p_referred_user_id then
    return jsonb_build_object('valid', false, 'promotion_active', true, 'error', 'Você não pode indicar a si mesmo.');
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
        'error', 'Este cliente já possui uma indicação vinculada.',
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

-- ---------------------------------------------------------------------------
-- 4. SINCRONIZACAO AUTOMATICA referrals <-> profiles.referred_by
-- COMPATIBILIDADE: em alguns bancos antigos profiles.referred_by e TEXT,
-- enquanto profiles.id/referrals.referrer_id sao UUID. Todas as comparacoes
-- e gravacoes abaixo tratam os dois formatos sem comparar TEXT diretamente
-- com UUID.
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_referred_by_from_referrals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles
    set referred_by = null
    where id = old.referred_id
      and referred_by::text = old.referrer_id::text;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.referred_id is distinct from new.referred_id then
    update public.profiles
    set referred_by = null
    where id = old.referred_id
      and referred_by::text = old.referrer_id::text;
  end if;

  -- new.referrer_id e convertido para texto porque o banco atual possui
  -- profiles.referred_by como TEXT. O valor continua sendo o UUID do indicador.
  update public.profiles
  set referred_by = new.referrer_id::text
  where id = new.referred_id
    and referred_by::text is distinct from new.referrer_id::text;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_referred_by on public.referrals;
create trigger trg_sync_profile_referred_by
after insert or update or delete
on public.referrals
for each row
execute function public.sync_profile_referred_by_from_referrals();

-- Clientes antigos que possuem profiles.referred_by mas ainda nao possuem linha
-- em referrals passam a aparecer corretamente. O valor antigo pode ser:
-- 1. o UUID do indicador salvo como TEXT; ou
-- 2. o codigo de indicacao salvo como TEXT.
insert into public.referrals (
  referrer_id,
  referred_id,
  status,
  reward_type,
  reward_months,
  reward_amount,
  notes
)
select
  ref.id,
  p.id,
  'pending',
  'free_month',
  coalesce((select default_reward_months from public.referral_settings where id = 1), 1),
  0,
  'Indicação recuperada automaticamente de profiles.referred_by. Aguardando o primeiro pagamento.'
from public.profiles p
join lateral (
  select candidate.id
  from public.profiles candidate
  where candidate.id::text = trim(p.referred_by::text)
     or upper(trim(candidate.referral_code)) = upper(trim(p.referred_by::text))
  order by case
    when candidate.id::text = trim(p.referred_by::text) then 0
    else 1
  end
  limit 1
) ref on true
where p.referred_by is not null
  and trim(p.referred_by::text) <> ''
  and ref.id <> p.id
  and not exists (
    select 1 from public.referrals r where r.referred_id = p.id
  );

-- A tabela referrals passa a ser a fonte principal do vinculo.
update public.profiles p
set referred_by = r.referrer_id::text
from public.referrals r
where r.referred_id = p.id
  and p.referred_by::text is distinct from r.referrer_id::text;

-- ---------------------------------------------------------------------------
-- 5. DASHBOARD DO CLIENTE - FUNCIONA COM RLS ATIVADO
-- ---------------------------------------------------------------------------
create or replace function public.get_my_referral_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_rows jsonb;
begin
  if v_user_id is null then
    raise exception 'Não autorizado';
  end if;

  select jsonb_build_object(
    'is_active', coalesce(s.is_active, true),
    'default_reward_months', coalesce(s.default_reward_months, 1),
    'updated_at', s.updated_at
  ) into v_settings
  from public.referral_settings s
  where s.id = 1;

  select coalesce(jsonb_agg(item order by (item->>'created_at')::timestamptz desc), '[]'::jsonb)
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
      'bonus_payment_id', r.bonus_payment_id,
      'converted_at', r.converted_at,
      'rewarded_at', r.rewarded_at,
      'reward_period_start', r.reward_period_start,
      'reward_period_end', r.reward_period_end,
      'reward_message', r.reward_message,
      'notes', r.notes,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'referred_name', p.name,
      'referred_username', p.username,
      'referred_iptv_user', p.iptv_user
    ) as item
    from public.referrals r
    join public.profiles p on p.id = r.referred_id
    where r.referrer_id = v_user_id
  ) q;

  return jsonb_build_object(
    'settings', coalesce(v_settings, jsonb_build_object('is_active', true, 'default_reward_months', 1)),
    'referrals', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_referral_dashboard() from public;
grant execute on function public.get_my_referral_dashboard() to authenticated, service_role;

-- Compatibilidade com versoes anteriores do app.
drop function if exists public.get_my_referrals_with_names();
create function public.get_my_referrals_with_names()
returns table (
  id uuid,
  referrer_id uuid,
  referred_id uuid,
  status text,
  reward_type text,
  reward_months integer,
  reward_amount numeric,
  first_payment_id uuid,
  bonus_payment_id uuid,
  rewarded_at timestamptz,
  notes text,
  created_at timestamptz,
  referred_name text,
  referred_username text,
  referred_iptv_user text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.referrer_id,
    r.referred_id,
    r.status,
    r.reward_type,
    r.reward_months,
    r.reward_amount,
    r.first_payment_id,
    r.bonus_payment_id,
    r.rewarded_at,
    r.notes,
    r.created_at,
    p.name,
    p.username,
    p.iptv_user
  from public.referrals r
  join public.profiles p on p.id = r.referred_id
  where r.referrer_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.get_my_referrals_with_names() from public;
grant execute on function public.get_my_referrals_with_names() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC ANTIGA DO ADMIN CORRIGIDA
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_referrer_by_code(
  p_referral_code text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_referrer_id uuid;
  v_reward_months integer := 1;
  v_existing public.referrals%rowtype;
begin
  if not public.wmc_is_admin(auth.uid()) then
    raise exception 'Apenas administradores';
  end if;

  v_result := public.resolve_referral_code(p_referral_code, p_user_id);
  if coalesce((v_result->>'valid')::boolean, false) = false then
    return v_result;
  end if;

  v_referrer_id := (v_result->>'referrer_id')::uuid;
  v_reward_months := greatest(1, coalesce((v_result->>'reward_months')::integer, 1));

  select * into v_existing from public.referrals where referred_id = p_user_id limit 1;
  if found then
    return jsonb_build_object(
      'success', true,
      'already_linked', true,
      'referral_id', v_existing.id,
      'referrer_id', v_existing.referrer_id
    );
  end if;

  insert into public.referrals (
    referrer_id,
    referred_id,
    status,
    reward_type,
    reward_months,
    reward_amount,
    notes,
    updated_by
  ) values (
    v_referrer_id,
    p_user_id,
    'pending',
    'free_month',
    v_reward_months,
    0,
    'Indicação vinculada pelo administrador. Aguardando o primeiro pagamento.',
    auth.uid()
  )
  returning id into v_existing.id;

  return jsonb_build_object(
    'success', true,
    'already_linked', false,
    'referral_id', v_existing.id,
    'referrer_id', v_referrer_id,
    'referrer_name', v_result->>'referrer_name',
    'referral_code', v_result->>'referral_code'
  );
end;
$$;

revoke all on function public.admin_set_referrer_by_code(text, uuid) from public;
grant execute on function public.admin_set_referrer_by_code(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. PRIMEIRO PAGAMENTO: CONVERSAO + PREMIO ATOMICO E IDEMPOTENTE
-- ---------------------------------------------------------------------------
create or replace function public.process_referral_first_payment(
  p_referred_id uuid,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_payment public.iptv_payments%rowtype;
  v_referrer public.profiles%rowtype;
  v_start date;
  v_end date;
  v_months integer;
  v_message text;
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
      'reward_period_start', v_referral.reward_period_start,
      'reward_period_end', v_referral.reward_period_end,
      'reward_message', v_referral.reward_message
    );
  end if;

  if v_referral.status = 'rejected' then
    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'referral_rejected');
  end if;

  -- So premia se este for realmente o primeiro pagamento confirmado do indicado.
  if exists (
    select 1
    from public.iptv_payments p
    where p.user_id = p_referred_id
      and p.id <> p_payment_id
      and p.status in ('paid_pending_activation', 'confirmed', 'paid')
      and coalesce(p.payment_date, p.created_at) <= coalesce(v_payment.payment_date, v_payment.created_at, now())
  ) then
    update public.referrals
    set status = 'converted',
        converted_at = coalesce(converted_at, now()),
        first_payment_id = coalesce(first_payment_id, p_payment_id),
        notes = concat_ws(E'\n', nullif(notes, ''), 'Primeiro pagamento já havia sido processado antes do vínculo da indicação.'),
        updated_at = now()
    where id = v_referral.id;

    return jsonb_build_object('success', true, 'rewarded', false, 'reason', 'not_first_payment');
  end if;

  select * into v_referrer
  from public.profiles
  where id = v_referral.referrer_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'rewarded', false, 'reason', 'referrer_not_found');
  end if;

  v_months := greatest(1, coalesce(v_referral.reward_months, 1));
  v_start := greatest(coalesce(v_referrer.iptv_expiry, current_date), current_date);
  v_end := public.wmc_add_months_fixed_day(v_start, v_months);
  v_message := format(
    'Seu indicado realizou o 1° pagamento e você ganhou o próximo período de %s a %s gratuitamente! Obrigado por apoiar esse projeto!',
    to_char(v_start, 'DD/MM/YYYY'),
    to_char(v_end, 'DD/MM/YYYY')
  );

  update public.profiles
  set iptv_expiry = v_end
  where id = v_referral.referrer_id;

  update public.referrals
  set status = 'rewarded',
      converted_at = coalesce(converted_at, now()),
      rewarded_at = now(),
      first_payment_id = p_payment_id,
      reward_period_start = v_start,
      reward_period_end = v_end,
      reward_message = v_message,
      notes = concat_ws(E'\n', nullif(notes, ''), format('Benefício automático gerado pelo pagamento %s.', p_payment_id)),
      updated_at = now()
  where id = v_referral.id;

  insert into public.balance_history (user_id, amount, type, description)
  values (v_referral.referrer_id, 0, 'referral', v_message);

  return jsonb_build_object(
    'success', true,
    'rewarded', true,
    'referral_id', v_referral.id,
    'referrer_id', v_referral.referrer_id,
    'referred_id', p_referred_id,
    'first_payment_id', p_payment_id,
    'reward_months', v_months,
    'reward_period_start', v_start,
    'reward_period_end', v_end,
    'new_expiry', v_end,
    'reward_message', v_message
  );
end;
$$;

revoke all on function public.process_referral_first_payment(uuid, uuid) from public;
grant execute on function public.process_referral_first_payment(uuid, uuid) to service_role;

commit;
