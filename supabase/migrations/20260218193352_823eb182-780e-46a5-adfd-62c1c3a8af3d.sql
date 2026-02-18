
-- Table to track IPTV payment history per client
CREATE TABLE public.iptv_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  months INTEGER NOT NULL DEFAULT 1,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  admin_id UUID REFERENCES public.profiles(id),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.iptv_payments ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access iptv_payments"
ON public.iptv_payments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view own payments
CREATE POLICY "Users view own iptv_payments"
ON public.iptv_payments
FOR SELECT
USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_iptv_payments_user_id ON public.iptv_payments(user_id);
CREATE INDEX idx_iptv_payments_period_end ON public.iptv_payments(period_end);
