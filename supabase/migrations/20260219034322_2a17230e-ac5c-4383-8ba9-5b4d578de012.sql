
-- Table for admin-configurable notification rules
CREATE TABLE public.notification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_event TEXT NOT NULL,
  -- trigger_event values:
  -- 'payment_received' - when PIX payment is confirmed
  -- 'activation_confirmed' - when admin confirms activation
  -- 'expiry_approaching' - X days before expiry (cron)
  -- 'user_blocked' - when user gets blocked
  -- 'user_activated' - when user status changes to active
  -- 'manual' - triggered manually by admin
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- conditions examples:
  -- { "days_before_expiry": 5 } for expiry_approaching
  -- { "cron_hour": 12 } for time-based triggers
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  -- Template variables: {nome}, {validade}, {valor}, {servidor}, {plano_meses}, {data_pagamento}
  click_url TEXT NOT NULL DEFAULT '/',
  icon TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on notification_rules"
ON public.notification_rules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_notification_rules_updated_at
BEFORE UPDATE ON public.notification_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Seed default rules based on current hardcoded notifications
INSERT INTO public.notification_rules (name, trigger_event, conditions, title_template, body_template, click_url, description) VALUES
('Pagamento Recebido', 'payment_received', '{}', '💰 Pagamento Recebido!', 'Olá {nome}! Recebemos seu pagamento via PIX. Aguarde a ativação pelo suporte.', '/', 'Enviado automaticamente quando o pagamento PIX é confirmado.'),
('Aguardando Suporte', 'payment_received', '{"delay_seconds": 2}', '⏳ Aguardando Suporte', 'Seu pagamento de R$ {valor} está sendo processado. A ativação será feita em até 24h.', '/', 'Segunda notificação após pagamento confirmado.'),
('Servidor Atualizado', 'activation_confirmed', '{}', '✅ Servidor Atualizado!', 'Olá {nome}! Seu plano foi ativado com sucesso! Nova validade: {validade}', '/', 'Enviado quando o admin confirma a ativação no servidor.'),
('Lembrete de Vencimento', 'expiry_approaching', '{"days_before_expiry": 5}', '⚠️ Vencimento Próximo!', 'Olá {nome}! Seu plano vence em {validade}. Renove agora para não perder o acesso!', '/iptv', 'Enviado 5 dias antes do vencimento, diariamente às 12:00.'),
('Usuário Bloqueado', 'user_blocked', '{}', '🔒 Acesso Bloqueado', 'Olá {nome}, seu acesso foi bloqueado por falta de pagamento. Renove seu plano para continuar assistindo.', '/iptv', 'Enviado quando o usuário é bloqueado automaticamente.');
