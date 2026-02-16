import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Users, Target, Wallet, TrendingUp, DollarSign, AlertTriangle, UserPlus, Activity } from "lucide-react";

const stats = [
  { label: "Usuários Ativos", value: "156", icon: Users, color: "text-primary", change: "+12" },
  { label: "Missões Criadas", value: "24", icon: Target, color: "text-secondary", change: "+3" },
  { label: "Saques Pendentes", value: "8", icon: Wallet, color: "text-warning", change: "5 novos" },
  { label: "Receita Indicações", value: "R$ 2.340", icon: TrendingUp, color: "text-success", change: "+18%" },
];

const recentActions = [
  { action: "Novo usuário criado: Pedro Lima", time: "Há 10 min", type: "user" },
  { action: "Saque aprovado: João Silva - R$ 30,00", time: "Há 25 min", type: "withdrawal" },
  { action: "Missão criada: Compartilhar Story", time: "Há 1h", type: "mission" },
  { action: "Saldo ajustado: Maria Santos +R$ 10,00", time: "Há 2h", type: "balance" },
  { action: "Usuário bloqueado: Carlos Fake", time: "Há 3h", type: "alert" },
];

const iconMap: Record<string, any> = {
  user: UserPlus,
  withdrawal: DollarSign,
  mission: Target,
  balance: Wallet,
  alert: AlertTriangle,
};

const AdminDashboard = () => {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Painel <span className="text-gradient-primary">Administrativo</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Controle total da plataforma Bitz IPTV</p>
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
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                {stat.change}
              </span>
            </div>
            <p className="text-xl font-bold text-foreground md:text-2xl">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-xl p-5"
      >
        <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold tracking-wide text-foreground">
          <Activity size={18} className="text-primary" />
          AÇÕES RECENTES
        </h2>
        <div className="space-y-2">
          {recentActions.map((item, i) => {
            const Icon = iconMap[item.type] || Activity;
            return (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <Icon size={16} className="text-muted-foreground" />
                  <p className="text-sm text-foreground">{item.action}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default AdminDashboard;
