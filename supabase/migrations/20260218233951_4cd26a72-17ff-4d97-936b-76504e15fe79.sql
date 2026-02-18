-- Allow users to delete their own pending payments (PIX not paid = no record)
CREATE POLICY "Users can delete own pending iptv_payments"
ON public.iptv_payments
FOR DELETE
USING (user_id = auth.uid() AND status = 'pending');
