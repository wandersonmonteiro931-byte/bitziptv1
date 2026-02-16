import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Target, Users, ArrowUpRight, Clock } from "lucide-react";

const stats = [
  { label: "Saldo Disponível", value: "R$ 45,50", icon: Wallet, color: "text-primary" },
  { label: "Total Ganho", value: "R$ 120,00", icon: TrendingUp, color: "text-secondary" },
  { label: "Missões Completas", value: "8", icon: Target, color: "text-success" },
  { label: "Indicações", value: "3", icon: Users, color: "text-accent" },
];

const recentActivity = [
  { action: "Missão completada: Assistir 2h", reward: "+R$ 2,00", time: "Hoje, 14:30" },
  { action: "Indicação aprovada: Maria", reward: "+R$ 5,00", time: "Ontem, 10:15" },
  { action: "Missão completada: Avaliar app", reward: "+R$ 3,00", time: "12/02, 09:00" },
  { action: "Saque aprovado", reward: "-R$ 30,00", time: "10/02, 16:45" },
];

const activeMissions = [
  { name: "Assistir 1h hoje", reward: "R$ 1,50", progress: 60 },
  { name: "Indicar 1 amigo", reward: "R$ 5,00", progress: 0 },
  { name: "Avaliar no Google", reward: "R$ 3,00", progress: 0 },
];

const ClientDashboard = () => {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Olá, <span className="text-gradient-primary">{user?.name?.split(" ")[0]}</span>! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Confira seu progresso e missões disponíveis</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stat-card rounded-xl p-4"
          >
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
        {/* Active Missions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
            <Target size={18} className="text-secondary" />
            MISSÕES ATIVAS
          </h2>
          <div className="space-y-4">
            {activeMissions.map((mission) => (
              <div key={mission.name} className="rounded-lg bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{mission.name}</span>
                  <span className="text-xs font-semibold text-secondary">{mission.reward}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${mission.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{mission.progress}% concluído</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
            <Clock size={18} className="text-primary" />
            ATIVIDADE RECENTE
          </h2>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    item.reward.startsWith("+") ? "text-success" : "text-destructive"
                  }`}
                >
                  {item.reward}
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
