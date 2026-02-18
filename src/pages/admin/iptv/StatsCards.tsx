import { motion } from "framer-motion";
import { Users, DollarSign, AlertTriangle, ShieldOff } from "lucide-react";

interface StatsCardsProps {
  users: any[];
}

export function StatsCards({ users }: StatsCardsProps) {
  const today = new Date();
  const todayDay = today.getDate();

  const totalClients = users.length;
  const activeClients = users.filter((u) => u.iptv_status === "active").length;
  const monthlyRevenue = users
    .filter((u) => u.iptv_status === "active")
    .reduce((sum, u) => sum + Number(u.iptv_monthly_value || 0), 0);
  const expiringToday = users.filter((u) => u.iptv_due_day === todayDay && u.iptv_status === "active").length;
  const blockedClients = users.filter((u) => u.iptv_status === "blocked").length;

  const cards = [
    { label: "Total Clientes", value: totalClients, sub: `${activeClients} ativos`, icon: Users, gradient: "from-primary/20 to-primary/5", iconColor: "text-primary" },
    { label: "Receita Mensal", value: `R$ ${monthlyRevenue.toFixed(2)}`, sub: "estimada", icon: DollarSign, gradient: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-400" },
    { label: "Vencendo Hoje", value: expiringToday, sub: `dia ${todayDay}`, icon: AlertTriangle, gradient: "from-yellow-500/20 to-yellow-500/5", iconColor: "text-yellow-400" },
    { label: "Bloqueados", value: blockedClients, sub: "clientes", icon: ShieldOff, gradient: "from-red-500/20 to-red-500/5", iconColor: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`rounded-xl border border-border bg-gradient-to-br ${card.gradient} p-4`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">{card.label}</p>
            <card.icon size={16} className={card.iconColor} />
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">{card.value}</p>
          <p className="text-[10px] text-muted-foreground">{card.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}
