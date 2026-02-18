
-- Add subtitle and click_count to content table
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS subtitle text DEFAULT '';
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0;

-- Create storage bucket for banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view banner images
CREATE POLICY "Public read banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');

-- Allow admins to manage banner images
CREATE POLICY "Admin manage banners" ON storage.objects FOR ALL USING (
  bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin')
);
