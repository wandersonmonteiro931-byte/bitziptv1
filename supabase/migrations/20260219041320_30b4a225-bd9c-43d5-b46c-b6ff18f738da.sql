
-- Add PIX Efi columns to credit_purchases for real PIX integration
ALTER TABLE public.credit_purchases ADD COLUMN IF NOT EXISTS pix_txid text;
ALTER TABLE public.credit_purchases ADD COLUMN IF NOT EXISTS pix_location text;
ALTER TABLE public.credit_purchases ADD COLUMN IF NOT EXISTS pix_qrcode text;
