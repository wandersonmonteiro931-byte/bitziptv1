import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Copy, CheckCircle, Clock, Share2, Gift, CalendarCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBRT } from "@/lib/utils";

const ReferralsPage = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);

  const loadReferrals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("referrals")
      .select("*, referred:profiles!referrals_referred_id_fkey(name, username, iptv_user)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });
    setReferrals(data || []);
  };

  useEffect(() => {
    if (!user) return;
    loadReferrals();

    const channel = supabase
      .channel(`referrals-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "referrals", filter: `referrer_id=eq.${user.id}` },
        () => loadReferrals(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const copyCode = () => {
    navigator.clipboard.writeText(user?.referral_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const approved = referrals.filter((r) => r.status === "approved").length;
  const pending = referrals.filter((r) => r.status === "pending").length;
  const freeMonths = referrals
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + Number(r.reward_months || 1), 0);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="text-red-500" /> Indicações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indique clientes com seu código único sequencial e ganhe 1 mês grátis no primeiro pagamento do indicado.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl border border-red-500/20 bg-card/70 p-6 text-center shadow-lg shadow-red-500/5"
      >
        <Share2 size={32} className="mx-auto mb-3 text-red-500" />
        <h2 className="mb-1 font-display text-sm tracking-wider text-muted-foreground">
          SEU CÓDIGO ÚNICO DE INDICAÇÃO
        </h2>
        <p className="mb-2 font-display text-3xl font-bold text-red-500">{user?.referral_code}</p>
        <p className="mb-4 text-[11px] text-muted-foreground">Formato sequencial: WMC001A, WMC002A, WMC003A...</p>
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500 active:scale-[0.98]"
        >
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied ? "Copiado!" : "Copiar código"}
        </button>
        <div className="mx-auto mt-4 max-w-xl rounded-xl border border-border/60 bg-background/40 p-3 text-left text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Como funciona:</strong> informe este código para o novo cliente. Quando
          ele realizar o primeiro pagamento, o sistema libera automaticamente{" "}
          <strong className="text-red-300">1 mês grátis</strong> para você no próximo período da sua assinatura.
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{approved}</p>
          <p className="text-xs text-muted-foreground">Convertidas</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{freeMonths}</p>
          <p className="text-xs text-muted-foreground">Meses grátis</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">SUAS INDICAÇÕES</h2>
        <div className="space-y-3">
          {referrals.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma indicação aguardando pagamento ainda. Quando um cliente for cadastrado usando seu código, ele
              aparecerá aqui como aguardando o 1º pagamento.
            </p>
          )}
          {referrals.map((ref) => {
            const approvedRef = ref.status === "approved";
            const rejectedRef = ref.status === "rejected";
            return (
              <div
                key={ref.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3"
              >
                <div className="flex items-center gap-3">
                  {approvedRef ? (
                    <CalendarCheck size={18} className="text-emerald-400" />
                  ) : rejectedRef ? (
                    <Clock size={18} className="text-muted-foreground" />
                  ) : (
                    <Clock size={18} className="text-amber-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ref.referred?.name || ref.referred?.username || "Cliente indicado"}
                    </p>
                    <p className="text-xs text-muted-foreground">Indicado em {formatDateBRT(ref.created_at)}</p>
                    {ref.rewarded_at && (
                      <p className="text-[10px] text-emerald-400">Bônus liberado em {formatDateBRT(ref.rewarded_at)}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${approvedRef ? "bg-emerald-500/10 text-emerald-400" : rejectedRef ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-400"}`}
                >
                  {approvedRef
                    ? `+${ref.reward_months || 1} mês grátis`
                    : rejectedRef
                      ? "Recusada"
                      : "Aguardando 1º pagamento"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default ReferralsPage;
