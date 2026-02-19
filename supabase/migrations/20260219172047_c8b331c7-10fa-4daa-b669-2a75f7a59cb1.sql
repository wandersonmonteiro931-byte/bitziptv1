
-- Table to track all login events with device info
CREATE TABLE public.login_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  device_type TEXT DEFAULT '',
  browser TEXT DEFAULT '',
  os TEXT DEFAULT ''
);

-- Enable RLS
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Admin can see all logs
CREATE POLICY "Admin full access on login_logs"
  ON public.login_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own logs
CREATE POLICY "Users can insert own login_logs"
  ON public.login_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view own login logs
CREATE POLICY "Users can view own login_logs"
  ON public.login_logs FOR SELECT
  USING (user_id = auth.uid());

-- Index for fast queries
CREATE INDEX idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX idx_login_logs_logged_in_at ON public.login_logs(logged_in_at DESC);
