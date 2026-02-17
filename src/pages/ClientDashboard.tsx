import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Satellite, Shield, CreditCard, Link2, Tv, Headphones,
  RefreshCw, Phone, MessageCircle, Wallet, Gamepad2, History,
  AlertTriangle, ChevronRight, Zap, Award, Eye, EyeOff, Lock,
  Copy, Check, FileText, ChevronDown, ChevronUp
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// --- Constants ---
const IPTV_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string; pulse?: boolean }> = {
  active: { label: "ATIVO", color: "text-green-400", bgColor: "bg-green-500/15 border-green-500/30", pulse: true },
  blocked: { label: "BLOQUEADO", color: "text-red-400", bgColor: "bg-red-500/15 border-red-500/30" },
  maintenance: { label: "EM MANUTENÇÃO", color: "text-yellow-400", bgColor: "bg-yellow-500/15 border-yellow-500/30" },
  unstable: { label: "COM INSTABILIDADE", color: "text-orange-400", bgColor: "bg-orange-500/15 border-orange-500/30" },
  disabled: { label: "DESATIVADO", color: "text-gray-400", bgColor: "bg-gray-500/15 border-gray-500/30" },
  awaiting_activation: { label: "AGUARDANDO ATIVAÇÃO", color: "text-blue-400", bgColor: "bg-blue-500/15 border-blue-500/30" },
  awaiting_payment: { label: "AGUARDANDO PAGAMENTO", color: "text-purple-400", bgColor: "bg-purple-500/15 border-purple-500/30" },
};

const TV_APP_ICONS: Record<string, string> = {
  "Blessed Player": "🎬", "Max Player": "📺", "Assist Plus": "🔧", "Smarters PRO": "⭐",
};

// --- Sub-components ---
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="rounded p-1 text-muted-foreground transition-colors hover:text-primary">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  );
}

function AccessDataBlock({ user }: { user: any }) {
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const reveal = useCallback(() => {
    setConfirming(false);
    setRevealed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRevealed(false), 60000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const maskUser = (val: string) => {
    if (!val || val.length <= 4) return val || "—";
    return val.slice(0, 4) + "*".repeat(Math.min(val.length - 4, 6));
  };

  const clientCode = user?.iptv_client_code || "—";
  const iptvUser = user?.iptv_user || "—";
  const iptvPass = user?.iptv_password || "—";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
      className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card to-muted/30 p-4 shadow-[0_0_20px_hsl(210_100%_55%/0.08)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Lock size={14} className="text-primary" /> Dados de Acesso
        </div>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Shield size={10} /> Protegido
        </span>
      </div>

      <div className="space-y-2.5">
        {/* Client Code */}
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">🆔 Código do Cliente</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {revealed ? clientCode : "••••••••"}
            </p>
          </div>
          {revealed && <CopyButton text={clientCode} />}
        </div>
        {/* Username */}
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">👤 Usuário</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {revealed ? iptvUser : maskUser(iptvUser)}
            </p>
          </div>
          {revealed && <CopyButton text={iptvUser} />}
        </div>
        {/* Password */}
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">🔑 Senha</p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {revealed ? iptvPass : "••••••••••"}
            </p>
          </div>
          {revealed && <CopyButton text={iptvPass} />}
        </div>
      </div>

      {/* Reveal Button */}
      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2">
            <button onClick={reveal} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110">
              <Eye size={16} /> Sim, mostrar dados
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </motion.div>
        ) : revealed ? (
          <motion.div key="hide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <button onClick={() => { setRevealed(false); if (timerRef.current) clearTimeout(timerRef.current); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground">
              <EyeOff size={16} /> Ocultar dados
            </button>
            <p className="mt-1 text-center text-[10px] text-muted-foreground/50">Oculta automaticamente em 60 segundos</p>
          </motion.div>
        ) : (
          <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <button onClick={() => setConfirming(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/20">
              <Eye size={16} /> Mostrar dados
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminNotesBlock({ notes, urgent }: { notes: string; urgent: boolean }) {
  const [open, setOpen] = useState(false);
  if (!notes) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm transition-all hover:border-primary/30">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="font-medium text-foreground">Ver Observações</span>
          {urgent && <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">⚠️ Atenção</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`mt-1 rounded-xl border p-4 ${urgent ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"}`}>
              <div className="flex items-start gap-2">
                <FileText size={14} className={urgent ? "mt-0.5 text-destructive" : "mt-0.5 text-muted-foreground"} />
                <div className="max-h-48 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-foreground">
                  {notes}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="mt-3 w-full rounded-lg bg-muted/40 py-2 text-xs text-muted-foreground hover:text-foreground">
                Fechar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Main Dashboard ---
const ClientDashboard = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [supportInfo, setSupportInfo] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tvApps, setTvApps] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [support, apps] = await Promise.all([
        supabase.from("support_settings").select("*").limit(1).maybeSingle(),
        supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
      ]);
      setSupportInfo(support.data);
      setTvApps(apps.data || []);
    };
    loadData();

    const channel = supabase
      .channel("iptv-dashboard")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user?.id}` }, () => {
        refreshProfile();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
  };

  const status = IPTV_STATUS_MAP[user?.iptv_status || "active"] || IPTV_STATUS_MAP.active;
  const dueDay = user?.iptv_due_day || 10;
  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (dueDate < now && dueDay < now.getDate()) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isDueToday = daysUntilDue === 0 || (now.getDate() === dueDay);
  const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
  const isOverdue = daysUntilDue < 0;
  const monthlyValue = Number(user?.iptv_monthly_value || 0);
  const connections = user?.iptv_connections || 1;
  const totalValue = monthlyValue * connections;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">
            Painel <span className="text-gradient-primary">IPTV</span>
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Atualizado ao vivo
            </span>
          </div>
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50">
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-4">
        {/* BLOCK 1 - Server */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card overflow-hidden rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Satellite size={14} className="text-primary" /> Servidor Contratado
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 font-display text-sm font-bold text-primary shadow-[0_0_15px_hsl(210_100%_55%/0.2)]">
            <Zap size={14} className="animate-pulse" />
            {user?.iptv_server || "Não definido"}
          </span>
        </motion.div>

        {/* BLOCK 2 - Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`overflow-hidden rounded-xl border p-4 ${status.bgColor}`}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Shield size={14} /> Status do Cliente
          </div>
          <span className={`relative inline-flex items-center gap-2 font-display text-lg font-bold ${status.color}`}>
            {status.pulse && <span className="absolute -left-1 h-3 w-3 animate-ping rounded-full bg-success/60" />}
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "currentColor" }} />
            {status.label}
          </span>
        </motion.div>

        {/* BLOCK 3 - Financial */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card overflow-hidden rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard size={14} className="text-secondary" /> Informações Financeiras
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mensalidade</p>
              <p className="font-display text-lg font-bold text-secondary">R$ {monthlyValue.toFixed(2)}</p>
            </div>
            <div className={`rounded-lg p-3 ${isDueSoon || isOverdue ? "bg-destructive/15 border border-destructive/30" : "bg-muted/30"}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
              <p className={`font-display text-lg font-bold ${isDueSoon || isOverdue ? "text-destructive" : "text-foreground"}`}>Dia {dueDay}</p>
            </div>
          </div>
          {connections > 1 && (
            <div className="mt-2 rounded-lg bg-muted/20 p-2.5">
              <p className="text-xs text-muted-foreground">Total com {connections} conexões: <span className="font-bold text-secondary">R$ {totalValue.toFixed(2)}</span></p>
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Funciona até às 23:59 do dia do vencimento.</p>
          <AnimatePresence>
            {isDueToday && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs font-medium text-warning">
                <AlertTriangle size={14} className="animate-pulse" /> Hoje é o último dia para pagamento!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* BLOCK 4 - Connections */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card overflow-hidden rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 size={14} className="text-accent" /> Conexões Ativas
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-bold text-accent">{connections}</span>
            <span className="text-xs text-muted-foreground">{connections === 1 ? "tela contratada" : "telas contratadas"}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">O valor da mensalidade é multiplicado pela quantidade de conexões contratadas.</p>
        </motion.div>

        {/* BLOCK 5 - TV App */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card overflow-hidden rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Tv size={14} className="text-primary" /> Aplicativo para TV
          </div>
          <div className="flex flex-wrap gap-2">
            {tvApps.map((app) => {
              const isActive = user?.iptv_tv_app === app.name;
              return (
                <div key={app.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${isActive ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_10px_hsl(210_100%_55%/0.15)]" : "border-border bg-muted/20 text-muted-foreground opacity-50"}`}>
                  <span className="text-base">{TV_APP_ICONS[app.name] || app.icon}</span>
                  <span className="font-medium">{app.name}</span>
                  {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
                </div>
              );
            })}
            {tvApps.length === 0 && user?.iptv_tv_app && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
                <span className="text-base">📺</span>
                <span className="font-medium">{user.iptv_tv_app}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* BLOCK - Access Data (Protected) */}
        <AccessDataBlock user={user} />

        {/* BLOCK - Admin Notes */}
        <AdminNotesBlock notes={user?.admin_notes || ""} urgent={user?.admin_notes_urgent || false} />

        {/* BLOCK 6 - Support */}
        {supportInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card overflow-hidden rounded-xl p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Headphones size={14} className="text-secondary" /> Suporte
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-accent/30 text-xl font-bold text-foreground">👤</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{supportInfo.support_name}</p>
                <p className="text-xs text-muted-foreground">{supportInfo.support_phone}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <a href={supportInfo.whatsapp_link} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-success/20 px-3 py-2.5 text-sm font-medium text-success transition-all hover:bg-success/30">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={`tel:${supportInfo.support_phone.replace(/\D/g, "")}`} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/15 px-3 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/25">
                <Phone size={16} /> Ligar
              </a>
            </div>
          </motion.div>
        )}

        {/* BLOCK 7 - Renewal */}
        {(isDueSoon || isOverdue || user?.iptv_status === "awaiting_payment") && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }} className="overflow-hidden rounded-xl border border-secondary/30 bg-gradient-to-r from-secondary/10 to-secondary/5 p-4">
            <button
              onClick={() => {
                if (supportInfo?.whatsapp_link) {
                  window.open(supportInfo.whatsapp_link + "?text=" + encodeURIComponent("Olá! Gostaria de solicitar a renovação do meu plano IPTV."), "_blank");
                }
              }}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-secondary to-secondary/80 px-6 py-4 font-display text-sm font-bold text-secondary-foreground shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {isDueToday ? <><Wallet size={18} /> PAGAR AGORA VIA PIX</> : <><RefreshCw size={18} /> SOLICITAR RENOVAÇÃO</>}
            </button>
          </motion.div>
        )}

        {/* Quick Access */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card overflow-hidden rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap size={14} className="text-warning" /> Acesso Rápido
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Mini Games", icon: Gamepad2, to: "/challenges", color: "text-accent" },
              { label: "Recompensas", icon: Award, to: "/missions", color: "text-secondary" },
              { label: "Histórico", icon: History, to: "/history", color: "text-primary" },
              { label: "Meus Saques", icon: Wallet, to: "/withdrawals", color: "text-success" },
            ].map((item) => (
              <button key={item.to} onClick={() => navigate(item.to)} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted/50">
                <item.icon size={16} className={item.color} />
                {item.label}
                <ChevronRight size={14} className="ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Security Badge */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="flex items-center justify-center gap-2 py-3 text-[10px] text-muted-foreground/50">
          <Shield size={12} />
          <span>Conexão segura · Seus dados estão protegidos</span>
        </motion.div>

        <p className="pb-2 text-center text-[10px] text-muted-foreground/40">
          Não compartilhe seus dados de login com terceiros. O valor final é cobrado com base no número de telas utilizadas.
        </p>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
