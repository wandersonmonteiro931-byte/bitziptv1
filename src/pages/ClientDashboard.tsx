import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Satellite, Shield, CreditCard, Link2, Tv, Headphones,
  RefreshCw, Phone, MessageCircle, Wallet, Gamepad2, History,
  AlertTriangle, ChevronRight, Zap, Award, Eye, EyeOff, Lock,
  Copy, Check, FileText, ChevronDown, ChevronUp, Radio, Bell,
  Diamond, Star
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// --- Constants ---
const SYSTEM_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string; dotColor: string; pulse?: boolean }> = {
  active: { label: "Online", color: "text-green-400", bgColor: "bg-green-500/10 border-green-500/20", dotColor: "bg-green-400", pulse: true },
  maintenance: { label: "Em Manutenção", color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/20", dotColor: "bg-yellow-400" },
  unstable: { label: "Instabilidade", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", dotColor: "bg-red-400" },
  update: { label: "Atualização Programada", color: "text-gray-300", bgColor: "bg-gray-500/10 border-gray-500/20", dotColor: "bg-gray-400" },
  blocked: { label: "Bloqueado", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", dotColor: "bg-red-400" },
  disabled: { label: "Desativado", color: "text-gray-400", bgColor: "bg-gray-500/10 border-gray-500/20", dotColor: "bg-gray-400" },
  awaiting_activation: { label: "Aguardando Ativação", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20", dotColor: "bg-blue-400" },
  awaiting_payment: { label: "Aguardando Pagamento", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20", dotColor: "bg-purple-400" },
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
    <button onClick={copy} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-primary active:scale-95">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  );
}

function BannerCarousel() {
  const [banners, setBanners] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const touchStartRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("content")
        .select("*")
        .eq("is_active", true)
        .eq("content_type", "banner")
        .lte("starts_at", now)
        .order("sort_order");
      // Filter banners that haven't ended
      const active = (data || []).filter(b => !b.ends_at || b.ends_at > now);
      setBanners(active);
    };
    load();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % banners.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [banners.length]);

  if (banners.length === 0) return null;

  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setCurrent(c => diff > 0 ? (c + 1) % banners.length : (c - 1 + banners.length) % banners.length);
    }
  };

  const banner = banners[current];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="overflow-hidden rounded-2xl"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
    >
      <a href={banner.redirect_url || "#"} target={banner.redirect_url ? "_blank" : undefined} rel="noopener noreferrer"
        className="relative block aspect-[16/7] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20"
      >
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            {banner.banner_url ? (
              <img src={banner.banner_url} alt={banner.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-4">
                <p className="text-center font-display text-sm font-bold text-foreground">{banner.title}</p>
                {banner.body && <p className="mt-1 text-center text-xs text-muted-foreground">{banner.body}</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </a>
      {/* Dots */}
      {banners.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      )}
    </motion.div>
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
      className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-card to-muted/20 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Lock size={14} className="text-primary" /> Dados de Acesso
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Shield size={10} /> Protegido
        </span>
      </div>

      <div className="space-y-2">
        {[
          { label: "🆔 Código do Cliente", value: clientCode, masked: "••••••••" },
          { label: "👤 Usuário", value: iptvUser, masked: maskUser(iptvUser) },
          { label: "🔑 Senha", value: iptvPass, masked: "••••••••••" },
        ].map((field) => (
          <div key={field.label} className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{field.label}</p>
              <p className="truncate font-mono text-sm font-semibold text-foreground">
                {revealed ? field.value : field.masked}
              </p>
            </div>
            {revealed && <CopyButton text={field.value} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2">
            <button onClick={reveal} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]">
              <Eye size={16} /> Sim, mostrar
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </motion.div>
        ) : revealed ? (
          <motion.div key="hide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <button onClick={() => { setRevealed(false); if (timerRef.current) clearTimeout(timerRef.current); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground active:scale-[0.98]">
              <EyeOff size={16} /> Ocultar dados
            </button>
            <p className="mt-1 text-center text-[10px] text-muted-foreground/50">Oculta automaticamente em 60s</p>
          </motion.div>
        ) : (
          <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <button onClick={() => setConfirming(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/20 active:scale-[0.98]">
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm transition-all hover:border-primary/20 active:scale-[0.99]">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="font-medium text-foreground">Ver Observações</span>
          {urgent && <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">⚠️ Atenção</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`mt-1 rounded-2xl border p-4 ${urgent ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/10"}`}>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-foreground">{notes}</div>
              <button onClick={() => setOpen(false)} className="mt-3 w-full rounded-xl bg-muted/30 py-2 text-xs text-muted-foreground hover:text-foreground">
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

  const status = SYSTEM_STATUS_MAP[user?.iptv_status || "active"] || SYSTEM_STATUS_MAP.active;
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

  // Format due date as DD/MM/YYYY
  const formattedDueDate = `${String(dueDay).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* === GREETING HEADER === */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground md:text-xl">
              Olá, {user?.name?.split(" ")[0]} 👋
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star size={10} className="text-secondary" />
              <span>Plano ativo</span>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-secondary">Cliente Premium</span>
            </p>
          </div>
          <button onClick={handleRefresh} disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl bg-muted/50 p-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50">
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </motion.div>

        {/* === BANNER CAROUSEL === */}
        <BannerCarousel />

        {/* === SYSTEM STATUS === */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={`flex items-center justify-between rounded-2xl border p-4 ${status.bgColor}`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio size={18} className={status.color} />
              {status.pulse && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-green-400/60" />}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status do Sistema</p>
              <p className={`font-display text-sm font-bold ${status.color}`}>{status.label}</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor} ${status.pulse ? "animate-pulse" : ""}`} />
            Ao vivo
          </span>
        </motion.div>

        {/* === SUBSCRIPTION INFO === */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-2xl border border-border bg-card p-4"
        >
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <CreditCard size={14} className="text-secondary" /> Informações da Assinatura
          </div>

          {/* Server */}
          <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/20 px-3 py-3">
            <div className="flex items-center gap-2">
              <Satellite size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground">Servidor</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Zap size={10} className="animate-pulse" />
              {user?.iptv_server || "Não definido"}
            </span>
          </div>

          {/* Value + Due Date */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">💰 Mensalidade</p>
              <p className="mt-1 font-display text-lg font-bold text-secondary">R$ {monthlyValue.toFixed(2)}</p>
            </div>
            <div className={`rounded-xl p-3 ${isDueSoon || isOverdue ? "bg-destructive/10 border border-destructive/20" : "bg-muted/20"}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">📅 Vencimento</p>
              <p className={`mt-1 font-display text-sm font-bold ${isDueSoon || isOverdue ? "text-destructive" : "text-foreground"}`}>
                {formattedDueDate}
              </p>
            </div>
          </div>

          {connections > 1 && (
            <div className="mb-3 rounded-xl bg-secondary/5 border border-secondary/20 p-2.5">
              <p className="text-xs text-muted-foreground">Total com {connections} conexões: <span className="font-bold text-secondary">R$ {totalValue.toFixed(2)}</span></p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/70">Funciona até às 23:59 do dia do vencimento.</p>

          <AnimatePresence>
            {isDueToday && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="mt-2 flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/20 px-3 py-2 text-xs font-medium text-warning">
                <AlertTriangle size={14} className="animate-pulse" /> Hoje é o último dia para pagamento!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* === CONNECTIONS === */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="overflow-hidden rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Link2 size={14} className="text-accent" /> Conexões Ativas
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">Valor multiplicado pela quantidade contratada</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl font-bold text-accent">{connections}</span>
            </div>
          </div>
        </motion.div>

        {/* === TV APP === */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-2xl border border-border bg-card p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Tv size={14} className="text-primary" /> Aplicativo Instalado
          </div>
          <div className="flex flex-wrap gap-2">
            {tvApps.map((app) => {
              const isActive = user?.iptv_tv_app === app.name;
              return (
                <div key={app.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border/50 bg-muted/10 text-muted-foreground/40"}`}>
                  <span className="text-base">{TV_APP_ICONS[app.name] || app.icon}</span>
                  <span className="font-medium">{app.name}</span>
                  {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
                </div>
              );
            })}
            {tvApps.length === 0 && user?.iptv_tv_app && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                <span>📺</span>
                <span className="font-medium">{user.iptv_tv_app}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* === SUPPORT === */}
        {supportInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="overflow-hidden rounded-2xl border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Headphones size={14} className="text-secondary" /> Seu Suporte
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-lg">👤</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{supportInfo.support_name}</p>
                <p className="text-xs text-muted-foreground">{supportInfo.support_phone}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={supportInfo.whatsapp_link} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-success/15 px-3 py-2.5 text-sm font-medium text-success transition-all hover:bg-success/25 active:scale-[0.98]">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={`tel:${supportInfo.support_phone.replace(/\D/g, "")}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/20 active:scale-[0.98]">
                <Phone size={16} /> Ligar
              </a>
            </div>
          </motion.div>
        )}

        {/* === ACCESS DATA === */}
        <AccessDataBlock user={user} />

        {/* === ADMIN NOTES === */}
        <AdminNotesBlock notes={user?.admin_notes || ""} urgent={user?.admin_notes_urgent || false} />

        {/* === RENEWAL BUTTON === */}
        {(isDueSoon || isOverdue || user?.iptv_status === "awaiting_payment") && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55 }}>
            <button
              onClick={() => {
                if (supportInfo?.whatsapp_link) {
                  window.open(supportInfo.whatsapp_link + "?text=" + encodeURIComponent("Olá! Gostaria de solicitar a renovação do meu plano IPTV."), "_blank");
                }
              }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-secondary to-secondary/80 px-6 py-4 font-display text-sm font-bold text-secondary-foreground shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {isDueToday ? <><Wallet size={18} /> PAGAR AGORA VIA PIX</> : <><RefreshCw size={18} /> RENOVAR AGORA</>}
            </button>
          </motion.div>
        )}

        {/* === QUICK ACCESS === */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="overflow-hidden rounded-2xl border border-border bg-card p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Zap size={14} className="text-warning" /> Acesso Rápido
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Mini Games", icon: Gamepad2, to: "/challenges", color: "text-accent" },
              { label: "Recompensas", icon: Diamond, to: "/missions", color: "text-secondary" },
              { label: "Histórico", icon: History, to: "/history", color: "text-primary" },
              { label: "Meus Saques", icon: Wallet, to: "/withdrawals", color: "text-success" },
            ].map((item) => (
              <button key={item.to} onClick={() => navigate(item.to)}
                className="flex items-center gap-2 rounded-xl bg-muted/20 px-3 py-3 text-sm font-medium text-foreground transition-all hover:bg-muted/40 active:scale-[0.98]">
                <item.icon size={16} className={item.color} />
                {item.label}
                <ChevronRight size={14} className="ml-auto text-muted-foreground/40" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* === FOOTER === */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
          className="space-y-1 pb-2 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/40">
            <Shield size={10} />
            <span>Conexão segura · Dados protegidos</span>
          </div>
          <p className="text-[10px] text-muted-foreground/30">
            Não compartilhe seus dados de login com terceiros.
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
