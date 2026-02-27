
-- Announcements table (avisos do admin exibidos ao abrir o app)
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  banner_url TEXT DEFAULT '',
  announcement_type TEXT NOT NULL DEFAULT 'text', -- 'text' or 'banner'
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all' or 'specific'
  target_ids UUID[] DEFAULT '{}'::uuid[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  schedule_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track which users have dismissed each announcement
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Announcements policies
CREATE POLICY "Admin full access on announcements"
  ON public.announcements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true);

-- Dismissals policies
CREATE POLICY "Admin full access on announcement_dismissals"
  ON public.announcement_dismissals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own dismissals"
  ON public.announcement_dismissals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own dismissals"
  ON public.announcement_dismissals FOR SELECT
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
