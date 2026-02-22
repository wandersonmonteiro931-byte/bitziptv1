import { motion } from "framer-motion";
import { Users, DollarSign, AlertTriangle, ShieldOff, Clock } from "lucide-react";
import { todayBRT, nowBRT } from "@/lib/utils";

interface StatsCardsProps {
  users: any[];
}

export function StatsCards({ users }: StatsCardsProps) {
  const today = nowBRT();
  const todayStr = todayBRT();

  const totalClients = users.length;
  const activeClients = users.filter((u) => u.iptv_status === "active").length;
  const monthlyRevenue = users
    .filter((u) => u.iptv_status === "active")
    .reduce((sum, u) => sum + Number(u.iptv_monthly_value || 0) * Number(u.iptv_connections || 1), 0);

  // Expiring in next 5 days
  const fiveDaysFromNow = new Date(today);
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
  const fiveDaysStr = fiveDaysFromNow.toISOString().split("T")[0];

  const expiringIn5Days = users.filter((u) => {
    if (!u.iptv_expiry || u.iptv_status === "blocked") return false;
    return u.iptv_expiry >= todayStr && u.iptv_expiry <= fiveDaysStr;
  }).length;

  const blockedClients = users.filter((u) => u.iptv_status === "blocked").length;

  const expiredNotBlocked = users.filter((u) => {
    if (!u.iptv_expiry) return false;
    return u.iptv_expiry < todayStr && u.iptv_status === "active";
  }).length;

  const cards = [
    { label: "Total Clientes", value: totalClients, sub: `${activeClients} ativos`, icon: Users, gradient: "from-primary/20 to-primary/5", iconColor: "text-primary" },
    { label: "Receita Mensal", value: `R$ ${monthlyRevenue.toFixed(2)}`, sub: "estimada", icon: DollarSign, gradient: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-400" },
    { label: "Vencendo em 5 dias", value: expiringIn5Days, sub: "clientes", icon: Clock, gradient: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-400" },
    { label: "Bloqueados", value: blockedClients, sub: expiredNotBlocked > 0 ? `${expiredNotBlocked} vencido(s) ativo(s)` : "clientes", icon: ShieldOff, gradient: "from-red-500/20 to-red-500/5", iconColor: "text-red-400" },
  ];

  return (
    <>
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

      {/* Alert banner for users expiring soon */}
      {expiringIn5Days > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-3"
        >
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">⚠️ {expiringIn5Days} cliente(s) vencem nos próximos 5 dias</p>
            <p className="text-[11px] text-muted-foreground">Verifique pagamentos e notifique-os se necessário.</p>
          </div>
        </motion.div>
      )}
    </>
  );
}
