
ALTER TABLE public.game_memory_settings
ADD COLUMN cost_per_game numeric NOT NULL DEFAULT 0.50;

UPDATE public.game_memory_settings SET cost_per_game = 0.50;
