-- CORREÇÃO ÚNICA PARA O CLIENTE MOSTRADO NA IMAGEM: @123456
-- Vencimento anterior correto: 09/07/2026
-- Próximo vencimento correto após 1 mês: 09/08/2026
-- Rode uma única vez no Supabase SQL Editor somente para corrigir o registro já confirmado errado.

do $$
declare
  v_user_id uuid;
  v_payment_id uuid;
begin
  select id
    into v_user_id
    from public.profiles
   where username = '123456'
      or iptv_user = '123456'
   order by created_at desc
   limit 1;

  if v_user_id is null then
    raise exception 'Cliente 123456 não encontrado.';
  end if;

  update public.profiles
     set iptv_expiry = date '2026-08-09',
         iptv_due_day = 9,
         iptv_status = 'active'
   where id = v_user_id;

  select id
    into v_payment_id
    from public.iptv_payments
   where user_id = v_user_id
     and status = 'confirmed'
   order by coalesce(payment_date, created_at) desc
   limit 1;

  if v_payment_id is not null then
    update public.iptv_payments
       set period_start = date '2026-07-09',
           period_end = date '2026-08-09'
     where id = v_payment_id;
  end if;
end $$;
