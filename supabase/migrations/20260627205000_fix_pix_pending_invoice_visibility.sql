-- PIX gerado sem pagamento não deve aparecer como fatura pendente no painel.
-- Ele continua oculto apenas para rastrear o txid até a confirmação da Efí.
UPDATE public.iptv_payments
SET status = 'pix_pending'
WHERE status = 'pending'
  AND pix_txid IS NOT NULL;

DROP POLICY IF EXISTS "Users can delete own pix_pending iptv_payments" ON public.iptv_payments;

CREATE POLICY "Users can delete own pix_pending iptv_payments"
ON public.iptv_payments
FOR DELETE
USING (user_id = auth.uid() AND status = 'pix_pending');
