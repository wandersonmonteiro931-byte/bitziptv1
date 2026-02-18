import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Satellite, Shield, CreditCard, Link2, Tv, Headphones,
  RefreshCw, Phone, MessageCircle, Wallet, Gamepad2, History,
  AlertTriangle, ChevronRight, Zap, Award, Eye, EyeOff, Lock,
  Copy, Check, FileText, ChevronDown, ChevronUp, Radio, Bell,
  Diamond, Star, Clock, CalendarClock, Receipt
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

import appAssistPlus from "@/assets/app-assist-plus.webp";
import appBlessedPlayer from "@/assets/app-blessed-player.png";
import appMaxPlayer from "@/assets/app-max-player.png";
import appSmarters from "@/assets/app-smarters-pro.png";

const APP_LOGO_MAP: Record<string, string> = {
  "assist plus": appAssistPlus,
  "blessed player": appBlessedPlayer,
  "max player": appMaxPlayer,
  "smarters pro": appSmarters,
};

const getAppLogoSrc = (appName: string | undefined): string | null => {
  if (!appName) return null;
  const key = appName.toLowerCase().trim();
  for (const [k, v] of Object.entries(APP_LOGO_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
};

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
          <motion.div key={current} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5 }}
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

// --- Expiry Countdown ---
function ExpiryCountdown({ daysUntilDue, formattedDueDate, isDueToday, isOverdue }: {
  daysUntilDue: number; formattedDueDate: string; isDueToday: boolean; isOverdue: boolean;
}) {
  let alertColor = "border-border bg-card";
  let textColor = "text-foreground";
  let icon = <CalendarClock size={18} className="text-muted-foreground" />;
  let message = `Faltam ${daysUntilDue} dias para o próximo pagamento`;

  if (isOverdue) {
    alertColor = "border-destructive/30 bg-destructive/10";
    textColor = "text-destructive";
    icon = <AlertTriangle size={18} className="text-destructive animate-pulse" />;
    message = `Vencido há ${Math.abs(daysUntilDue)} dia(s)`;
  } else if (isDueToday) {
    alertColor = "border-destructive/30 bg-destructive/10";
    textColor = "text-destructive";
    icon = <AlertTriangle size={18} className="text-destructive animate-pulse" />;
    message = "🔥 Último dia para pagamento. Evite bloqueio automático às 23:59.";
  } else if (daysUntilDue <= 1) {
    alertColor = "border-red-500/30 bg-red-500/10";
    textColor = "text-red-400";
    icon = <AlertTriangle size={18} className="text-red-400 animate-pulse" />;
    message = `Falta ${daysUntilDue} dia para o pagamento`;
  } else if (daysUntilDue <= 3) {
    alertColor = "border-orange-500/30 bg-orange-500/10";
    textColor = "text-orange-400";
    icon = <Clock size={18} className="text-orange-400" />;
    message = `Faltam ${daysUntilDue} dias para o pagamento`;
  } else if (daysUntilDue <= 7) {
    alertColor = "border-yellow-500/30 bg-yellow-500/10";
    textColor = "text-yellow-400";
    icon = <Clock size={18} className="text-yellow-400" />;
    message = `Faltam ${daysUntilDue} dias para o pagamento`;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className={`overflow-hidden rounded-2xl border p-4 ${alertColor}`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">📅 Próximo vencimento: {formattedDueDate}</p>
          <p className={`mt-1 text-sm font-bold ${textColor}`}>⏳ {message}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-muted/20 px-3 py-2">
        <p className="text-[10px] text-muted-foreground/80">
          ⚠️ O sistema é bloqueado automaticamente às 23:59 do dia do vencimento caso não seja identificado pagamento.
        </p>
      </div>
    </motion.div>
  );
}

// --- Payment Section ---
function PaymentSection({ totalValue, supportInfo }: { totalValue: number; supportInfo: any }) {
  const value3m = totalValue * 3;
  const discount3m = value3m * 0.05;
  const final3m = value3m - discount3m;

  const value6m = totalValue * 6;
  const discount6m = value6m * 0.10;
  const final6m = value6m - discount6m;

  const handleRenew = (months: number, value: number) => {
    if (supportInfo?.whatsapp_link) {
      const msg = months === 1
        ? `Olá! Gostaria de renovar meu plano IPTV (1 mês) - R$ ${value.toFixed(2)}`
        : `Olá! Gostaria de renovar meu plano IPTV por ${months} meses - R$ ${value.toFixed(2)}`;
      window.open(supportInfo.whatsapp_link + "?text=" + encodeURIComponent(msg), "_blank");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
      className="overflow-hidden rounded-2xl border border-border bg-card p-4"
    >
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Wallet size={14} className="text-secondary" /> 💳 Pagamento Rápido
      </div>

      <div className="space-y-2.5">
        {/* 1 month */}
        <button onClick={() => handleRenew(1, totalValue)}
          className="flex w-full items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-3.5 text-left transition-all hover:bg-primary/20 active:scale-[0.98]">
          <div>
            <p className="text-sm font-bold text-primary">🔵 Renovar Plano</p>
            <p className="text-xs text-muted-foreground">1 mês</p>
          </div>
          <span className="font-display text-lg font-bold text-primary">R$ {totalValue.toFixed(2)}</span>
        </button>

        {/* 3 months */}
        <button onClick={() => handleRenew(3, final3m)}
          className="relative flex w-full items-center justify-between rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3.5 text-left transition-all hover:bg-purple-500/20 active:scale-[0.98]">
          <div>
            <p className="text-sm font-bold text-purple-400">🟣 3 Meses</p>
            <p className="text-xs text-muted-foreground">5% de desconto</p>
          </div>
          <div className="text-right">
            <span className="font-display text-lg font-bold text-purple-400">R$ {final3m.toFixed(2)}</span>
            <motion.p initial={{ scale: 0.9 }} animate={{ scale: [0.9, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              className="text-[10px] font-semibold text-success">💰 Economize R$ {discount3m.toFixed(2)}</motion.p>
          </div>
        </button>

        {/* 6 months */}
        <button onClick={() => handleRenew(6, final6m)}
          className="relative flex w-full items-center justify-between rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3.5 text-left transition-all hover:bg-green-500/20 active:scale-[0.98]">
          <div>
            <p className="text-sm font-bold text-green-400">🟢 6 Meses</p>
            <p className="text-xs text-muted-foreground">10% de desconto</p>
          </div>
          <div className="text-right">
            <span className="font-display text-lg font-bold text-green-400">R$ {final6m.toFixed(2)}</span>
            <motion.p initial={{ scale: 0.9 }} animate={{ scale: [0.9, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              className="text-[10px] font-semibold text-success">💰 Economize R$ {discount6m.toFixed(2)}</motion.p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}

// --- Payment History ---
function PaymentHistory() {
  const [payments, setPayments] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("balance_history")
        .select("*")
        .eq("type", "payment")
        .order("created_at", { ascending: false })
        .limit(10);
      setPayments(data || []);
    };
    load();
  }, []);

  if (payments.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Receipt size={14} className="text-secondary" /> 📜 Histórico de Mensalidades
      </div>
      <div className="space-y-2">
        {payments.map((p, i) => {
          const date = new Date(p.created_at);
          const formatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              className="cursor-pointer rounded-xl bg-muted/20 px-3 py-2.5 transition-all hover:bg-muted/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-xs text-success">✔</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{formatted}</p>
                    <p className="text-[10px] text-muted-foreground">{p.description || "Mensalidade"}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-success">R$ {Math.abs(p.amount).toFixed(2)}</span>
              </div>
              <AnimatePresence>
                {expanded === p.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mt-2 border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
                    <p>Data: {formatted}</p>
                    <p>Valor: R$ {Math.abs(p.amount).toFixed(2)}</p>
                    <p>Status: Confirmado</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
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
  const now = new Date();

  let dueDate: Date;
  if (user?.iptv_expiry) {
    const [year, month, day] = user.iptv_expiry.split("-").map(Number);
    dueDate = new Date(year, month - 1, day);
  } else {
    const dueDay = user?.iptv_due_day || 10;
    dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (dueDate < now && dueDay < now.getDate()) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
  }

  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isDueToday = daysUntilDue === 0;
  const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
  const isOverdue = daysUntilDue < 0;
  const monthlyValue = Number(user?.iptv_monthly_value || 0);
  const connections = user?.iptv_connections || 1;
  const totalValue = monthlyValue * connections;

  const formattedDueDate = `${String(dueDate.getDate()).padStart(2, '0')}/${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 1️⃣ NOME DO CLIENTE */}
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

        {/* 2️⃣ BANNERS ROTATIVOS */}
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

        {/* 3️⃣ INFORMAÇÕES DO PLANO */}
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
              <p className="mt-1 font-display text-lg font-bold text-secondary">R$ {totalValue.toFixed(2)}</p>
            </div>
            <div className={`rounded-xl p-3 ${isDueSoon || isOverdue ? "bg-destructive/10 border border-destructive/20" : "bg-muted/20"}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">📅 Validade</p>
              <p className={`mt-1 font-display text-sm font-bold ${isDueSoon || isOverdue ? "text-destructive" : "text-foreground"}`}>
                {formattedDueDate}
              </p>
            </div>
          </div>

          {connections > 1 && (
            <div className="mb-3 rounded-xl bg-secondary/5 border border-secondary/20 p-2.5">
              <p className="text-xs text-muted-foreground">Valor por tela: <span className="font-bold text-secondary">R$ {monthlyValue.toFixed(2)}</span> × {connections} telas = <span className="font-bold text-secondary">R$ {totalValue.toFixed(2)}</span></p>
            </div>
          )}

          {/* Telas Ativas */}
          <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/20 px-3 py-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Link2 size={14} className="text-accent" /> Telas Ativas
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">Será cobrado o valor integral da mensalidade por cada tela contratada.</p>
            </div>
            <span className="font-display text-2xl font-bold text-accent">{connections}</span>
          </div>

          {/* TV App */}
          <div className="rounded-xl bg-muted/20 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Tv size={14} className="text-primary" /> 📺 Aplicativo instalado na sua TV
            </div>
            <div className="flex flex-wrap gap-2">
              {tvApps.map((app) => {
                const isActive = user?.iptv_tv_app === app.name;
                const logo = getAppLogoSrc(app.name);
                return (
                  <div key={app.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border/50 bg-muted/10 text-muted-foreground/40"}`}>
                    {logo ? (
                      <img src={logo} alt={app.name} className="h-7 w-7 rounded-md object-contain" />
                    ) : (
                      <span className="text-base">{TV_APP_ICONS[app.name] || app.icon}</span>
                    )}
                    <span className="font-medium">{app.name}</span>
                    {isActive && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
                  </div>
                );
              })}
              {tvApps.length === 0 && user?.iptv_tv_app && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {(() => { const logo = getAppLogoSrc(user.iptv_tv_app); return logo ? <img src={logo} alt={user.iptv_tv_app} className="h-7 w-7 rounded-md object-contain" /> : <span>📺</span>; })()}
                  <span className="font-medium">{user.iptv_tv_app}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* 4️⃣ CONTADOR DE VENCIMENTO */}
        <ExpiryCountdown daysUntilDue={daysUntilDue} formattedDueDate={formattedDueDate} isDueToday={isDueToday} isOverdue={isOverdue} />

        {/* 5️⃣ ÁREA DE PAGAMENTO */}
        <PaymentSection totalValue={totalValue} supportInfo={supportInfo} />

        {/* 6️⃣ HISTÓRICO DE MENSALIDADES */}
        <PaymentHistory />

        {/* === ACCESS DATA === */}
        <AccessDataBlock user={user} />

        {/* === ADMIN NOTES === */}
        <AdminNotesBlock notes={user?.admin_notes || ""} urgent={user?.admin_notes_urgent || false} />

        {/* === SUPPORT === */}
        {supportInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
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

        {/* 7️⃣ ACESSO RÁPIDO (Jogos / Créditos) */}
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
