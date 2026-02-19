
-- Table to store scheduled future rate changes per user
CREATE TABLE public.iptv_scheduled_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  new_monthly_value NUMERIC NOT NULL,
  effective_date DATE NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMP WITH TIME ZONE,
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.iptv_scheduled_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on iptv_scheduled_rates"
  ON public.iptv_scheduled_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_scheduled_rates_user ON public.iptv_scheduled_rates(user_id, effective_date);
CREATE INDEX idx_scheduled_rates_pending ON public.iptv_scheduled_rates(applied, effective_date);
