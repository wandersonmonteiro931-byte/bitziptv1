export const IPTV_STATUSES = [
  { value: "active", label: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400", glow: "shadow-emerald-500/20" },
  { value: "blocked", label: "Bloqueado", color: "bg-red-500/15 text-red-400 border-red-500/30", dot: "bg-red-400", glow: "shadow-red-500/20" },
  { value: "maintenance", label: "Em Manutenção", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400", glow: "shadow-yellow-500/20" },
  { value: "unstable", label: "Instabilidade", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400", glow: "shadow-orange-500/20" },
  { value: "disabled", label: "Desativado", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-400", glow: "shadow-zinc-500/20" },
  { value: "awaiting_activation", label: "Aguardando Ativação", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", dot: "bg-blue-400", glow: "shadow-blue-500/20" },
  { value: "awaiting_payment", label: "Aguardando Pagamento", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", dot: "bg-purple-400", glow: "shadow-purple-500/20" },
];

export const QUICK_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "expiring_5d", label: "Vencendo em 5 dias" },
  { key: "expiring", label: "Vencendo Hoje" },
  { key: "expired", label: "Vencidos" },
  { key: "blocked", label: "Bloqueados" },
  { key: "unstable", label: "Instabilidade" },
  { key: "awaiting_payment", label: "Aguardando Pgto" },
];

export const getStatusInfo = (status: string) =>
  IPTV_STATUSES.find((s) => s.value === status) || IPTV_STATUSES[0];
