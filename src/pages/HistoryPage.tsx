import { AppLayout } from "@/components/AppLayout";
import { History, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HistoryPage = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("balance_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setHistory(data || []));
  }, [user]);

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
          {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma transação registrada.</p>}
          {history.map((item, i) => {
            const isDebit = item.type === "debit" || item.type === "withdrawal";
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  {isDebit ? <ArrowDownRight size={18} className="text-destructive" /> : <ArrowUpRight size={18} className="text-success" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${isDebit ? "text-destructive" : "text-success"}`}>
                  {isDebit ? "-" : "+"}R$ {Number(item.amount).toFixed(2)}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
