-- CRIAÇÃO DA TABELA DE PLANOS DE RENOVAÇÃO
-- Rode este arquivo 1 vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Snapshot fixo dos planos enviados pelo admin.
-- O cliente usa este snapshot ao recarregar, para nunca voltar/sumir.
alter table if exists public.platform_settings
  add column if not exists renewal_plans_snapshot jsonb not null default '[]'::jsonb;

alter table if exists public.platform_settings
  add column if not exists renewal_plans_snapshot_updated_at timestamptz;

create or replace function public.set_renewal_plans_snapshot(p_plans jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.platform_settings
     set renewal_plans_snapshot = coalesce(p_plans, '[]'::jsonb),
         renewal_plans_snapshot_updated_at = now()
   where id is not null;

  if not found then
    raise exception 'platform_settings não possui registro para salvar renewal_plans_snapshot';
  end if;
end;
$$;

grant execute on function public.set_renewal_plans_snapshot(jsonb) to authenticated;

-- Cliente busca planos ativos.
-- Primeiro tenta a tabela iptv_renewal_plans.
-- Se a tabela não retornar nada, usa o snapshot fixo enviado pelo admin.
create or replace function public.get_active_renewal_plans()
returns table (
  id uuid,
  title text,
  badge_text text,
  cta_text text,
  months integer,
  discount_percent numeric,
  is_active boolean,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.title,
    p.badge_text,
    p.cta_text,
    p.months,
    p.discount_percent,
    p.is_active,
    p.sort_order
  from public.iptv_renewal_plans p
  where p.is_active = true
  order by p.sort_order asc, p.months asc;

  if found then
    return;
  end if;

  return query
  select
    coalesce(nullif(plan->>'id', '')::uuid, gen_random_uuid()) as id,
    coalesce(plan->>'title', '') as title,
    nullif(plan->>'badge_text', '') as badge_text,
    coalesce(nullif(plan->>'cta_text', ''), 'Antecipar agora') as cta_text,
    greatest(1, coalesce((plan->>'months')::integer, 1)) as months,
    greatest(0, least(100, coalesce((plan->>'discount_percent')::numeric, 0))) as discount_percent,
    coalesce((plan->>'is_active')::boolean, true) as is_active,
    coalesce((plan->>'sort_order')::integer, 0) as sort_order
  from public.platform_settings ps
  cross join lateral jsonb_array_elements(coalesce(ps.renewal_plans_snapshot, '[]'::jsonb)) as plan
  where coalesce((plan->>'is_active')::boolean, true) = true
  order by sort_order asc, months asc;
end;
$$;

grant execute on function public.get_active_renewal_plans() to anon;
grant execute on function public.get_active_renewal_plans() to authenticated;

drop policy if exists "renewal_plans_select_authenticated" on public.iptv_renewal_plans;
create policy "renewal_plans_select_authenticated"
on public.iptv_renewal_plans
for select
using (true);

-- Snapshot fixo dos planos enviados pelo admin.
-- O cliente usa isso para nunca voltar para plano padrão ao recarregar.
alter table if exists public.platform_settings
  add column if not exists renewal_plans_snapshot jsonb not null default '[]'::jsonb;

alter table if exists public.platform_settings
  add column if not exists renewal_plans_snapshot_updated_at timestamptz;



alter table if exists public.iptv_renewal_plans alter column id set default gen_random_uuid();

create table if not exists public.iptv_renewal_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  badge_text text,
  cta_text text not null default 'Assinar agora',
  months integer not null check (months > 0),
  discount_percent numeric(10,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_iptv_renewal_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_iptv_renewal_plans_updated_at on public.iptv_renewal_plans;
create trigger trg_iptv_renewal_plans_updated_at
before update on public.iptv_renewal_plans
for each row execute function public.touch_iptv_renewal_plans_updated_at();

alter table public.iptv_renewal_plans enable row level security;

drop policy if exists "renewal_plans_select_authenticated" on public.iptv_renewal_plans;
create policy "renewal_plans_select_authenticated"
on public.iptv_renewal_plans
for select
using (auth.uid() is not null);

drop policy if exists "renewal_plans_admin_insert" on public.iptv_renewal_plans;
create policy "renewal_plans_admin_insert"
on public.iptv_renewal_plans
for insert
with check (
  exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = 'admin'
  )
);

drop policy if exists "renewal_plans_admin_update" on public.iptv_renewal_plans;
create policy "renewal_plans_admin_update"
on public.iptv_renewal_plans
for update
using (
  exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = 'admin'
  )
);

drop policy if exists "renewal_plans_admin_delete" on public.iptv_renewal_plans;
create policy "renewal_plans_admin_delete"
on public.iptv_renewal_plans
for delete
using (
  exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = 'admin'
  )
);

-- Correção extra para evitar erro: null value in column "id".
alter table if exists public.iptv_renewal_plans alter column id set default gen_random_uuid();
