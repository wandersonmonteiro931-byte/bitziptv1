
-- Add PIX-related columns to iptv_payments
ALTER TABLE public.iptv_payments
  ADD COLUMN IF NOT EXISTS pix_txid text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pix_location text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pix_copia_cola text DEFAULT NULL;
