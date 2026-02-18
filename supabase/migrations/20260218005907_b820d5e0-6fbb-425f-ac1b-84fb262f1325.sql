
-- Add banner-specific columns to content table
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS redirect_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS starts_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS ends_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
