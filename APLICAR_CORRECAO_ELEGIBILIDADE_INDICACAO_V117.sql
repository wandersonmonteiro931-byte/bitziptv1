-- WMCPLAYER V117
-- REGRA DE ELEGIBILIDADE DO CODIGO DE INDICACAO
-- 1. O indicado nao pode possuir nenhuma fatura ja paga.
-- 2. O dono do codigo precisa estar totalmente ativo e fora do teste gratis.
-- 3. Mensagens obrigatorias:
--    - Cliente nao elegivel: "Cliente não elegível."
--    - Indicador fora do status ativo: "Código inválido"

begin;

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
  v_has_paid_invoice boolean := false;
begin
  select * into v_settings
  from public.referral_settings
  where id = 1;

  if coalesce(v_settings.is_active, true) = false then
    return jsonb_build_object(
      'valid', false,
      'promotion_active', false,
      'error', 'Promoção encerrada.'
    );
  end if;

  if v_code = '' then
    return jsonb_build_object(
      'valid', false,
      'promotion_active', true,
      'error', 'Informe o código de indicação.'
    );
  end if;

  select * into v_referrer
  from public.profiles
  where upper(trim(referral_code)) = v_code
  limit 1;

  -- Código inexistente ou pertencente a usuário que não está totalmente ativo
  -- deve retornar a mesma mensagem obrigatória.
  if not found
     or lower(trim(coalesce(v_referrer.status, ''))) <> 'active'
     or lower(trim(coalesce(v_referrer.iptv_status, ''))) <> 'active'
     or coalesce(v_referrer.trial_enabled, false) = true then
    return jsonb_build_object(
      'valid', false,
      'promotion_active', true,
      'error', 'Código inválido'
    );
  end if;

  if p_referred_user_id is not null and v_referrer.id = p_referred_user_id then
    return jsonb_build_object(
      'valid', false,
      'promotion_active', true,
      'error', 'Você não pode indicar a si mesmo.'
    );
  end if;

  if p_referred_user_id is not null then
    -- Cliente novo não pode possuir nenhuma fatura realmente paga.
    -- Faturas pendentes, removidas, revertidas ou canceladas não impedem a indicação.
    select exists (
      select 1
      from public.iptv_payments payment
      where payment.user_id = p_referred_user_id
        and lower(trim(coalesce(payment.status, ''))) in (
          'paid_pending_activation',
          'confirmed',
          'paid'
        )
    ) into v_has_paid_invoice;

    if v_has_paid_invoice then
      return jsonb_build_object(
        'valid', false,
        'promotion_active', true,
        'error', 'Cliente não elegível.'
      );
    end if;

    select * into v_existing
    from public.referrals
    where referred_id = p_referred_user_id
      and lower(trim(coalesce(status, ''))) <> 'rejected'
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

notify pgrst, 'reload schema';

commit;
