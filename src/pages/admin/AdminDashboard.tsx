import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Users, Target, Wallet, TrendingUp, Activity, DollarSign, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBRT } from "@/lib/utils";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ users: 0, missions: 0, pendingWithdrawals: 0, totalDistributed: 0, totalBalance: 0, pendingAmount: 0 });
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [users, missions, withdrawals, auditLogs, profiles, pendingW] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("missions").select("id", { count: "exact" }),
        supabase.from("withdrawals").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("admin_audit_logs").select("*, admin:profiles!admin_audit_logs_admin_id_fkey(name)").order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("balance, total_earned"),
        supabase.from("withdrawals").select("amount").eq("status", "pending"),
      ]);

      const allProfiles = profiles.data || [];
      const totalDistributed = allProfiles.reduce((s, p) => s + Number(p.total_earned), 0);
      const totalBalance = allProfiles.reduce((s, p) => s + Number(p.balance), 0);
      const pendingAmount = (pendingW.data || []).reduce((s, w) => s + Number(w.amount), 0);

      setStats({
        users: users.count || 0,
        missions: missions.count || 0,
        pendingWithdrawals: withdrawals.count || 0,
        totalDistributed,
        totalBalance,
        pendingAmount,
      });
      setLogs(auditLogs.data || []);
    };
    load();
  }, []);

  const statCards = [
    { label: "Usuários", value: String(stats.users), icon: Users, color: "text-primary" },
    { label: "Total Distribuído", value: `R$ ${stats.totalDistributed.toFixed(2)}`, icon: TrendingUp, color: "text-success" },
    { label: "Saldo Acumulado", value: `R$ ${stats.totalBalance.toFixed(2)}`, icon: DollarSign, color: "text-secondary" },
    { label: "Saques Pendentes", value: `${stats.pendingWithdrawals} (R$ ${stats.pendingAmount.toFixed(2)})`, icon: Wallet, color: "text-warning" },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Painel <span className="text-gradient-primary">Administrativo</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Controle total da plataforma Bitz IPTV</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="stat-card rounded-xl p-4">
            <div className="mb-2"><stat.icon size={20} className={stat.color} /></div>
            <p className="text-lg font-bold text-foreground md:text-xl">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
          <Activity size={18} className="text-primary" /> AÇÕES RECENTES
        </h2>
        <div className="space-y-2">
          {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>}
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
              <div>
                <p className="text-sm text-foreground">{log.action} {log.target_table && `em ${log.target_table}`}</p>
                <p className="text-xs text-muted-foreground">por {log.admin?.name || "Admin"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateBRT(log.created_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default AdminDashboard;
