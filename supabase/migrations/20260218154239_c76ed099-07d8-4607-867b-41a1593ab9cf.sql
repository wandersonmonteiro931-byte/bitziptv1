
-- TV Channels table
CREATE TABLE public.tv_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tv_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages tv_channels" ON public.tv_channels FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read tv_channels" ON public.tv_channels FOR SELECT USING (true);

-- TV Programs table
CREATE TABLE public.tv_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  program_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  description TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  is_highlight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tv_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages tv_programs" ON public.tv_programs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read active tv_programs" ON public.tv_programs FOR SELECT USING (is_active = true);

-- Index for fast lookups
CREATE INDEX idx_tv_programs_date_channel ON public.tv_programs(program_date, channel_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_programs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tv_channels;

-- Storage bucket for channel logos
INSERT INTO storage.buckets (id, name, public) VALUES ('tv-logos', 'tv-logos', true);

CREATE POLICY "Admin upload tv logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tv-logos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin update tv logos" ON storage.objects FOR UPDATE USING (bucket_id = 'tv-logos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin delete tv logos" ON storage.objects FOR DELETE USING (bucket_id = 'tv-logos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read tv logos" ON storage.objects FOR SELECT USING (bucket_id = 'tv-logos');
