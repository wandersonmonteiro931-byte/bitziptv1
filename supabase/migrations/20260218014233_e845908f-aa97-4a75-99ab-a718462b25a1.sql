
-- Memory game sessions
CREATE TABLE public.game_memory_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_seconds INTEGER,
  pairs_found INTEGER DEFAULT 0,
  won BOOLEAN DEFAULT false,
  reward_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_memory_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own memory sessions" ON public.game_memory_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own memory sessions" ON public.game_memory_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin full access memory sessions" ON public.game_memory_sessions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Memory game settings (admin controlled)
CREATE TABLE public.game_memory_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  reward_amount NUMERIC DEFAULT 1.50,
  daily_limit INTEGER DEFAULT 1,
  time_limit_seconds INTEGER DEFAULT 60,
  memorize_seconds INTEGER DEFAULT 5,
  min_time_seconds INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.game_memory_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read memory settings" ON public.game_memory_settings
  FOR SELECT USING (true);

CREATE POLICY "Admin manages memory settings" ON public.game_memory_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.game_memory_settings (reward_amount, daily_limit, time_limit_seconds, memorize_seconds, min_time_seconds)
VALUES (1.50, 1, 60, 5, 10);

-- Enable realtime for sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_memory_sessions;
