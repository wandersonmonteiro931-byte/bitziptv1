
-- Add access data fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iptv_client_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS iptv_password text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_notes_urgent boolean NOT NULL DEFAULT false;
