import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Wallet, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateBRT } from "@/lib/utils";

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, color: "text-warning", bg: "bg-warning/15" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "text-success", bg: "bg-success/15" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/15" },
};

const AdminWithdrawalsPage = () => {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("withdrawals").select("*, user:profiles!withdrawals_user_id_fkey(name)").order("requested_at", { ascending: false });
    setWithdrawals(data || []);
  };

  useEffect(() => { load(); }, []);

  const processWithdrawal = async (withdrawalId: string, userId: string, status: "approved" | "rejected") => {
    const { error } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "process_withdrawal", user_id: userId, data: { withdrawal_id: withdrawalId, status } },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "Saque aprovado!" : "Saque recusado" });
      load();
    }
  };

  const pending = withdrawals.filter((w) => w.status === "pending");

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Wallet className="text-primary" /> Gerenciar Saques</h1>
        <p className="mt-1 text-sm text-muted-foreground">{pending.length} solicitações pendentes</p>
      </div>

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-warning">⏳ PENDENTES</h2>
          <div className="space-y-3">
            {pending.map((w, i) => (
              <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card glow-border flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <DollarSign size={20} className="text-warning" />
                  <div>
                    <p className="font-medium text-foreground">{w.user?.name || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">PIX: {w.pix_key} · {formatDateBRT(w.requested_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">R$ {Number(w.amount).toFixed(2)}</span>
                  <button onClick={() => processWithdrawal(w.id, w.user_id, "approved")} className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25">Aprovar</button>
                  <button onClick={() => processWithdrawal(w.id, w.user_id, "rejected")} className="rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25">Recusar</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">HISTÓRICO COMPLETO</h2>
        <div className="space-y-2">
          {withdrawals.length === 0 && <p className="text-sm text-muted-foreground">Nenhum saque registrado.</p>}
          {withdrawals.map((w) => {
            const s = statusConfig[w.status as keyof typeof statusConfig] || statusConfig.pending;
            return (
              <div key={w.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <s.icon size={16} className={s.color} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.user?.name || "Usuário"} · R$ {Number(w.amount).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateBRT(w.requested_at)}</p>
                  </div>
                </div>
                <span className={`rounded-full ${s.bg} px-2.5 py-1 text-xs font-semibold ${s.color}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminWithdrawalsPage;
