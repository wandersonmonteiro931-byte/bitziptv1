
-- Add balance_frozen column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance_frozen boolean NOT NULL DEFAULT false;

-- Enable realtime for profiles and balance_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_history;
