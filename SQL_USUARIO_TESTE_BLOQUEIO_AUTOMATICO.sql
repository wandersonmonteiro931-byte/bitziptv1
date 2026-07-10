-- WMCPLAYER - USUÁRIO DE TESTE COM BLOQUEIO AUTOMÁTICO
-- Rode este arquivo uma vez no Supabase SQL Editor.
-- Pode rodar por cima: não apaga dados.

alter table if exists public.profiles
  add column if not exists trial_enabled boolean not null default false;

alter table if exists public.profiles
  add column if not exists trial_duration_days integer;

alter table if exists public.profiles
  add column if not exists trial_started_at date;

alter table if exists public.profiles
  add column if not exists trial_ends_at date;

alter table if exists public.profiles
  add column if not exists trial_expired_at timestamptz;

alter table if exists public.profiles
  add column if not exists trial_expired_notice_sent_at timestamptz;

alter table if exists public.profiles
  add column if not exists trial_payment_confirmed boolean not null default false;

create index if not exists idx_profiles_trial_active
on public.profiles (trial_enabled, trial_ends_at, trial_payment_confirmed, iptv_status);

create or replace function public.auto_block_expired_trials()
returns table(blocked_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.profiles
     set iptv_status = 'blocked',
         trial_expired_at = coalesce(trial_expired_at, now()),
         trial_expired_notice_sent_at = coalesce(trial_expired_notice_sent_at, now())
   where trial_enabled = true
     and coalesce(trial_payment_confirmed, false) = false
     and trial_ends_at is not null
     and trial_ends_at < current_date
     and coalesce(iptv_status, '') <> 'blocked';

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$$;

grant execute on function public.auto_block_expired_trials() to anon;
grant execute on function public.auto_block_expired_trials() to authenticated;
