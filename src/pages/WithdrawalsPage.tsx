import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const statusMap = {
  approved: { label: "Aprovado", icon: CheckCircle, color: "text-success" },
  pending: { label: "Pendente", icon: Clock, color: "text-warning" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive" },
};

const WithdrawalsPage = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const loadWithdrawals = async () => {
    if (!user) return;
    const { data } = await supabase.from("withdrawals").select("*").eq("user_id", user.id).order("requested_at", { ascending: false });
    setWithdrawals(data || []);
  };

  useEffect(() => { loadWithdrawals(); }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (user.balance_frozen) {
      toast({ title: "Erro", description: "Seu saldo está congelado. Saques bloqueados.", variant: "destructive" });
      return;
    }
    const val = parseFloat(amount);
    if (!pixKey || isNaN(val) || val < 30) {
      toast({ title: "Erro", description: "Informe a chave PIX e valor mínimo de R$ 30,00", variant: "destructive" });
      return;
    }
    if (Number(user.balance) < 30) {
      toast({ title: "Erro", description: "Saldo mínimo de R$ 30,00 necessário para saque", variant: "destructive" });
      return;
    }
    if (val > Number(user.balance)) {
      toast({ title: "Erro", description: "Saldo insuficiente", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount: val,
      pix_key: pixKey,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Solicitação enviada!", description: "Aguarde aprovação do administrador." });
      setPixKey("");
      setAmount("");
      loadWithdrawals();
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Wallet className="text-primary" /> Saques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Solicite saques do seu saldo promocional</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">SOLICITAR SAQUE</h2>
          <div className="mb-4 rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="text-3xl font-bold text-primary">R$ {Number(user?.balance || 0).toFixed(2)}</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Chave PIX</label>
              <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="CPF, e-mail ou telefone" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Valor (mínimo R$ 30,00)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="30.00" min={30} />
            </div>
            <button onClick={handleSubmit} disabled={submitting || Number(user?.balance || 0) < 30 || user?.balance_frozen} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {user?.balance_frozen ? "🔒 Saldo Congelado" : Number(user?.balance || 0) < 30 ? "Saldo mínimo: R$ 30,00" : submitting ? "Enviando..." : "Solicitar Saque"}
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-6">
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">HISTÓRICO DE SAQUES</h2>
          <div className="space-y-3">
            {withdrawals.length === 0 && <p className="text-sm text-muted-foreground">Nenhum saque solicitado.</p>}
            {withdrawals.map((w) => {
              const s = statusMap[w.status as keyof typeof statusMap] || statusMap.pending;
              return (
                <div key={w.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-3">
                    <s.icon size={18} className={s.color} />
                    <div>
                      <p className="text-sm font-medium text-foreground">R$ {Number(w.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.requested_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default WithdrawalsPage;
