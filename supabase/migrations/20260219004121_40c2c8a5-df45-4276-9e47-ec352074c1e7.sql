
-- Table to store VAPID keys (generated once by the system)
CREATE TABLE public.push_vapid_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.push_vapid_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on push_vapid_keys"
  ON public.push_vapid_keys FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read public key only (needed for subscribing)
CREATE POLICY "Authenticated can read vapid public key"
  ON public.push_vapid_keys FOR SELECT
  USING (true);

-- Table to store push subscriptions per user/device
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admin full access on push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table to log sent notifications
CREATE TABLE public.push_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'user', 'segment'
  target_ids UUID[] DEFAULT '{}',
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  sent_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on push_notifications"
  ON public.push_notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
