import { AppLayout } from "@/components/AppLayout";
import { History, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

const history = [
  { action: "Missão: Assistir 2h", type: "credit" as const, amount: 2.0, date: "2025-02-16 14:30" },
  { action: "Indicação: Maria Santos", type: "credit" as const, amount: 5.0, date: "2025-02-15 10:15" },
  { action: "Missão: Avaliar app", type: "credit" as const, amount: 3.0, date: "2025-02-12 09:00" },
  { action: "Saque aprovado", type: "debit" as const, amount: 30.0, date: "2025-02-10 16:45" },
  { action: "Missão: Assistir 1h", type: "credit" as const, amount: 1.5, date: "2025-02-08 20:00" },
  { action: "Indicação: Carlos Oliveira", type: "credit" as const, amount: 5.0, date: "2025-02-05 11:30" },
  { action: "Missão: Seguir Instagram", type: "credit" as const, amount: 2.0, date: "2025-02-01 08:45" },
];

const HistoryPage = () => {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <History className="text-primary" /> Histórico
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Todas as suas transações</p>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="space-y-2">
          {history.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
            >
              <div className="flex items-center gap-3">
                {item.type === "credit" ? (
                  <ArrowUpRight size={18} className="text-success" />
                ) : (
                  <ArrowDownRight size={18} className="text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${item.type === "credit" ? "text-success" : "text-destructive"}`}>
                {item.type === "credit" ? "+" : "-"}R$ {item.amount.toFixed(2)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
