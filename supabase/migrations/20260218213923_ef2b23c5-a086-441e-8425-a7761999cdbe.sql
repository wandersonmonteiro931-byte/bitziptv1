-- Allow authenticated users to insert their own iptv_payments (for PIX self-checkout)
CREATE POLICY "Users can create own iptv_payments"
ON public.iptv_payments
FOR INSERT
WITH CHECK (user_id = auth.uid());
