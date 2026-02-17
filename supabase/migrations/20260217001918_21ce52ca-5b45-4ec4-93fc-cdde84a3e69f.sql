
-- =============================================
-- SISTEMA DE CRÉDITOS INTERNOS
-- =============================================

-- 1. Adicionar coluna de créditos ao profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_purchases_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_badge boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_level text NOT NULL DEFAULT 'bronze';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_credits_purchased integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_purchase_date date;

-- 2. Pacotes de créditos (admin configura)
CREATE TABLE public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price numeric(10,2) NOT NULL,
  bonus_credits integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages credit_packages" ON public.credit_packages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view active packages" ON public.credit_packages FOR SELECT USING (is_active = true);

-- 3. Transações de créditos (histórico completo)
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'purchase', 'challenge_bet', 'challenge_win', 'bonus', 'admin_adjust', 'mission_turbo', 'surprise_box'
  amount integer NOT NULL, -- positivo = ganhou, negativo = gastou
  balance_after integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  admin_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access credit_transactions" ON public.credit_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own credit_transactions" ON public.credit_transactions FOR SELECT USING (user_id = auth.uid());

-- 4. Compras de créditos (pedidos PIX)
CREATE TABLE public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.credit_packages(id),
  credits_amount integer NOT NULL,
  bonus_amount integer NOT NULL DEFAULT 0,
  price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
  pix_code text,
  confirmed_at timestamptz,
  admin_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access credit_purchases" ON public.credit_purchases FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own purchases" ON public.credit_purchases FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create purchases" ON public.credit_purchases FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. Configuração de desafios (admin define probabilidades)
CREATE TABLE public.credit_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  challenge_type text NOT NULL, -- 'multiplier', 'surprise_box', 'mission_turbo'
  cost_credits integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🎯',
  -- probabilidades em JSON: [{"result": 0, "weight": 50}, {"result": 2, "weight": 25}, ...]
  probabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- para mission_turbo: multiplicador e duração
  turbo_multiplier numeric(3,1) DEFAULT 1.5,
  turbo_duration_minutes integer DEFAULT 30,
  min_level text NOT NULL DEFAULT 'bronze',
  daily_limit integer NOT NULL DEFAULT 0, -- 0 = sem limite
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages challenges" ON public.credit_challenges FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated view active challenges" ON public.credit_challenges FOR SELECT USING (is_active = true);

-- 6. Tentativas de desafios (resultados)
CREATE TABLE public.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.credit_challenges(id),
  credits_spent integer NOT NULL,
  credits_won integer NOT NULL DEFAULT 0,
  result_label text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access attempts" ON public.challenge_attempts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own attempts" ON public.challenge_attempts FOR SELECT USING (user_id = auth.uid());

-- 7. Promoções temporárias
CREATE TABLE public.credit_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  bonus_percentage integer NOT NULL DEFAULT 0, -- ex: 50 = +50% de bônus
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages promotions" ON public.credit_promotions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated view active promotions" ON public.credit_promotions FOR SELECT USING (is_active = true);

-- 8. Ranking mensal
CREATE TABLE public.credit_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- '2026-02'
  total_credits_used integer NOT NULL DEFAULT 0,
  total_credits_won integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  rank_position integer,
  bonus_awarded numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

ALTER TABLE public.credit_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access rankings" ON public.credit_rankings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated view rankings" ON public.credit_rankings FOR SELECT USING (true);

-- 9. Configurações do sistema de créditos
CREATE TABLE public.credit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_purchase_limit integer NOT NULL DEFAULT 500,
  vip_threshold integer NOT NULL DEFAULT 200, -- créditos comprados pra ganhar VIP
  level_thresholds jsonb NOT NULL DEFAULT '{"bronze": 0, "prata": 100, "ouro": 500, "diamante": 2000}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages credit_settings" ON public.credit_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read credit_settings" ON public.credit_settings FOR SELECT USING (true);

-- Inserir configuração padrão
INSERT INTO public.credit_settings (daily_purchase_limit, vip_threshold) VALUES (500, 200);

-- 10. Triggers de updated_at
CREATE TRIGGER update_credit_packages_updated_at BEFORE UPDATE ON public.credit_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_credit_challenges_updated_at BEFORE UPDATE ON public.credit_challenges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_credit_rankings_updated_at BEFORE UPDATE ON public.credit_rankings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_credit_settings_updated_at BEFORE UPDATE ON public.credit_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 11. Realtime para créditos
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_attempts;

-- 12. Inserir pacotes padrão
INSERT INTO public.credit_packages (name, credits, price, bonus_credits, sort_order) VALUES
  ('Pacote Básico', 10, 5.00, 0, 1),
  ('Pacote Popular', 50, 20.00, 5, 2),
  ('Pacote Premium', 100, 35.00, 15, 3);

-- 13. Inserir desafios padrão
INSERT INTO public.credit_challenges (name, challenge_type, cost_credits, description, icon, probabilities, min_level) VALUES
  ('Desafio Multiplicador', 'multiplier', 1, 'Aposte 1 crédito e tente multiplicar!', '🎯',
   '[{"result": 0, "weight": 45, "label": "Nada"}, {"result": 2, "weight": 30, "label": "2x"}, {"result": 3, "weight": 15, "label": "3x"}, {"result": 5, "weight": 10, "label": "5x"}]',
   'bronze'),
  ('Caixa Surpresa', 'surprise_box', 5, 'Abra a caixa e descubra seu prêmio!', '🎁',
   '[{"result": 0, "weight": 30, "label": "Vazio"}, {"result": 3, "weight": 25, "label": "+3 créditos"}, {"result": 7, "weight": 20, "label": "+7 créditos"}, {"result": 12, "weight": 15, "label": "+12 créditos"}, {"result": 20, "weight": 10, "label": "+20 créditos"}]',
   'bronze'),
  ('Missão Turbo', 'mission_turbo', 10, 'Ative o turbo e ganhe 1.5x nas missões por 30 min!', '🚀',
   '[{"result": 1, "weight": 100, "label": "Turbo Ativado"}]',
   'prata');

-- 14. Índices para performance
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_purchases_user ON public.credit_purchases(user_id, created_at DESC);
CREATE INDEX idx_challenge_attempts_user ON public.challenge_attempts(user_id, created_at DESC);
CREATE INDEX idx_credit_rankings_month ON public.credit_rankings(month_year, total_credits_used DESC);
