-- CRIAÇÃO DA TABELA DE PLANOS DE RENOVAÇÃO
-- Rode este arquivo 1 vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

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

insert into public.iptv_renewal_plans (title, description, badge_text, cta_text, months, discount_percent, is_active, sort_order)
select * from (
  values
    ('Antecipar 3 meses', '5% de desconto', 'Plano recomendado', 'Assinar agora', 3, 5.00, true, 1),
    ('Antecipar 6 meses', '10% de desconto', 'Maior economia', 'Assinar agora', 6, 10.00, true, 2)
) as v(title, description, badge_text, cta_text, months, discount_percent, is_active, sort_order)
where not exists (select 1 from public.iptv_renewal_plans);
