-- BITZIPTV1 / WMCPLAYER - PASSO 2 - IMPORTAR HISTÓRICO DO LOVABLE
-- Execute depois do PASSO_1_CRIAR_ESTRUTURA.sql.
-- Este arquivo recria os logins e importa os dados do backup.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public._wmc_create_auth_user(p_id uuid, p_email text, p_password text, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_identity_id_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('name', p_name),
    now(),
    now(),
    false,
    false
  );

  SELECT data_type INTO v_identity_id_type
  FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'id'
  LIMIT 1;

  IF v_identity_id_type = 'uuid' THEN
    EXECUTE 'INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), now(), now()) ON CONFLICT DO NOTHING'
    USING gen_random_uuid(), lower(p_email), p_id, jsonb_build_object('sub', p_id::text, 'email', lower(p_email), 'email_verified', true, 'phone_verified', false), 'email';
  ELSE
    EXECUTE 'INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), now(), now()) ON CONFLICT DO NOTHING'
    USING gen_random_uuid()::text, lower(p_email), p_id, jsonb_build_object('sub', p_id::text, 'email', lower(p_email), 'email_verified', true, 'phone_verified', false), 'email';
  END IF;
END;
$$;

-- Criando usuários de login no Supabase Auth
SELECT public._wmc_create_auth_user('90f86931-95b7-441e-89dd-a1261908db02'::uuid, 'admin@iptv.bitz', '123456', 'Administrador');
SELECT public._wmc_create_auth_user('5ec8acda-8df8-4050-9a94-3a9bc26b0361'::uuid, '674879@iptv.bitz', '622094', 'Verônica Cavalcante');
SELECT public._wmc_create_auth_user('2fe51323-1a39-431f-b62e-0456cbf9104a'::uuid, '674879*@iptv.bitz', '622094', 'Patrick Amaral');
SELECT public._wmc_create_auth_user('67f8ec63-a7a0-484e-be64-3da8d7a4f1b5'::uuid, '8263381@iptv.bitz', '9876441', 'Patrick Amaral');
SELECT public._wmc_create_auth_user('81e4aecd-fa95-4c9e-858b-a5a0a59f6ac0'::uuid, '587591@iptv.bitz', '345122', 'Alexandra');
SELECT public._wmc_create_auth_user('a4d9100d-c80b-4583-b6b4-2a56f75ec255'::uuid, '908216@iptv.bitz', '327492', 'Marcelo Cambuir');
SELECT public._wmc_create_auth_user('799249ac-f502-4352-ba20-d8eacad550b5'::uuid, 'wandersonmontc@iptv.bitz', 'wandersonmontc', 'Wanderson Monteiro de Camargo');
SELECT public._wmc_create_auth_user('e95db3db-c70f-4651-bcb6-a55e2bc9171f'::uuid, 'admin@bitziptv.com', '123456', 'Ueslaine');
SELECT public._wmc_create_auth_user('0ef1e1d3-14ff-44c0-a2fe-e599bedd9d9b'::uuid, '826338@iptv.bitz', '987644', 'Claudete Gonçalves');
SELECT public._wmc_create_auth_user('67035dc0-4396-4aa2-ac26-6ca0116f1e72'::uuid, '6748791@iptv.bitz', '6220941', 'Patrick Amaral');
SELECT public._wmc_create_auth_user('45e3e0a3-dae5-462e-a618-faeb8ac379ee'::uuid, '123456@iptv.bitz', '123456', 'Yasmin Pereira Barbosa');

-- Limpando tabelas públicas antes de importar
TRUNCATE TABLE public."admin_audit_logs", public."announcement_dismissals", public."announcements", public."balance_history", public."billing_due_dates", public."challenge_attempts", public."content", public."credit_challenges", public."credit_packages", public."credit_promotions", public."credit_purchases", public."credit_rankings", public."credit_settings", public."credit_transactions", public."custom_variables", public."game_memory_sessions", public."game_memory_settings", public."game_overrides", public."iptv_cancellation_requests", public."iptv_payments", public."iptv_scheduled_rates", public."iptv_servers", public."iptv_trust_requests", public."iptv_tv_apps", public."login_logs", public."mission_completions", public."missions", public."notification_rules", public."notification_views", public."platform_settings", public."profiles", public."push_notifications", public."push_subscriptions", public."push_vapid_keys", public."referrals", public."scheduled_notifications", public."support_settings", public."tv_channels", public."tv_programs", public."user_roles", public."withdrawals" RESTART IDENTITY CASCADE;

-- FIM DO PASSO 2.01
