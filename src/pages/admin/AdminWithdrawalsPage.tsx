import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Wallet, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";

const withdrawals = [
  { id: 1, user: "João Silva", amount: 35.0, pix: "joao@email.com", status: "pending" as const, date: "2025-02-14" },
  { id: 2, user: "Carlos Oliveira", amount: 50.0, pix: "11999990000", status: "pending" as const, date: "2025-02-14" },
  { id: 3, user: "Pedro Lima", amount: 30.0, pix: "123.456.789-00", status: "pending" as const, date: "2025-02-13" },
  { id: 4, user: "João Silva", amount: 30.0, pix: "joao@email.com", status: "approved" as const, date: "2025-02-10" },
  { id: 5, user: "Ana Costa", amount: 30.0, pix: "ana@email.com", status: "rejected" as const, date: "2025-02-08" },
];

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, color: "text-warning", bg: "bg-warning/15" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "text-success", bg: "bg-success/15" },
  rejected: { label: "Recusado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/15" },
};

const AdminWithdrawalsPage = () => {
  const pending = withdrawals.filter((w) => w.status === "pending");

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Wallet className="text-primary" /> Gerenciar Saques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{pending.length} solicitações pendentes</p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-warning">⏳ PENDENTES</h2>
          <div className="space-y-3">
            {pending.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card glow-border flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <DollarSign size={20} className="text-warning" />
                  <div>
                    <p className="font-medium text-foreground">{w.user}</p>
                    <p className="text-xs text-muted-foreground">PIX: {w.pix} · {w.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">R$ {w.amount.toFixed(2)}</span>
                  <button className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25">
                    Aprovar
                  </button>
                  <button className="rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25">
                    Recusar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* All */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">HISTÓRICO COMPLETO</h2>
        <div className="space-y-2">
          {withdrawals.map((w) => {
            const s = statusConfig[w.status];
            return (
              <div key={w.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <s.icon size={16} className={s.color} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.user} · R$ {w.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{w.date}</p>
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
