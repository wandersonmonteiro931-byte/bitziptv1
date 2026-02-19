
-- Table for IPTV cancellation requests
CREATE TABLE public.iptv_cancellation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT NOT NULL DEFAULT '',
  admin_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.iptv_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on cancellation_requests"
  ON public.iptv_cancellation_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own cancellation_requests"
  ON public.iptv_cancellation_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own cancellation_requests"
  ON public.iptv_cancellation_requests FOR SELECT
  USING (user_id = auth.uid());
