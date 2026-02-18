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

  const loadBanners = async () => {
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

  useEffect(() => {
    loadBanners();
    const channel = supabase
      .channel("banners-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "content" }, () => {
        loadBanners();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      className="overflow-hidden rounded-xl"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
    >
      <a href={banner.redirect_url || "#"} target={banner.redirect_url ? "_blank" : undefined} rel="noopener noreferrer"
        className="relative block w-full aspect-[16/6] overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-accent/10"
      >
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
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
        <div className="mt-2 flex items-center justify-center gap-1">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? "w-4 bg-primary/60" : "w-1 bg-muted-foreground/20"}`}
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

// --- Expiry Countdown (separate card) ---
function ExpiryCountdown({ daysUntilDue, formattedDueDate, isDueToday, isOverdue }: {
  daysUntilDue: number; formattedDueDate: string; isDueToday: boolean; isOverdue: boolean;
}) {
  let bgClass = "bg-yellow-500/5 border-yellow-500/15";
  let textColor = "text-yellow-400";
  let message = `⏳ Faltam ${daysUntilDue} dias para o vencimento`;

  if (isOverdue) {
    bgClass = "bg-destructive/5 border-destructive/20";
    textColor = "text-destructive";
    message = `⏳ Vencido há ${Math.abs(daysUntilDue)} dia(s)`;
  } else if (isDueToday) {
    bgClass = "bg-destructive/5 border-destructive/20";
    textColor = "text-destructive";
    message = "🔥 Último dia para pagamento!";
  } else if (daysUntilDue <= 3) {
    bgClass = "bg-orange-500/5 border-orange-500/15";
    textColor = "text-orange-400";
  } else if (daysUntilDue <= 7) {
    bgClass = "bg-yellow-500/5 border-yellow-500/15";
    textColor = "text-yellow-400";
  } else {
    bgClass = "bg-muted/20 border-border";
    textColor = "text-foreground";
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className={`rounded-xl border p-4 ${bgClass}`}
    >
      <p className={`text-sm font-bold ${textColor}`}>{message}</p>
      <p className="mt-1.5 text-[10px] text-muted-foreground/70">
        ⚠️ Bloqueio automático às 23:59 caso não identificado pagamento.
      </p>
    </motion.div>
  );
}

// --- Payment Section with PIX Modal ---
function PaymentSection({ totalValue, supportInfo }: { totalValue: number; supportInfo: any }) {
  const [pixModal, setPixModal] = useState<{ months: number; value: number; discount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900);

  const value3m = totalValue * 3;
  const discount3m = value3m * 0.05;
  const final3m = value3m - discount3m;

  const value6m = totalValue * 6;
  const discount6m = value6m * 0.10;
  const final6m = value6m - discount6m;

  useEffect(() => {
    if (!pixModal) return;
    setTimeLeft(900);
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); setPixModal(null); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pixModal]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const pixKey = supportInfo?.support_phone?.replace(/\D/g, "") || "00000000000";

  const copyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPix = (months: number, value: number, discount: number) => {
    setCopied(false);
    setPixModal({ months, value, discount });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="space-y-2.5"
      >
        <button onClick={() => openPix(1, totalValue, 0)}
          className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20 px-4 py-4 text-left transition-all hover:from-primary/20 active:scale-[0.98]">
          <div>
            <p className="text-sm font-bold text-foreground">Renovar 1 mês</p>
          </div>
          <span className="font-display text-lg font-bold text-primary">R$ {totalValue.toFixed(2)}</span>
        </button>

        <button onClick={() => openPix(3, final3m, discount3m)}
          className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-purple-500/10 to-purple-500/5 border border-purple-500/15 px-4 py-4 text-left transition-all hover:from-purple-500/15 active:scale-[0.98]">
          <div>
            <p className="text-sm font-bold text-foreground">Renovar 3 meses</p>
            <p className="text-[10px] text-purple-400 font-medium">5% OFF</p>
          </div>
          <div className="text-right">
            <span className="font-display text-lg font-bold text-purple-400">R$ {final3m.toFixed(2)}</span>
          </div>
        </button>

        <button onClick={() => openPix(6, final6m, discount6m)}
          className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/15 px-4 py-4 text-left transition-all hover:from-green-500/15 active:scale-[0.98]">
          <div>
            <p className="text-sm font-bold text-foreground">Renovar 6 meses</p>
            <p className="text-[10px] text-green-400 font-medium">10% OFF</p>
          </div>
          <div className="text-right">
            <span className="font-display text-lg font-bold text-green-400">R$ {final6m.toFixed(2)}</span>
          </div>
        </button>
      </motion.div>

      {/* PIX Modal */}
      <AnimatePresence>
        {pixModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
            onClick={() => setPixModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              
              <div className="mb-4 text-center">
                <p className="text-lg font-bold text-foreground">💳 Pagamento PIX</p>
                <p className="text-xs text-muted-foreground">
                  {pixModal.months === 1 ? "Renovação 1 mês" : `Renovação ${pixModal.months} meses`}
                </p>
              </div>

              <div className="mb-4 rounded-xl bg-muted/20 p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor a pagar</p>
                <p className="mt-1 font-display text-3xl font-bold text-primary">R$ {pixModal.value.toFixed(2)}</p>
                {pixModal.discount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-success">💰 Você economiza R$ {pixModal.discount.toFixed(2)}</p>
                )}
              </div>

              <div className="mb-4 flex justify-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/10">
                  <div className="text-center">
                    <p className="text-4xl">📱</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">QR Code PIX</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Chave PIX (Copia e Cola)</p>
                <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
                  <p className="flex-1 truncate font-mono text-xs text-foreground">{pixKey}</p>
                  <button onClick={copyPix}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 active:scale-95">
                    {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
              </div>

              <div className="mb-4 text-center">
                <p className="text-[10px] text-muted-foreground">⏱️ Tempo restante para pagamento</p>
                <p className={`mt-1 font-mono text-xl font-bold ${timeLeft <= 120 ? "text-destructive animate-pulse" : "text-foreground"}`}>
                  {formatTime(timeLeft)}
                </p>
              </div>

              <div className="mb-4 rounded-xl bg-primary/5 border border-primary/15 p-3">
                <p className="text-[10px] text-muted-foreground text-center">
                  ✅ Após o pagamento, seu status mudará para <span className="font-bold text-blue-400">AGUARDANDO ATIVAÇÃO</span> e o administrador será notificado.
                </p>
              </div>

              <button onClick={() => setPixModal(null)}
                className="w-full rounded-xl bg-muted/30 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// --- Payment History (Collapsible) ---
function PaymentHistory() {
  const [payments, setPayments] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
      <button
        onClick={() => setHistoryOpen(!historyOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 text-sm transition-all hover:border-primary/20 active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          <Receipt size={15} className="text-muted-foreground" />
          <span className="font-medium text-foreground">📑 Mensalidades Pagas</span>
          {payments.length > 0 && (
            <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{payments.length}</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {historyOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-1 space-y-1.5 rounded-xl border border-border bg-card p-3">
              {payments.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Nenhum pagamento registrado.</p>
              ) : (
                payments.map((p, i) => {
                  const date = new Date(p.created_at);
                  const formatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                  const refMonth = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                  return (
                    <div key={p.id}
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                      className="cursor-pointer rounded-lg bg-muted/15 px-3 py-2.5 transition-all hover:bg-muted/25"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-xs text-success">✔</span>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{refMonth}</p>
                            <p className="text-[10px] text-muted-foreground">{formatted}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-success">R$ {Math.abs(p.amount).toFixed(2)}</span>
                      </div>
                      <AnimatePresence>
                        {expanded === p.id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden">
                            <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">💳 Pagamento</span>
                                <span className="font-medium text-foreground">PIX</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">✅ Status</span>
                                <span className="rounded-full bg-success/15 px-2 py-0.5 font-bold text-success">Confirmado</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- TV App Mini Icons ---
function TvAppIcons({ tvApps, userApp }: { tvApps: any[]; userApp: string | undefined }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">📺 App na sua TV</p>
      <div className="flex flex-wrap gap-2">
        {tvApps.map((app) => {
          const isActive = userApp === app.name;
          const logo = getAppLogoSrc(app.name);
          return (
            <div key={app.id}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
                isActive
                  ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                  : "border-border/30 bg-muted/5 text-muted-foreground/40"
              }`}
            >
              {logo ? (
                <img src={logo} alt={app.name} className="h-5 w-5 rounded object-contain" />
              ) : (
                <span className="text-sm">{TV_APP_ICONS[app.name] || app.icon}</span>
              )}
              <span>{app.name}</span>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
            </div>
          );
        })}
        {tvApps.length === 0 && userApp && (
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary font-semibold">
            {(() => { const logo = getAppLogoSrc(userApp); return logo ? <img src={logo} alt={userApp} className="h-5 w-5 rounded object-contain" /> : <span>📺</span>; })()}
            <span>{userApp}</span>
          </div>
        )}
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
  const isOverdue = daysUntilDue < 0;
  const monthlyValue = Number(user?.iptv_monthly_value || 0);
  const connections = user?.iptv_connections || 1;
  const totalValue = monthlyValue * connections;

  const formattedDueDate = `${String(dueDate.getDate()).padStart(2, '0')}/${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 1️⃣ GREETING */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star size={10} className="text-secondary" />
            <span className="text-secondary font-medium">Cliente Premium</span>
          </p>
        </motion.div>

        {/* 2️⃣ BANNERS */}
        <BannerCarousel />

        {/* 3️⃣ STATUS STRIP */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${status.bgColor}`}
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${status.dotColor} ${status.pulse ? "animate-pulse" : ""}`} />
            <span className={`text-xs font-semibold ${status.color}`}>Sistema {status.label}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Ao vivo</span>
        </motion.div>

        {/* 4️⃣ SUBSCRIPTION SUMMARY - 3 mini cards */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Servidor</p>
              <p className="mt-1 text-sm font-bold text-primary">{user?.iptv_server || "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
              <p className="mt-1 text-sm font-bold text-foreground">{formattedDueDate}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Telas</p>
              <p className="mt-1 text-sm font-bold text-accent">{connections}</p>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            💰 Mensalidade: <span className="font-bold text-secondary">R$ {totalValue.toFixed(2)}</span>
          </p>
        </motion.div>

        {/* 5️⃣ COUNTDOWN */}
        <ExpiryCountdown daysUntilDue={daysUntilDue} formattedDueDate={formattedDueDate} isDueToday={isDueToday} isOverdue={isOverdue} />

        {/* 6️⃣ PAYMENT BUTTONS */}
        <PaymentSection totalValue={totalValue} supportInfo={supportInfo} />

        {/* 7️⃣ PAYMENT HISTORY (collapsible) */}
        <PaymentHistory />

        {/* 8️⃣ TV APP MINI ICONS */}
        <TvAppIcons tvApps={tvApps} userApp={user?.iptv_tv_app} />

        {/* === ACCESS DATA === */}
        <AccessDataBlock user={user} />

        {/* === ADMIN NOTES === */}
        <AdminNotesBlock notes={user?.admin_notes || ""} urgent={user?.admin_notes_urgent || false} />

        {/* === SUPPORT === */}
        {supportInfo && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Headphones size={14} className="text-secondary" /> Suporte
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/30 text-lg">👤</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{supportInfo.support_name}</p>
                <p className="text-xs text-muted-foreground">{supportInfo.support_phone}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={supportInfo.whatsapp_link} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm font-medium text-success transition-all hover:bg-success/20 active:scale-[0.98]">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={`tel:${supportInfo.support_phone.replace(/\D/g, "")}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/20 active:scale-[0.98]">
                <Phone size={16} /> Ligar
              </a>
            </div>
          </motion.div>
        )}

        {/* === FOOTER === */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="pb-2 text-center">
          <p className="text-[10px] text-muted-foreground/30 flex items-center justify-center gap-1">
            <Shield size={8} /> Conexão segura · Dados protegidos
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default ClientDashboard;
