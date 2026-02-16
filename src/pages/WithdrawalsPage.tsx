import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const withdrawHistory = [
  { id: 1, amount: 30.0, status: "approved" as const, date: "2025-02-10", pix: "***456" },
  { id: 2, amount: 35.0, status: "pending" as const, date: "2025-02-14", pix: "***456" },
  { id: 3, amount: 30.0, status: "rejected" as const, date: "2025-01-20", pix: "***789" },
];

const statusMap = {
  approved: { label: "Aprovado", icon: CheckCircle, color: "text-success" },
  pending: { label: "Pendente", icon: Clock, color: "text-warning" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive" },
};

const WithdrawalsPage = () => {
  const { user } = useAuth();
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Wallet className="text-primary" /> Saques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Solicite saques do seu saldo promocional</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6"
        >
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">SOLICITAR SAQUE</h2>
          <div className="mb-4 rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="text-3xl font-bold text-primary">R$ {user?.balance?.toFixed(2)}</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Chave PIX</label>
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="CPF, e-mail ou telefone"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground">Valor (mínimo R$ 30,00)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="30.00"
                min={30}
              />
            </div>
            <button className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">
              Solicitar Saque
            </button>
          </div>
        </motion.div>

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6"
        >
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">HISTÓRICO DE SAQUES</h2>
          <div className="space-y-3">
            {withdrawHistory.map((w) => {
              const s = statusMap[w.status];
              return (
                <div key={w.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-3">
                    <s.icon size={18} className={s.color} />
                    <div>
                      <p className="text-sm font-medium text-foreground">R$ {w.amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{w.date} · PIX {w.pix}</p>
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
