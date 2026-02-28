
-- Add provider fields to support_settings
ALTER TABLE public.support_settings
ADD COLUMN assist_plus_provider text NOT NULL DEFAULT '',
ADD COLUMN blessed_player_provider text NOT NULL DEFAULT '';
