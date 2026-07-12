import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarCheck, CheckCircle, Clock, Copy, Gift, Share2, Users, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBRT } from "@/lib/utils";

type ReferralSettings = {
  is_active: boolean;
  default_reward_months: number;
  updated_at?: string | null;
};

type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: "pending" | "converted" | "rewarded" | "rejected" | "expired" | string;
  reward_months: number;
  first_payment_id?: string | null;
  converted_at?: string | null;
  rewarded_at?: string | null;
  reward_period_start?: string | null;
  reward_period_end?: string | null;
  reward_message?: string | null;
  notes?: string | null;
  created_at: string;
  payment_deadline?: string | null;
  reward_reversed_at?: string | null;
  reward_reversal_reason?: string | null;
  referred_name?: string | null;
  referred_username?: string | null;
  referred_iptv_user?: string | null;
};

const formatDateOnlyBR = (value?: string | null) => {
  if (!value) return "";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const normalizeStatus = (status: string) => (status === "approved" ? "rewarded" : status);

const ReferralsPage = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [settings, setSettings] = useState<ReferralSettings>({ is_active: true, default_reward_months: 1 });
  const [loadError, setLoadError] = useState("");

  const loadReferrals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError("");

    await (supabase as any).rpc("refresh_my_referral_deadlines");
    const { data, error } = await (supabase as any).rpc("get_my_referral_dashboard");

    if (error) {
      console.error("Erro ao carregar indicações:", error);
      setReferrals([]);
      setLoadError("Não foi possível carregar suas indicações. Confirme se o SQL da versão foi executado.");
      setLoading(false);
      return;
    }

    const payload = data || {};
    setSettings({
      is_active: payload?.settings?.is_active !== false,
      default_reward_months: Math.max(1, Number(payload?.settings?.default_reward_months || 1)),
      updated_at: payload?.settings?.updated_at || null,
    });
    setReferrals(Array.isArray(payload?.referrals) ? payload.referrals : []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void loadReferrals();

    const onReferralCommand = () => void loadReferrals();
    const onFinanceCommand = (event: Event) => {
      const payload = (event as CustomEvent)?.detail;
      if (!payload?.user_id || payload.user_id === user.id) void loadReferrals();
    };

    window.addEventListener("wmcplayer-referrals-updated", onReferralCommand);
    window.addEventListener("wmcplayer-finance-updated", onFinanceCommand);

    return () => {
      window.removeEventListener("wmcplayer-referrals-updated", onReferralCommand);
      window.removeEventListener("wmcplayer-finance-updated", onFinanceCommand);
    };
  }, [user?.id, loadReferrals]);

  const copyCode = () => {
    if (!settings.is_active || !user?.referral_code) return;
    navigator.clipboard.writeText(user.referral_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const metrics = useMemo(() => {
    const normalized = referrals.map((item) => ({ ...item, status: normalizeStatus(item.status) }));
    const converted = normalized.filter((item) => item.status === "converted" || item.status === "rewarded").length;
    const rewarded = normalized.filter((item) => item.status === "rewarded");
    const months = rewarded.reduce((sum, item) => sum + Math.max(1, Number(item.reward_months || 1)), 0);
    return {
      total: normalized.length,
      pending: normalized.filter((item) => item.status === "pending").length,
      converted,
      months,
    };
  }, [referrals]);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="text-red-500" /> Indicações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {settings.is_active
            ? `Indique clientes com seu código único e ganhe ${settings.default_reward_months} mês grátis quando cada indicado realizar o primeiro pagamento.`
            : "Promoção encerrada."}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl border border-red-500/20 bg-card/70 p-6 text-center shadow-lg shadow-red-500/5"
      >
        {settings.is_active ? (
          <>
            <Share2 size={32} className="mx-auto mb-3 text-red-500" />
            <h2 className="mb-1 font-display text-sm tracking-wider text-muted-foreground">
              SEU CÓDIGO ÚNICO DE INDICAÇÃO
            </h2>
            <p className="mb-2 font-display text-3xl font-bold text-red-500">{user?.referral_code || "—"}</p>
            <button
              onClick={copyCode}
              disabled={!user?.referral_code}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500 active:scale-[0.98] disabled:opacity-50"
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied ? "Copiado!" : "Copiar código"}
            </button>
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-border/60 bg-background/40 p-3 text-left text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Regras da promoção:</strong> informe este código para o novo cliente antes do cadastro. O indicado terá <strong className="text-red-300">10 dias corridos</strong> após a indicação para realizar o 1º pagamento. Se pagar dentro do prazo, você ganha <strong className="text-red-300">1 mês grátis</strong>, somado à sua data de vencimento atual, e o suporte será avisado para atualizar o servidor. Cada indicado válido concede 1 mês; 12 indicados válidos concedem 12 meses. Autoindicação é proibida e cada indicado só pode ter um indicador. Pagamentos revertidos, excluídos ou não confirmados cancelam automaticamente o prêmio. Pagamentos realizados após os 10 dias aparecem como <strong className="text-red-300">Não pago</strong> e não geram prêmio, mesmo que sejam pagos depois.
            </div>
          </>
        ) : (
          <div className="py-6">
            <Gift size={38} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">Promoção encerrada.</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Os códigos de indicação não estão aceitando novos vínculos neste momento. Seu histórico continua disponível abaixo.
            </p>
          </div>
        )}
      </motion.div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{metrics.converted}</p>
          <p className="text-xs text-muted-foreground">Convertidas</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{metrics.months}</p>
          <p className="text-xs text-muted-foreground">Meses grátis</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">SUAS INDICAÇÕES</h2>
          {metrics.pending > 0 && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
              {metrics.pending} aguardando pagamento
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando indicações...</p>}
        {!loading && loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && (
          <div className="space-y-3">
            {referrals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma indicação registrada. Quando um cliente for vinculado ao seu código, ele aparecerá aqui.
              </p>
            )}

            {referrals.map((ref) => {
              const status = normalizeStatus(ref.status);
              const rewarded = status === "rewarded";
              const converted = status === "converted";
              const rejected = status === "rejected";
              const expired = status === "expired";
              const displayName = ref.referred_name || ref.referred_username || "Cliente indicado";

              return (
                <div key={ref.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {rewarded ? (
                        <CalendarCheck size={18} className="mt-0.5 text-emerald-400" />
                      ) : rejected || expired ? (
                        <XCircle size={18} className="mt-0.5 text-destructive" />
                      ) : (
                        <Clock size={18} className={`mt-0.5 ${converted ? "text-blue-400" : "text-amber-400"}`} />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{displayName}</p>
                        <p className="text-xs text-muted-foreground">Indicado em {formatDateBRT(ref.created_at)}</p>
                        {ref.referred_iptv_user && (
                          <p className="text-[10px] text-muted-foreground/80">Usuário TV: {ref.referred_iptv_user}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        rewarded
                          ? "bg-emerald-500/10 text-emerald-400"
                          : converted
                            ? "bg-blue-500/10 text-blue-400"
                            : rejected
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {rewarded
                        ? `+${Math.max(1, Number(ref.reward_months || 1))} mês grátis`
                        : converted
                          ? "1º pagamento convertido"
                          : expired
                            ? "Não pago"
                            : rejected
                              ? "Recusada"
                              : "Aguardando 1º pagamento"}
                    </span>
                  </div>


                  {!rewarded && (
                    <div className="mt-3 rounded-xl border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">
                      <p>Prazo para o 1º pagamento: <strong className="text-foreground">{formatDateBRT(ref.payment_deadline || new Date(new Date(ref.created_at).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString())}</strong></p>
                      {ref.reward_reversal_reason && (
                        <p className="mt-1 text-destructive">Prêmio revertido: {ref.reward_reversal_reason}</p>
                      )}
                    </div>
                  )}

                  {rewarded && (
                    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs font-semibold leading-relaxed text-emerald-300">
                        {ref.reward_message ||
                          `Seu indicado realizou o 1° pagamento e você ganhou o próximo período de ${formatDateOnlyBR(ref.reward_period_start)} a ${formatDateOnlyBR(ref.reward_period_end)} gratuitamente! Obrigado por apoiar esse projeto!`}
                      </p>
                      {ref.first_payment_id && (
                        <p className="mt-1 text-[10px] text-muted-foreground">Pagamento gerador registrado no sistema.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ReferralsPage;
