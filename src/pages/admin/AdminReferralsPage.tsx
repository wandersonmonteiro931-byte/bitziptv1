import { AppLayout } from "@/components/AppLayout";
import { Gift, CheckCircle, Clock, XCircle, CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateBRT } from "@/lib/utils";

const AdminReferralsPage = () => {
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("referrals")
      .select(
        "*, referrer:profiles!referrals_referrer_id_fkey(name, username, iptv_expiry), referred:profiles!referrals_referred_id_fkey(name, username, iptv_user)",
      )
      .order("created_at", { ascending: false });
    setReferrals(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-referrals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("referrals").update({ status }).eq("id", id);
    toast({ title: `Indicação ${status === "approved" ? "aprovada" : "recusada"}` });
    load();
  };

  const approved = referrals.filter((r) => r.status === "approved").length;
  const pending = referrals.filter((r) => r.status === "pending").length;
  const freeMonths = referrals
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + Number(r.reward_months || 1), 0);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Gift className="text-red-500" /> Gerenciar Indicações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          1 mês grátis automático quando o indicado faz o primeiro pagamento.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">Indicações</p>
        </div>
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-400">{pending}</p>
          <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
        </div>
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{freeMonths}</p>
          <p className="text-xs text-muted-foreground">Meses grátis liberados</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="space-y-3">
          {referrals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma indicação registrada.</p>}
          {referrals.map((ref) => {
            const approvedRef = ref.status === "approved";
            const rejectedRef = ref.status === "rejected";
            return (
              <div
                key={ref.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  {approvedRef ? (
                    <CalendarCheck size={18} className="mt-0.5 text-emerald-400" />
                  ) : rejectedRef ? (
                    <XCircle size={18} className="mt-0.5 text-destructive" />
                  ) : (
                    <Clock size={18} className="mt-0.5 text-amber-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ref.referrer?.name || "Indicador"} → {ref.referred?.name || "Indicado"}
                    </p>
                    <p className="text-xs text-muted-foreground">Criada em {formatDateBRT(ref.created_at)}</p>
                    {ref.rewarded_at && (
                      <p className="text-[11px] text-emerald-400">
                        Bônus liberado em {formatDateBRT(ref.rewarded_at)} · validade do indicador:{" "}
                        {ref.referrer?.iptv_expiry ? formatDateBRT(ref.referrer.iptv_expiry + "T12:00:00") : "—"}
                      </p>
                    )}
                    {ref.notes && <p className="mt-1 text-[10px] text-muted-foreground">{ref.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${approvedRef ? "bg-emerald-500/10 text-emerald-400" : rejectedRef ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-400"}`}
                  >
                    {approvedRef
                      ? `+${ref.reward_months || 1} mês grátis`
                      : rejectedRef
                        ? "Recusada"
                        : "Aguardando 1º pagamento"}
                  </span>
                  {ref.status === "pending" && (
                    <button
                      onClick={() => updateStatus(ref.id, "rejected")}
                      className="rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25"
                    >
                      Recusar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminReferralsPage;
