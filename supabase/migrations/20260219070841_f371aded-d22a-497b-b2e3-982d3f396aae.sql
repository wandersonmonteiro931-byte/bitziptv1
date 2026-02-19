
-- Add column to store previous status before server events (maintenance/instability)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS iptv_status_before_event text DEFAULT '';
