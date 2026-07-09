-- BITZIPTV1 / WMCPLAYER - PASSO 1 - CRIAR ESTRUTURA NO SUPABASE NOVO
-- Execute este arquivo no Supabase novo: SQL Editor > New query > Run.
-- Projeto alvo: https://vywtzzrvpdjqpcnixskz.supabase.co

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public."admin_audit_logs" (
  "action" text,
  "admin_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "details" jsonb,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "target_id" uuid,
  "target_table" text
);

CREATE TABLE IF NOT EXISTS public."announcement_dismissals" (
  "announcement_id" uuid,
  "dismissed_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."announcements" (
  "announcement_type" text,
  "banner_url" text,
  "body" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "display_frequency" text,
  "expires_at" timestamptz,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "schedule_at" timestamptz,
  "target_ids" text[],
  "target_type" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."balance_history" (
  "admin_id" uuid,
  "amount" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."billing_due_dates" (
  "created_at" timestamptz DEFAULT now(),
  "day_of_month" integer,
  "grace_days" integer DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "label" text,
  "sort_order" integer DEFAULT 0,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."challenge_attempts" (
  "challenge_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "credits_spent" integer DEFAULT 0,
  "credits_won" integer DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "metadata" jsonb,
  "result_label" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."content" (
  "banner_url" text,
  "body" text,
  "click_count" integer DEFAULT 0,
  "content_type" text,
  "created_at" timestamptz DEFAULT now(),
  "display_duration_seconds" numeric DEFAULT 0,
  "ends_at" timestamptz,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "redirect_url" text,
  "sort_order" integer DEFAULT 0,
  "starts_at" timestamptz,
  "subtitle" text,
  "target_audience" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."credit_challenges" (
  "challenge_type" text,
  "cost_credits" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "daily_limit" integer DEFAULT 0,
  "description" text,
  "icon" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "min_level" text,
  "name" text,
  "probabilities" jsonb,
  "turbo_duration_minutes" numeric DEFAULT 0,
  "turbo_multiplier" numeric DEFAULT 0,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."credit_packages" (
  "bonus_credits" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "credits" integer DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "name" text,
  "price" numeric DEFAULT 0,
  "sort_order" integer DEFAULT 0,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."credit_promotions" (
  "bonus_percentage" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "ends_at" timestamptz,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "starts_at" timestamptz,
  "title" text
);

CREATE TABLE IF NOT EXISTS public."credit_purchases" (
  "admin_id" uuid,
  "bonus_amount" numeric DEFAULT 0,
  "confirmed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "credits_amount" numeric DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "package_id" uuid,
  "pix_code" text,
  "pix_location" text,
  "pix_qrcode" text,
  "pix_txid" text,
  "price" numeric DEFAULT 0,
  "status" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."credit_rankings" (
  "bonus_awarded" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "month_year" text,
  "rank_position" numeric DEFAULT 0,
  "total_credits_used" numeric DEFAULT 0,
  "total_credits_won" numeric DEFAULT 0,
  "total_purchased" numeric DEFAULT 0,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."credit_settings" (
  "daily_purchase_limit" numeric DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "level_thresholds" jsonb,
  "updated_at" timestamptz DEFAULT now(),
  "vip_threshold" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."credit_transactions" (
  "admin_id" uuid,
  "amount" numeric DEFAULT 0,
  "balance_after" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "metadata" jsonb,
  "type" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."custom_variables" (
  "created_at" timestamptz DEFAULT now(),
  "default_value" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "label" text,
  "updated_at" timestamptz DEFAULT now(),
  "var_key" text
);

CREATE TABLE IF NOT EXISTS public."game_memory_sessions" (
  "created_at" timestamptz DEFAULT now(),
  "duration_seconds" numeric DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pairs_found" numeric DEFAULT 0,
  "reward_amount" numeric DEFAULT 0,
  "user_id" uuid,
  "won" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."game_memory_settings" (
  "cost_per_game" numeric DEFAULT 0,
  "daily_limit" integer DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "memorize_seconds" numeric DEFAULT 0,
  "min_time_seconds" numeric DEFAULT 0,
  "reward_amount" numeric DEFAULT 0,
  "time_limit_seconds" numeric DEFAULT 0,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."game_overrides" (
  "challenge_type" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "forced_result" jsonb,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "notes" text,
  "user_id" uuid,
  "uses_remaining" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."iptv_cancellation_requests" (
  "admin_id" uuid,
  "admin_notes" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reason" text,
  "resolved_at" timestamptz,
  "status" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."iptv_payments" (
  "admin_id" uuid,
  "amount" numeric DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "months" integer DEFAULT 0,
  "notes" text,
  "payment_date" timestamptz DEFAULT now(),
  "payment_method" text,
  "period_end" date,
  "period_start" date,
  "pix_copia_cola" text,
  "pix_location" text,
  "pix_txid" text,
  "status" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."iptv_scheduled_rates" (
  "applied" boolean DEFAULT false,
  "applied_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "effective_date" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "new_monthly_value" numeric DEFAULT 0,
  "notes" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."iptv_servers" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "name" text,
  "sort_order" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."iptv_trust_requests" (
  "approved_at" timestamptz,
  "approved_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notes" text,
  "requested_at" timestamptz DEFAULT now(),
  "status" text,
  "trust_expires_at" timestamptz,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."iptv_tv_apps" (
  "created_at" timestamptz DEFAULT now(),
  "icon" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "name" text,
  "sort_order" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."login_logs" (
  "browser" text,
  "device_type" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ip_address" text,
  "logged_in_at" timestamptz,
  "os" text,
  "user_agent" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."mission_completions" (
  "completed_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mission_id" uuid,
  "status" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."missions" (
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "frequency" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "link" text,
  "mission_type" text,
  "reward_value" numeric DEFAULT 0,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."notification_rules" (
  "body_template" text,
  "click_url" text,
  "conditions" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "icon" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "name" text,
  "title_template" text,
  "trigger_event" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."notification_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id" uuid,
  "user_id" uuid,
  "viewed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS public."platform_settings" (
  "app_description" text,
  "app_favicon_url" text,
  "app_logo_url" text,
  "app_name" text,
  "app_short_name" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "min_withdrawal" numeric DEFAULT 0,
  "monthly_limit" numeric DEFAULT 0,
  "referral_value" numeric DEFAULT 0,
  "renewal_discount_3m_percent" numeric DEFAULT 0,
  "renewal_discount_6m_percent" numeric DEFAULT 0,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."profiles" (
  "admin_notes" text,
  "admin_notes_urgent" boolean DEFAULT false,
  "balance" numeric DEFAULT 0,
  "balance_frozen" boolean DEFAULT false,
  "billing_cycle_started_at" date,
  "billing_due_date_id" uuid,
  "billing_first_cycle_paid" boolean DEFAULT false,
  "billing_first_cycle_prorated_amount" numeric DEFAULT 0,
  "billing_grace_days_override" numeric DEFAULT 0,
  "billing_proportional_enabled" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "credit_purchases_blocked" boolean DEFAULT false,
  "credits" integer DEFAULT 0,
  "daily_credits_purchased" integer DEFAULT 0,
  "daily_purchase_date" date,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "iptv_app" text,
  "iptv_client_code" text,
  "iptv_connections" integer DEFAULT 0,
  "iptv_due_day" integer DEFAULT 0,
  "iptv_expiry" date,
  "iptv_monthly_value" numeric DEFAULT 0,
  "iptv_password" text,
  "iptv_server" text,
  "iptv_status" text,
  "iptv_status_before_event" text,
  "iptv_tv_app" text,
  "iptv_user" text,
  "level_points" integer DEFAULT 0,
  "name" text,
  "pix_key" text,
  "referral_code" text,
  "referred_by" text,
  "status" text,
  "total_earned" numeric DEFAULT 0,
  "updated_at" timestamptz DEFAULT now(),
  "user_level" text,
  "username" text,
  "vip_badge" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."push_notifications" (
  "body" text,
  "created_at" timestamptz DEFAULT now(),
  "failed_count" integer DEFAULT 0,
  "icon" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sent_by" text,
  "sent_count" integer DEFAULT 0,
  "target_ids" text[],
  "target_type" text,
  "title" text
);

CREATE TABLE IF NOT EXISTS public."push_subscriptions" (
  "auth" text,
  "created_at" timestamptz DEFAULT now(),
  "endpoint" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "p256dh" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."push_vapid_keys" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "private_key" text,
  "public_key" text
);

CREATE TABLE IF NOT EXISTS public."referrals" (
  "bonus_payment_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "first_payment_id" uuid,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notes" text,
  "referred_id" uuid,
  "referrer_id" uuid,
  "reward_amount" numeric DEFAULT 0,
  "reward_months" numeric DEFAULT 0,
  "reward_type" text,
  "rewarded_at" timestamptz,
  "approved_at" timestamptz,
  "status" text
);
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "approved_at" timestamptz;

CREATE TABLE IF NOT EXISTS public."scheduled_notifications" (
  "body_template" text,
  "click_action" text,
  "click_banner_id" uuid,
  "click_text_body" text,
  "click_text_title" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "failed_count" integer DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "schedule_at" timestamptz,
  "sent_at" timestamptz DEFAULT now(),
  "sent_count" integer DEFAULT 0,
  "status" text,
  "target_ids" text[],
  "target_type" text,
  "title_template" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."support_settings" (
  "assist_plus_provider" text,
  "blessed_player_provider" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "support_name" text,
  "support_phone" text,
  "support_photo_url" text,
  "updated_at" timestamptz DEFAULT now(),
  "whatsapp_link" text
);

CREATE TABLE IF NOT EXISTS public."tv_channels" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "logo_url" text,
  "name" text,
  "sort_order" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."tv_programs" (
  "category" text,
  "channel_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "end_time" text,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "is_active" boolean DEFAULT false,
  "is_highlight" boolean DEFAULT false,
  "name" text,
  "program_date" text,
  "start_time" text,
  "thumbnail_url" text
);

CREATE TABLE IF NOT EXISTS public."user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "role" public.app_role,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."withdrawals" (
  "admin_notes" text,
  "amount" numeric DEFAULT 0,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pix_key" text,
  "processed_at" timestamptz,
  "receipt_url" text,
  "requested_at" timestamptz DEFAULT now(),
  "status" text,
  "user_id" uuid
);

-- Índices/únicos principais
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_key ON public.user_roles (user_id, role);


CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS TABLE(login_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(NULLIF(iptv_user, ''), username) LIKE '%@%' THEN COALESCE(NULLIF(iptv_user, ''), username)
    ELSE COALESCE(NULLIF(iptv_user, ''), username) || '@iptv.bitz'
  END AS login_email
  FROM public.profiles
  WHERE lower(username) = lower(trim(p_identifier))
     OR lower(iptv_user) = lower(trim(p_identifier))
  ORDER BY created_at DESC
  LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION public.auto_block_overdue_clients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Função compatível para não quebrar o painel.
  -- O bloqueio automático pode ser refinado depois, sem afetar a migração.
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referrals_with_names()
RETURNS TABLE(
  id uuid,
  referrer_id uuid,
  referred_id uuid,
  reward_amount numeric,
  status text,
  created_at timestamptz,
  approved_at timestamptz,
  referred_name text,
  referred_username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.referrer_id, r.referred_id, r.reward_amount, r.status, r.created_at, r.approved_at,
         p.name AS referred_name, p.username AS referred_username
  FROM public.referrals r
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_referrer_by_code(p_user_id uuid, p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas admin');
  END IF;

  SELECT id INTO v_referrer FROM public.profiles
  WHERE upper(referral_code) = upper(trim(p_referral_code))
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código não encontrado');
  END IF;

  UPDATE public.profiles SET referred_by = v_referrer WHERE id = p_user_id;

  INSERT INTO public.referrals (referrer_id, referred_id, reward_amount, status)
  VALUES (v_referrer, p_user_id, 0, 'pending')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public."admin_audit_logs" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_admin_audit_logs" ON public."admin_audit_logs" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."announcement_dismissals" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_announcement_dismissals" ON public."announcement_dismissals" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_announcement_dismissals" ON public."announcement_dismissals" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_announcement_dismissals" ON public."announcement_dismissals" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_announcement_dismissals" ON public."announcement_dismissals" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."announcements" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_announcements" ON public."announcements" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_announcements" ON public."announcements" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."balance_history" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_balance_history" ON public."balance_history" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_balance_history" ON public."balance_history" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_balance_history" ON public."balance_history" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_balance_history" ON public."balance_history" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."billing_due_dates" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_billing_due_dates" ON public."billing_due_dates" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_billing_due_dates" ON public."billing_due_dates" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."challenge_attempts" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_challenge_attempts" ON public."challenge_attempts" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_challenge_attempts" ON public."challenge_attempts" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_challenge_attempts" ON public."challenge_attempts" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_challenge_attempts" ON public."challenge_attempts" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."content" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_content" ON public."content" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_content" ON public."content" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_challenges" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_challenges" ON public."credit_challenges" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_credit_challenges" ON public."credit_challenges" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_packages" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_packages" ON public."credit_packages" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_credit_packages" ON public."credit_packages" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_promotions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_promotions" ON public."credit_promotions" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_purchases" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_purchases" ON public."credit_purchases" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_credit_purchases" ON public."credit_purchases" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_credit_purchases" ON public."credit_purchases" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_credit_purchases" ON public."credit_purchases" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_rankings" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_rankings" ON public."credit_rankings" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_credit_rankings" ON public."credit_rankings" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_credit_rankings" ON public."credit_rankings" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_credit_rankings" ON public."credit_rankings" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_settings" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_settings" ON public."credit_settings" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_credit_settings" ON public."credit_settings" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."credit_transactions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_credit_transactions" ON public."credit_transactions" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_credit_transactions" ON public."credit_transactions" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_credit_transactions" ON public."credit_transactions" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_credit_transactions" ON public."credit_transactions" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."custom_variables" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_custom_variables" ON public."custom_variables" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."game_memory_sessions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_game_memory_sessions" ON public."game_memory_sessions" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_game_memory_sessions" ON public."game_memory_sessions" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_game_memory_sessions" ON public."game_memory_sessions" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_game_memory_sessions" ON public."game_memory_sessions" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."game_memory_settings" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_game_memory_settings" ON public."game_memory_settings" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_game_memory_settings" ON public."game_memory_settings" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."game_overrides" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_game_overrides" ON public."game_overrides" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_game_overrides" ON public."game_overrides" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_game_overrides" ON public."game_overrides" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_game_overrides" ON public."game_overrides" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_game_overrides" ON public."game_overrides" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."iptv_cancellation_requests" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_iptv_cancellation_requests" ON public."iptv_cancellation_requests" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_iptv_cancellation_requests" ON public."iptv_cancellation_requests" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_iptv_cancellation_requests" ON public."iptv_cancellation_requests" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_iptv_cancellation_requests" ON public."iptv_cancellation_requests" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."iptv_payments" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_iptv_payments" ON public."iptv_payments" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_iptv_payments" ON public."iptv_payments" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_iptv_payments" ON public."iptv_payments" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_iptv_payments" ON public."iptv_payments" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."iptv_scheduled_rates" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_iptv_scheduled_rates" ON public."iptv_scheduled_rates" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_iptv_scheduled_rates" ON public."iptv_scheduled_rates" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_iptv_scheduled_rates" ON public."iptv_scheduled_rates" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_iptv_scheduled_rates" ON public."iptv_scheduled_rates" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."iptv_servers" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_iptv_servers" ON public."iptv_servers" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_iptv_servers" ON public."iptv_servers" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."iptv_trust_requests" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_iptv_trust_requests" ON public."iptv_trust_requests" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_iptv_trust_requests" ON public."iptv_trust_requests" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_iptv_trust_requests" ON public."iptv_trust_requests" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_iptv_trust_requests" ON public."iptv_trust_requests" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."iptv_tv_apps" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_iptv_tv_apps" ON public."iptv_tv_apps" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_iptv_tv_apps" ON public."iptv_tv_apps" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."login_logs" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_login_logs" ON public."login_logs" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_login_logs" ON public."login_logs" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_login_logs" ON public."login_logs" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_login_logs" ON public."login_logs" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."mission_completions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_mission_completions" ON public."mission_completions" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_mission_completions" ON public."mission_completions" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_mission_completions" ON public."mission_completions" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_mission_completions" ON public."mission_completions" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."missions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_missions" ON public."missions" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."notification_rules" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_notification_rules" ON public."notification_rules" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_notification_rules" ON public."notification_rules" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."notification_views" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_notification_views" ON public."notification_views" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_notification_views" ON public."notification_views" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_notification_views" ON public."notification_views" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_notification_views" ON public."notification_views" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."platform_settings" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_platform_settings" ON public."platform_settings" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_platform_settings" ON public."platform_settings" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_profiles" ON public."profiles" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_profiles_own_select" ON public."profiles" FOR SELECT TO authenticated USING (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_profiles_own_update" ON public."profiles" FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."push_notifications" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_push_notifications" ON public."push_notifications" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."push_subscriptions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_push_subscriptions" ON public."push_subscriptions" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_push_subscriptions" ON public."push_subscriptions" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_push_subscriptions" ON public."push_subscriptions" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_push_subscriptions" ON public."push_subscriptions" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."push_vapid_keys" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_push_vapid_keys" ON public."push_vapid_keys" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_push_vapid_keys" ON public."push_vapid_keys" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."referrals" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_referrals" ON public."referrals" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."scheduled_notifications" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_scheduled_notifications" ON public."scheduled_notifications" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."support_settings" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_support_settings" ON public."support_settings" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_support_settings" ON public."support_settings" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."tv_channels" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_tv_channels" ON public."tv_channels" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_tv_channels" ON public."tv_channels" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."tv_programs" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_tv_programs" ON public."tv_programs" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_public_select_tv_programs" ON public."tv_programs" FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_user_roles" ON public."user_roles" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_user_roles_own_select" ON public."user_roles" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public."withdrawals" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "wmc_admin_all_withdrawals" ON public."withdrawals" FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_select_withdrawals" ON public."withdrawals" FOR SELECT TO authenticated USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_insert_withdrawals" ON public."withdrawals" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "wmc_own_update_withdrawals" ON public."withdrawals" FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true), ('tv-logos', 'tv-logos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$ BEGIN
  CREATE POLICY "wmc_public_read_storage" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id IN ('banners','tv-logos'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "wmc_admin_storage_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('banners','tv-logos') AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id IN ('banners','tv-logos') AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
