-- Table for admin to manipulate/force game results
CREATE TABLE public.game_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_type text NOT NULL DEFAULT 'all', -- 'all', 'prize_box', 'scratch_card', or specific challenge_id
  forced_result jsonb NOT NULL DEFAULT '{}', -- { "prize_key": "r100", "reward_type": "balance", "result": 100, "label": "R$ 100" }
  uses_remaining integer NOT NULL DEFAULT 1, -- how many times this override applies, 0 = unlimited
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT ''
);

ALTER TABLE public.game_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on game_overrides"
  ON public.game_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_game_overrides_user ON public.game_overrides(user_id, is_active);
