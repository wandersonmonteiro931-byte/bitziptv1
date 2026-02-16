import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, TrendingUp, Target, Users, ArrowUpRight, Clock, Snowflake, ArrowDownRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeBalance } from "@/hooks/useRealtimeBalance";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;
    const duration = 600;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prev.current = end;
  }, [value]);

  return <>{display.toFixed(2)}</>;
}

const ClientDashboard = () => {
  const { user } = useAuth();
  useRealtimeBalance();

  const [completionsCount, setCompletionsCount] = useState(0);
  const [referralsCount, setReferralsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [completions, referrals, history, missions, chartData] = await Promise.all([
        supabase.from("mission_completions").select("id", { count: "exact" }).eq("user_id", user.id).eq("status", "approved"),
        supabase.from("referrals").select("id", { count: "exact" }).eq("referrer_id", user.id),
        supabase.from("balance_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("missions").select("*").eq("is_active", true).limit(3),
        supabase.from("balance_history").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(30),
      ]);
      setCompletionsCount(completions.count || 0);
      setReferralsCount(referrals.count || 0);
      setRecentActivity(history.data || []);
      setActiveMissions(missions.data || []);
      setBalanceHistory(chartData.data || []);
    };
    load();
  }, [user]);

  const balance = Number(user?.balance || 0);
  const isFrozen = user?.balance_frozen;

  const stats = [
    { label: "Saldo Disponível", value: balance, icon: Wallet, color: "text-primary", prefix: "R$ ", animated: true },
    { label: "Total Ganho", value: Number(user?.total_earned || 0), icon: TrendingUp, color: "text-secondary", prefix: "R$ ", animated: true },
    { label: "Missões Completas", value: completionsCount, icon: Target, color: "text-success", prefix: "", animated: false },
    { label: "Indicações", value: referralsCount, icon: Users, color: "text-accent", prefix: "", animated: false },
  ];

  // Simple balance evolution from history
  const chartPoints = balanceHistory.reduce<{ label: string; val: number }[]>((acc, item) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].val : 0;
    const delta = item.type === "debit" || item.type === "withdrawal" ? -Number(item.amount) : Number(item.amount);
    acc.push({ label: new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), val: prev + delta });
    return acc;
  }, []);

  const maxVal = Math.max(...chartPoints.map((p) => p.val), 1);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Olá, <span className="text-gradient-primary">{user?.name?.split(" ")[0]}</span>! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Confira seu progresso e missões disponíveis</p>
      </div>

      {/* Frozen banner */}
      <AnimatePresence>
        {isFrozen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/15 px-4 py-3 text-sm font-medium text-destructive">
            <Snowflake size={16} /> Seu saldo está congelado. Saques e ganhos automáticos estão bloqueados.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="stat-card rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <stat.icon size={20} className={stat.color} />
              <ArrowUpRight size={14} className="text-muted-foreground" />
            </div>
            <p className="text-xl font-bold text-foreground md:text-2xl">
              {stat.prefix}
              {stat.animated ? <AnimatedNumber value={stat.value} /> : String(stat.value)}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Balance Evolution Chart */}
        {chartPoints.length > 1 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
              <TrendingUp size={18} className="text-primary" /> EVOLUÇÃO DO SALDO
            </h2>
            <div className="flex h-32 items-end gap-1">
              {chartPoints.map((point, i) => (
                <div key={i} className="group relative flex flex-1 flex-col items-center">
                  <div className="absolute -top-6 hidden rounded bg-card px-1.5 py-0.5 text-[10px] text-foreground group-hover:block">
                    R$ {point.val.toFixed(2)}
                  </div>
                  <div
                    className="w-full rounded-t bg-primary/60 transition-all group-hover:bg-primary"
                    style={{ height: `${Math.max((point.val / maxVal) * 100, 4)}%` }}
                  />
                  {i % Math.max(Math.floor(chartPoints.length / 6), 1) === 0 && (
                    <span className="mt-1 text-[9px] text-muted-foreground">{point.label}</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

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
            {recentActivity.map((item) => {
              const isDebit = item.type === "debit" || item.type === "withdrawal";
              return (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    {isDebit ? <ArrowDownRight size={14} className="text-destructive" /> : <ArrowUpRight size={14} className="text-success" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${isDebit ? "text-destructive" : "text-success"}`}>
                    {isDebit ? "-" : "+"}R$ {Number(item.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
