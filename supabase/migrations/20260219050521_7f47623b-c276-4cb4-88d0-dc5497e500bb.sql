
-- Table to track trust unlock requests
CREATE TABLE public.iptv_trust_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, expired
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  trust_expires_at DATE, -- 3 days after approval
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_trust_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on trust_requests" ON public.iptv_trust_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own trust_requests" ON public.iptv_trust_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own trust_requests" ON public.iptv_trust_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Enable realtime for trust requests (admin needs to see new requests)
ALTER PUBLICATION supabase_realtime ADD TABLE public.iptv_trust_requests;
