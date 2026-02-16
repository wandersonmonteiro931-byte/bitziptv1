import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Target, Users, ArrowUpRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ClientDashboard = () => {
  const { user } = useAuth();
  const [completionsCount, setCompletionsCount] = useState(0);
  const [referralsCount, setReferralsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeMissions, setActiveMissions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [completions, referrals, history, missions] = await Promise.all([
        supabase.from("mission_completions").select("id", { count: "exact" }).eq("user_id", user.id).eq("status", "approved"),
        supabase.from("referrals").select("id", { count: "exact" }).eq("referrer_id", user.id),
        supabase.from("balance_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("missions").select("*").eq("is_active", true).limit(3),
      ]);
      setCompletionsCount(completions.count || 0);
      setReferralsCount(referrals.count || 0);
      setRecentActivity(history.data || []);
      setActiveMissions(missions.data || []);
    };
    load();
  }, [user]);

  const stats = [
    { label: "Saldo Disponível", value: `R$ ${Number(user?.balance || 0).toFixed(2)}`, icon: Wallet, color: "text-primary" },
    { label: "Total Ganho", value: `R$ ${Number(user?.total_earned || 0).toFixed(2)}`, icon: TrendingUp, color: "text-secondary" },
    { label: "Missões Completas", value: String(completionsCount), icon: Target, color: "text-success" },
    { label: "Indicações", value: String(referralsCount), icon: Users, color: "text-accent" },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Olá, <span className="text-gradient-primary">{user?.name?.split(" ")[0]}</span>! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Confira seu progresso e missões disponíveis</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="stat-card rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <stat.icon size={20} className={stat.color} />
              <ArrowUpRight size={14} className="text-muted-foreground" />
            </div>
            <p className="text-xl font-bold text-foreground md:text-2xl">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
            <Target size={18} className="text-secondary" /> MISSÕES ATIVAS
          </h2>
          <div className="space-y-4">
            {activeMissions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma missão disponível no momento.</p>}
            {activeMissions.map((mission) => (
              <div key={mission.id} className="rounded-lg bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{mission.title}</span>
                  <span className="text-xs font-semibold text-secondary">R$ {Number(mission.reward_value).toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{mission.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
            <Clock size={18} className="text-primary" /> ATIVIDADE RECENTE
          </h2>
          <div className="space-y-3">
            {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>}
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className={`text-sm font-semibold ${item.type === "debit" || item.type === "withdrawal" ? "text-destructive" : "text-success"}`}>
                  {item.type === "debit" || item.type === "withdrawal" ? "-" : "+"}R$ {Number(item.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
