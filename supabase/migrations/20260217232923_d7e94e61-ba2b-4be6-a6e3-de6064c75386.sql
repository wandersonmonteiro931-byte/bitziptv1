
-- Add IPTV-specific fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iptv_monthly_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iptv_connections integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS iptv_tv_app text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS iptv_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS iptv_due_day integer NOT NULL DEFAULT 10;

-- Create support settings table
CREATE TABLE public.support_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_name text NOT NULL DEFAULT 'Wanderson Camargo',
  support_phone text NOT NULL DEFAULT '(62) 99565-7915',
  support_photo_url text DEFAULT '',
  whatsapp_link text NOT NULL DEFAULT 'https://wa.me/5562995657915',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages support_settings" ON public.support_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read support_settings" ON public.support_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.support_settings (support_name, support_phone, whatsapp_link)
VALUES ('Wanderson Camargo', '(62) 99565-7915', 'https://wa.me/5562995657915');

-- Create IPTV servers reference table
CREATE TABLE public.iptv_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages iptv_servers" ON public.iptv_servers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read iptv_servers" ON public.iptv_servers
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.iptv_servers (name, sort_order) VALUES
  ('LIVE', 1), ('DYNAMIX', 2), ('SPACE', 3), ('7PLAY', 4),
  ('TECK', 5), ('LIVE – STREAM', 6), ('MAX PLAYER – SPACE', 7),
  ('MAXPLAYER – LIVE STREAM', 8);

-- Create TV apps reference table  
CREATE TABLE public.iptv_tv_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📺',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_tv_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages iptv_tv_apps" ON public.iptv_tv_apps
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read iptv_tv_apps" ON public.iptv_tv_apps
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.iptv_tv_apps (name, icon, sort_order) VALUES
  ('Blessed Player', '🎬', 1), ('Max Player', '📺', 2),
  ('Assist Plus', '🔧', 3), ('Smarters PRO', '⭐', 4);

-- Enable realtime for new tables only
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_settings;
