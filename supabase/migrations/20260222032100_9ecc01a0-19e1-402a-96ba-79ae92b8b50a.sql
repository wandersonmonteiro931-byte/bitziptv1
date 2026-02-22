
-- Table for saved/scheduled notifications
CREATE TABLE public.scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_template text NOT NULL,
  body_template text NOT NULL,
  click_action text NOT NULL DEFAULT '/',
  click_banner_id uuid REFERENCES public.content(id) ON DELETE SET NULL,
  click_text_title text DEFAULT '',
  click_text_body text DEFAULT '',
  schedule_at timestamptz,
  target_type text NOT NULL DEFAULT 'all',
  target_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT true,
  sent_at timestamptz,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on scheduled_notifications"
  ON public.scheduled_notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Table for tracking who viewed a notification popup
CREATE TABLE public.notification_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.scheduled_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE public.notification_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on notification_views"
  ON public.notification_views FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own notification_views"
  ON public.notification_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own notification_views"
  ON public.notification_views FOR SELECT
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_notifications;
