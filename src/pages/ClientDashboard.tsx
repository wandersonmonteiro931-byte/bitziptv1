import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  CreditCard,
  Tv,
  Headphones,
  Phone,
  MessageCircle,
  History,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  Receipt,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAppBranding } from "@/hooks/useAppBranding";

import appAssistPlus from "@/assets/app-assist-plus.webp";
import appBlessedPlayer from "@/assets/app-blessed-player.png";
import appMaxPlayer from "@/assets/app-max-player.png";
import appSmarters from "@/assets/app-smarters-pro.png";

declare const __BUILD_TIMESTAMP__: number;

const APP_VERSION_STORAGE_KEY = "wmcflix_app_version_state_v1";

const incrementAppVersion = (version: string) => {
  const clean = String(version || "v1.0").replace(/^v/i, "");
  const [majorRaw, minorRaw] = clean.split(".");
  let major = Number(majorRaw || 1);
  let minor = Number(minorRaw || 0);

  if (!Number.isFinite(major) || major < 1) major = 1;
  if (!Number.isFinite(minor) || minor < 0) minor = 0;

  minor += 1;

  if (minor >= 10) {
    major += 1;
    minor = 0;
  }

  return `v${major}.${minor}`;
};

const getCurrentAppVersion = () => {
  const fallback = "v1.0";

  if (typeof window === "undefined") return fallback;

  const currentBuild = String(typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : Date.now());

  try {
    const storedRaw = localStorage.getItem(APP_VERSION_STORAGE_KEY);
    const stored = storedRaw ? (JSON.parse(storedRaw) as { buildId?: string; version?: string }) : null;

    if (stored?.buildId === currentBuild && stored?.version) {
      return stored.version;
    }

    const nextVersion = stored?.version ? incrementAppVersion(stored.version) : fallback;

    localStorage.setItem(
      APP_VERSION_STORAGE_KEY,
      JSON.stringify({
        buildId: currentBuild,
        version: nextVersion,
      }),
    );

    return nextVersion;
  } catch {
    return fallback;
  }
};

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

const SYSTEM_STATUS_MAP: Record<string, { label: string; color: string; dotColor: string; pulse?: boolean }> = {
  active: { label: "Online", color: "text-emerald-400", dotColor: "bg-emerald-400", pulse: true },
  maintenance: { label: "Em Manutenção", color: "text-amber-400", dotColor: "bg-amber-400" },
  unstable: { label: "Instabilidade", color: "text-red-400", dotColor: "bg-red-400" },
  update: { label: "Atualização", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
  blocked: { label: "Bloqueado", color: "text-red-400", dotColor: "bg-red-400" },
  disabled: { label: "Desativado", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
  awaiting_activation: { label: "Aguardando Ativação", color: "text-primary", dotColor: "bg-primary" },
  awaiting_payment: { label: "Aguardando Pagamento", color: "text-amber-400", dotColor: "bg-amber-400" },
  trust_active: { label: "Ativo em Confiança", color: "text-cyan-400", dotColor: "bg-cyan-400", pulse: true },
};

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
};

const formatDiscountPercent = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
};

// --- Copy Button ---
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary active:scale-95"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  );
}

// --- Banner Carousel (minimal) ---
// Optimize Supabase storage URLs with image transformation for faster loading
const optimizeImageUrl = (url: string, width = 1200): string => {
  if (!url) return url;
  // Only transform Supabase storage URLs
  if (url.includes("/storage/v1/object/public/")) {
    // Use render/image endpoint for on-the-fly resize + webp
    return (
      url.replace("/storage/v1/object/public/", `/storage/v1/render/image/public/`) +
      `?width=${width}&quality=75&format=origin`
    );
  }
  return url;
};

function BannerCarousel() {
  const [banners, setBanners] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const touchStartRef = useRef(0);

  useEffect(() => {
    const now = new Date().toISOString();
    supabase
      .from("content")
      .select("id, title, body, banner_url, redirect_url, sort_order, ends_at")
      .eq("is_active", true)
      .eq("content_type", "banner")
      .lte("starts_at", now)
      .order("sort_order")
      .then(({ data }) => {
        const active = (data || []).filter((b) => !b.ends_at || b.ends_at > now);
        setBanners(active);
        // Preload all optimized images in parallel
        active.forEach((b) => {
          if (!b.banner_url) {
            setLoadedIds((prev) => new Set(prev).add(b.id));
            return;
          }
          const img = new window.Image();
          const mark = () => setLoadedIds((prev) => new Set(prev).add(b.id));
          img.onload = mark;
          img.onerror = mark;
          img.src = optimizeImageUrl(b.banner_url);
        });
      });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    intervalRef.current = setInterval(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [banners.length]);

  // Show skeleton placeholder while loading instead of nothing
  if (banners.length === 0) return null;

  const firstReady = banners.length > 0 && loadedIds.has(banners[0].id);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50)
      setCurrent((c) => (diff > 0 ? (c + 1) % banners.length : (c - 1 + banners.length) % banners.length));
  };

  // Show skeleton until first banner is ready
  if (!firstReady) {
    return (
      <div className="mx-4 mt-2 mb-4">
        <div className="w-full h-40 animate-pulse rounded-[20px] bg-muted/30" />
      </div>
    );
  }

  const banner = banners[current];
  const isBannerLoaded = loadedIds.has(banner.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="mx-4 mt-2 mb-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <a
        href={banner.redirect_url || "#"}
        target={banner.redirect_url ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="block w-full"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex w-full items-center justify-center overflow-hidden rounded-[20px] bg-black/20"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
          >
            {banner.banner_url && isBannerLoaded ? (
              <img
                src={optimizeImageUrl(banner.banner_url)}
                alt={banner.title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="block h-auto max-h-[70vh] w-auto max-w-full rounded-[20px] object-contain"
              />
            ) : banner.banner_url && !isBannerLoaded ? (
              <div className="h-40 w-full animate-pulse rounded-[20px] bg-muted/30" />
            ) : (
              <div className="flex min-h-40 w-full flex-col items-center justify-center bg-muted/30 p-6">
                <p className="text-center text-sm font-semibold text-foreground">{banner.title}</p>
                {banner.body && <p className="mt-1 text-center text-xs text-muted-foreground">{banner.body}</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </a>
      {banners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-primary/60" : "w-1.5 bg-muted-foreground/15"}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// --- Access Data Block ---
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

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const maskUser = (val: string) => {
    if (!val || val.length <= 4) return val || "—";
    return val.slice(0, 4) + "•".repeat(Math.min(val.length - 4, 6));
  };

  const clientCode = user?.iptv_client_code || "—";
  const iptvUser = user?.iptv_user || "—";
  const iptvPass = user?.iptv_password || "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-border/40 bg-card/50 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Lock size={13} /> Dados de Acesso
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          <Shield size={9} /> Protegido
        </span>
      </div>

      <div className="space-y-2">
        {[
          { label: "Código do Cliente", value: clientCode, masked: "••••••••" },
          { label: "Usuário", value: iptvUser, masked: maskUser(iptvUser) },
          { label: "Senha", value: iptvPass, masked: "••••••••••" },
        ].map((field) => (
          <div key={field.label} className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground">{field.label}</p>
              <p className="truncate font-mono text-sm text-foreground">{revealed ? field.value : field.masked}</p>
            </div>
            {revealed && <CopyButton text={field.value} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2"
          >
            <button
              onClick={reveal}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-all active:scale-[0.98]"
            >
              <Eye size={16} /> Sim, mostrar
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-xl bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </motion.div>
        ) : revealed ? (
          <motion.div
            key="hide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <button
              onClick={() => {
                setRevealed(false);
                if (timerRef.current) clearTimeout(timerRef.current);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground active:scale-[0.98]"
            >
              <EyeOff size={16} /> Ocultar dados
            </button>
            <p className="mt-1 text-center text-[10px] text-muted-foreground/40">Oculta automaticamente em 60s</p>
          </motion.div>
        ) : (
          <motion.div
            key="show"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <button
              onClick={() => setConfirming(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary active:scale-[0.98]"
            >
              <Eye size={16} /> Mostrar dados
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Admin Notes ---
function AdminNotesBlock({ notes, urgent }: { notes: string; urgent: boolean }) {
  const [open, setOpen] = useState(false);
  if (!notes) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="font-medium text-foreground">Observações</span>
          {urgent && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
              Atenção
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`mt-1 rounded-2xl border p-4 ${urgent ? "border-destructive/15 bg-destructive/5" : "border-border bg-card"}`}
            >
              <div className="whitespace-pre-wrap text-sm text-foreground">{notes}</div>
              <button
                onClick={() => setOpen(false)}
                className="mt-3 w-full rounded-xl bg-muted/20 py-2 text-xs text-muted-foreground"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Payment History (Collapsible — from iptv_payments + balance_history) ---
function PaymentHistory() {
  const [payments, setPayments] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("iptv_payments")
        .select("*")
        .in("status", ["confirmed", "paid_pending_activation"])
        .order("payment_date", { ascending: false })
        .limit(20);
      if (!error) setPayments(data || []);
    };
    load();

    // Realtime: reload when iptv_payments changes
    const channel = supabase
      .channel("payment-history-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "iptv_payments" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <motion.div
      id="faturas"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      <button
        onClick={() => setHistoryOpen(!historyOpen)}
        className="flex w-full items-center justify-between rounded-2xl border border-border/40 bg-card/50 px-5 py-3.5 text-sm active:opacity-80"
      >
        <span className="text-sm text-muted-foreground">Mensalidades pagas</span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-2xl border border-border/30 bg-card/40 p-4">
              {payments.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Nenhum pagamento registrado.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => {
                    const date = new Date(p.payment_date);
                    const formatted = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
                    const endParts = p.period_end?.split("-");
                    const endFormatted = endParts ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : "";
                    const isPendingActivation = p.status === "paid_pending_activation";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                      >
                        <div>
                          <p className="text-sm text-foreground">{formatted}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.months} mês(es) · até {endFormatted}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-foreground">
                              R$ {Number(p.amount).toFixed(2)}
                            </span>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                              Pago
                            </span>
                          </div>
                          {isPendingActivation && (
                            <span className="text-[9px] text-blue-400">Aguardando liberação do suporte</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
  const { appName, logoUrl } = useAppBranding();
  const appTitle = (appName || "WMCFLIX").trim().toUpperCase();
  const normalizedUserApp = String(userApp || "")
    .trim()
    .toLowerCase();
  const visibleTvApps = [
    { id: "wmcflix-oficial", name: appTitle, logoUrl, isOfficialWmcflix: true },
    ...(Array.isArray(tvApps) ? tvApps : []).filter((app) => {
      const name = String(app?.name || "")
        .trim()
        .toLowerCase();
      return name !== "wmcflix" && name !== appTitle.toLowerCase();
    }),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-border/40 bg-card/50 p-5"
    >
      <p className="mb-3 text-xs text-muted-foreground">App na sua TV</p>
      <div className="flex flex-wrap gap-2">
        {visibleTvApps.map((app) => {
          const appNameValue = String(app.name || "");
          const normalizedAppName = appNameValue.trim().toLowerCase();
          const isOfficial = !!app.isOfficialWmcflix;
          const isActive = normalizedUserApp === normalizedAppName || (isOfficial && normalizedUserApp === "wmcflix");
          const logo = isOfficial ? logoUrl : getAppLogoSrc(appNameValue);

          return (
            <div
              key={app.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
                isActive
                  ? "bg-red-500/10 text-red-300 font-medium ring-1 ring-red-500/20"
                  : "bg-muted/15 text-muted-foreground/40"
              }`}
            >
              {logo ? (
                <img src={logo} alt={appNameValue} className="h-4 w-4 rounded-full object-contain" />
              ) : (
                <Tv size={12} />
              )}
              <span>{appNameValue}</span>
            </div>
          );
        })}
        {visibleTvApps.length === 0 && userApp && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs text-red-300 font-medium">
            {(() => {
              const logo = normalizedUserApp === "wmcflix" ? logoUrl : getAppLogoSrc(userApp);
              return logo ? (
                <img src={logo} alt={userApp} className="h-4 w-4 rounded-full object-contain" />
              ) : (
                <Tv size={12} />
              );
            })()}
            <span>{userApp}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- PIX Payment Modal ---
function PixModal({
  pixModal,
  onClose,
  supportInfo,
  user,
}: {
  pixModal: { months: number; value: number; discount: number };
  onClose: (confirmed?: boolean) => void;
  supportInfo: any;
  user: any;
}) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [loading, setLoading] = useState(true);
  const [pixData, setPixData] = useState<{
    qrcode: string;
    qrcode_image: string;
    txid: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const { appName } = useAppBranding();
  useEffect(() => {
    const createCharge = async () => {
      setLoading(true);
      setError(null);
      try {
        // Always use client's registered expiry date as base
        let baseExpiry: Date;
        if (user?.iptv_expiry) {
          const [y, m, d] = user.iptv_expiry.split("-").map(Number);
          baseExpiry = new Date(y, m - 1, d);
        } else {
          baseExpiry = new Date();
        }
        const periodStart = new Date(baseExpiry);
        const periodEndDate = new Date(baseExpiry);
        periodEndDate.setMonth(periodEndDate.getMonth() + pixModal.months);

        const periodEndStr = periodEndDate.toISOString().split("T")[0];
        setPeriodEnd(periodEndStr);

        const { data: payment, error: insertError } = await supabase
          .from("iptv_payments")
          .insert({
            user_id: user.id,
            amount: pixModal.value,
            months: pixModal.months,
            period_start: periodStart.toISOString().split("T")[0],
            period_end: periodEndStr,
            status: "pending",
            payment_method: "pix",
            notes: `Renovação ${pixModal.months} mês(es) via PIX automático`,
          })
          .select("id")
          .single();

        if (insertError || !payment) {
          throw new Error(insertError?.message || "Erro ao criar pagamento");
        }

        setPaymentId(payment.id);

        const { data, error: fnError } = await supabase.functions.invoke("pix-efi/create-charge", {
          body: {
            payment_id: payment.id,
            amount: pixModal.value,
            devedor_nome: user.name || undefined,
            descricao: `${appName} - ${pixModal.months} mês(es)`,
          },
        });

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || "Erro ao gerar PIX");
        }

        setPixData(data);
        setTimeLeft(data.expiracao || 3600);
      } catch (err: any) {
        console.error("PIX charge error:", err);
        setError(err.message || "Erro ao gerar cobrança PIX");
      } finally {
        setLoading(false);
      }
    };

    createCharge();
  }, []);

  // Poll every 1s checking DB + edge function for payment confirmation
  useEffect(() => {
    if (!paymentId || paymentConfirmed) return;

    let active = true;

    const checkPayment = async () => {
      if (!active) return;

      // 1. Always check DB first (fastest, most reliable)
      try {
        const { data } = await supabase.from("iptv_payments").select("status").eq("id", paymentId).maybeSingle();
        if (data?.status && data.status !== "pending") {
          if (active) setPaymentConfirmed(true);
          return;
        }
      } catch (err) {
        console.error("DB poll error:", err);
      }

      // 2. If still pending, actively check Efí API via edge function
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-efi/check-status`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ payment_id: paymentId }),
          });
          if (resp.ok) {
            const result = await resp.json();
            if (result?.confirmed && active) {
              setPaymentConfirmed(true);
            }
          }
        }
      } catch (err) {
        // Edge function failed — DB check above is the fallback
      }
    };

    // Check immediately, then every 1 second
    checkPayment();
    const poll = setInterval(checkPayment, 1000);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [paymentId, paymentConfirmed]);

  useEffect(() => {
    if (loading || error || paymentConfirmed) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, error, paymentConfirmed]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const copyPix = () => {
    if (!pixData?.qrcode) return;
    navigator.clipboard.writeText(pixData.qrcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // When closing without payment, delete the pending record
  const handleClose = async () => {
    if (!paymentConfirmed && paymentId) {
      try {
        await supabase.from("iptv_payments").delete().eq("id", paymentId).eq("status", "pending");
      } catch (err) {
        // ignore
      }
    }
    onClose(paymentConfirmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {paymentConfirmed ? (
          (() => {
            // Use period_end from the payment record (calculated at creation time based on iptv_expiry)
            let formattedNewExpiry = "—";
            if (periodEnd) {
              const [y, m, d] = periodEnd.split("-").map(Number);
              formattedNewExpiry = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
            }

            return (
              <>
                <div className="py-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check size={40} className="text-emerald-400" />
                    </div>
                  </motion.div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">Pagamento Recebido!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Seu pagamento foi confirmado com sucesso.</p>

                  <div className="mt-4 rounded-xl border border-border/40 bg-muted/15 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nova data de validade</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{formattedNewExpiry}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Renovação de {pixModal.months} {pixModal.months === 1 ? "mês" : "meses"}
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl bg-primary/10 px-4 py-3">
                    <p className="text-xs font-medium text-primary">✅ Nosso suporte já foi notificado!</p>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      O administrador será imediatamente notificado para realizar a atualização e ativação do IPTV no
                      servidor. Em média leva menos de <span className="font-semibold text-foreground">2 horas</span>,
                      no máximo em até <span className="font-semibold text-foreground">24 horas</span> estará
                      funcionando normalmente.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Fechar
                </button>
              </>
            );
          })()
        ) : (
          <>
            <div className="mb-5 text-center">
              <p className="text-lg font-bold text-foreground">Pagamento PIX</p>
              <p className="text-xs text-muted-foreground">
                {pixModal.months === 1 ? "Renovação 1 mês" : `Renovação ${pixModal.months} meses`}
              </p>
            </div>

            <div className="mb-5 rounded-2xl bg-muted/15 p-5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor a pagar</p>
              <p className="mt-2 text-3xl font-bold text-foreground">R$ {pixModal.value.toFixed(2)}</p>
              {pixModal.discount > 0 && (
                <p className="mt-1 text-xs text-success">Você economiza R$ {pixModal.discount.toFixed(2)}</p>
              )}
            </div>

            {loading ? (
              <div className="mb-5 flex flex-col items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="mt-3 text-sm text-muted-foreground">Gerando cobrança PIX...</p>
              </div>
            ) : error ? (
              <div className="mb-5 rounded-2xl bg-destructive/10 p-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Entre em contato com o suporte para pagamento manual.
                </p>
              </div>
            ) : pixData ? (
              <>
                <div className="mb-5 flex justify-center">
                  {pixData.qrcode_image ? (
                    <img
                      src={
                        pixData.qrcode_image.startsWith("data:")
                          ? pixData.qrcode_image
                          : `data:image/png;base64,${pixData.qrcode_image}`
                      }
                      alt="QR Code PIX"
                      className="h-40 w-40 rounded-2xl"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10">
                      <div className="text-center">
                        <p className="text-3xl">📱</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">QR Code</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-5">
                  <p className="mb-2 text-center text-[10px] text-muted-foreground">PIX Copia e Cola</p>
                  <button
                    onClick={copyPix}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.97] ${
                      copied
                        ? "bg-emerald-500 text-white"
                        : "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={16} /> Código copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copiar código PIX
                      </>
                    )}
                  </button>
                  <p className="mt-2 truncate text-center font-mono text-[10px] text-muted-foreground/60">
                    {pixData.qrcode}
                  </p>
                </div>

                <div className="mb-5 rounded-xl bg-blue-500/10 px-4 py-3">
                  <p className="text-[11px] text-blue-300 leading-relaxed text-center">
                    Após o pagamento, o suporte será notificado imediatamente para ativar seu IPTV. Em média leva menos
                    de <span className="font-semibold">2 horas</span>.
                  </p>
                </div>

                <div className="mb-5 text-center">
                  <p className="text-[10px] text-muted-foreground">Tempo restante</p>
                  <p
                    className={`mt-1 font-mono text-lg font-bold ${timeLeft <= 120 ? "text-destructive" : "text-foreground"}`}
                  >
                    {formatTime(timeLeft)}
                  </p>
                </div>
              </>
            ) : null}

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-muted/20 py-2.5 text-sm text-muted-foreground"
            >
              Fechar
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- Pending Activation Banner ---
function PendingActivationBanner({ userId, effectiveStatus }: { userId: string | undefined; effectiveStatus: string }) {
  const [futureExpiry, setFutureExpiry] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase
        .from("iptv_payments")
        .select("period_end")
        .eq("user_id", userId)
        .eq("status", "paid_pending_activation")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.period_end) {
        const [y, m, d] = data.period_end.split("-").map(Number);
        setFutureExpiry(`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
      } else {
        setFutureExpiry(null);
      }
    };
    load();

    const channel = supabase
      .channel("pending-activation-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "iptv_payments" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (effectiveStatus !== "awaiting_activation" && !futureExpiry) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-0 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3"
    >
      <p className="text-xs font-medium text-blue-400">⏳ Aguardando liberação do suporte</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Seu pagamento foi recebido. O suporte está atualizando seu servidor. Em média leva menos de 2 horas.
      </p>
      {futureExpiry && (
        <p className="mt-2 text-xs font-semibold text-blue-300">Sua nova data de vencimento será: {futureExpiry}</p>
      )}
    </motion.div>
  );
}

// --- Main Dashboard ---
const ClientDashboard = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [supportInfo, setSupportInfo] = useState<any>(null);
  const [tvApps, setTvApps] = useState<any[]>([]);
  const [pixModal, setPixModal] = useState<{ months: number; value: number; discount: number } | null>(null);
  const [pendingFutureExpiry, setPendingFutureExpiry] = useState<string | null>(null);
  const [trustRequesting, setTrustRequesting] = useState(false);
  const [trustCooldown, setTrustCooldown] = useState(false);
  const [trustPending, setTrustPending] = useState(false);
  const [cancelRequesting, setCancelRequesting] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [notifPopup, setNotifPopup] = useState<{
    title: string;
    body: string;
    bannerUrl?: string;
    imageOnly?: boolean;
  } | null>(null);
  const [renewalDiscount3mPercent, setRenewalDiscount3mPercent] = useState(5);
  const [renewalDiscount6mPercent, setRenewalDiscount6mPercent] = useState(10);
  const [appVersion] = useState(() => getCurrentAppVersion());

  const preloadImage = useCallback((src: string, timeoutMs = 1200) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      const done = () => resolve();
      img.onload = done;
      img.onerror = done;
      img.src = src;
      setTimeout(done, timeoutMs);
    });
  }, []);
  useEffect(() => {
    const loadData = async () => {
      const [support, apps, platform] = await Promise.all([
        supabase.from("support_settings").select("*").limit(1).maybeSingle(),
        supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
        supabase
          .from("platform_settings")
          .select("renewal_discount_3m_percent, renewal_discount_6m_percent")
          .limit(1)
          .maybeSingle(),
      ]);
      setSupportInfo(support.data);
      setTvApps(apps.data || []);

      if (platform.data) {
        setRenewalDiscount3mPercent(Number((platform.data as any).renewal_discount_3m_percent ?? 5));
        setRenewalDiscount6mPercent(Number((platform.data as any).renewal_discount_6m_percent ?? 10));
      }
    };
    loadData();

    // Check trust request status
    const checkTrustStatus = async () => {
      if (!user?.id) return;
      // Check if there's a pending trust request
      const { data: pending } = await supabase
        .from("iptv_trust_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      setTrustPending(!!pending);

      // Check 30-day cooldown - any approved/expired request in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recent } = await supabase
        .from("iptv_trust_requests")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["approved", "expired"])
        .gte("requested_at", thirtyDaysAgo.toISOString())
        .limit(1)
        .maybeSingle();
      setTrustCooldown(!!recent);
    };
    checkTrustStatus();

    // Check cancellation request status
    const checkCancelStatus = async () => {
      if (!user?.id) return;
      const { data: pending } = await supabase
        .from("iptv_cancellation_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      setCancelPending(!!pending);
    };
    checkCancelStatus();

    // Load pending future expiry
    const loadPendingExpiry = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("iptv_payments")
        .select("period_end")
        .eq("user_id", user.id)
        .eq("status", "paid_pending_activation")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.period_end) {
        const [y, m, d] = data.period_end.split("-").map(Number);
        setPendingFutureExpiry(`${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
      } else {
        setPendingFutureExpiry(null);
      }
    };
    loadPendingExpiry();

    const channel = supabase
      .channel("iptv-dashboard")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user?.id}` },
        () => {
          refreshProfile();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "iptv_payments" }, () => {
        loadPendingExpiry();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "platform_settings" }, (payload) => {
        const next = payload.new as any;
        setRenewalDiscount3mPercent(Number(next.renewal_discount_3m_percent ?? 5));
        setRenewalDiscount6mPercent(Number(next.renewal_discount_6m_percent ?? 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Handle hash navigation (from push notifications)
  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (!hash || !user) return;

    // Auto-open PIX modal
    if (hash === "gerar-pix") {
      const mv = Number(user.iptv_monthly_value || 0);
      const conn = user.iptv_connections || 1;
      const tv = mv * conn;
      if (tv > 0) {
        setPixModal({ months: 1, value: tv, discount: 0 });
      }
      window.history.replaceState(null, "", location.pathname);
      return;
    }

    // Scroll to section
    setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", location.pathname);
      }
    }, 500);
  }, [location.hash, user]);

  // Handle notif params (deep-link from push notification click)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const notifId = params.get("notif_id");
    const notifType = params.get("notif_type");
    const notifImage = params.get("notif_image");

    if (!notifId && !(notifType === "image" && notifImage)) return;

    // Clean URL immediately
    const cleanUrl = location.pathname + (location.hash || "");
    window.history.replaceState(null, "", cleanUrl);

    const loadNotif = async () => {
      if (notifType === "image" && notifImage) {
        const imageUrl = decodeURIComponent(notifImage);
        await preloadImage(imageUrl);
        setNotifPopup({ title: "", body: "", bannerUrl: imageUrl, imageOnly: true });
      } else if (notifId) {
        const { data } = await supabase
          .from("scheduled_notifications")
          .select("click_text_title, click_text_body, click_banner_id")
          .eq("id", notifId)
          .maybeSingle();
        if (!data) return;

        let popupData: { title: string; body: string; bannerUrl?: string; imageOnly?: boolean } | null = null;

        if (data.click_banner_id) {
          // Load banner content
          const { data: banner } = await supabase
            .from("content")
            .select("title, body, banner_url")
            .eq("id", data.click_banner_id)
            .maybeSingle();
          if (banner) {
            popupData = { title: banner.title, body: banner.body || "", bannerUrl: banner.banner_url || undefined };
          }
        } else if (data.click_text_title === "__IMAGE__" && data.click_text_body) {
          // Image-only popup
          popupData = { title: "", body: "", bannerUrl: data.click_text_body, imageOnly: true };
        } else if (data.click_text_body) {
          popupData = { title: data.click_text_title || "Aviso", body: data.click_text_body };
        }

        if (popupData?.bannerUrl) {
          await preloadImage(popupData.bannerUrl);
        }
        if (popupData) setNotifPopup(popupData);
      }

      // Track view
      if (notifId && user?.id) {
        await supabase.from("notification_views").insert({ notification_id: notifId, user_id: user.id }).maybeSingle();
      }
    };
    loadNotif();
  }, [location.search, location.pathname, location.hash, user?.id, preloadImage]);

  const requestTrustUnlock = async () => {
    if (!user?.id || trustRequesting || trustCooldown || trustPending) return;
    setTrustRequesting(true);
    try {
      const { error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "request_trust_unlock", user_id: user.id, data: {} },
      });
      if (error) throw error;
      setTrustPending(true);
    } catch (err: any) {
      console.error("Trust unlock error:", err);
    } finally {
      setTrustRequesting(false);
    }
  };

  const requestCancellation = async () => {
    if (!user?.id || cancelRequesting || cancelPending) return;
    setCancelRequesting(true);
    try {
      await supabase.from("iptv_cancellation_requests").insert({
        user_id: user.id,
        reason: cancelReason,
      });

      // Notify admins
      await supabase.functions.invoke("push-notification", {
        body: {
          action: "send_to_admins",
          title: "🚫 Solicitação de Cancelamento",
          body: `${user.name || user.username} solicitou cancelamento do plano IPTV.`,
        },
      });

      setCancelPending(true);
      setShowCancelModal(false);
      setCancelReason("");
    } catch (err: any) {
      console.error("Cancel request error:", err);
    } finally {
      setCancelRequesting(false);
    }
  };

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
  const isOverdue = daysUntilDue < 0;

  // Auto-block: if expired and still "active", update status locally
  const effectiveStatus = isOverdue && user?.iptv_status === "active" ? "blocked" : user?.iptv_status || "active";
  const status = SYSTEM_STATUS_MAP[effectiveStatus] || SYSTEM_STATUS_MAP.active;
  const isDueToday = daysUntilDue === 0;
  const monthlyValue = Number(user?.iptv_monthly_value || 0);
  const connections = user?.iptv_connections || 1;
  const totalValue = monthlyValue * connections;

  const formattedDueDate = `${String(dueDate.getDate()).padStart(2, "0")}/${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`;

  // Progress bar: 30 days cycle
  const progressValue = Math.max(0, Math.min(100, ((30 - daysUntilDue) / 30) * 100));

  const value3m = totalValue * 3;
  const discount3m = value3m * (renewalDiscount3mPercent / 100);
  const final3m = value3m - discount3m;
  const value6m = totalValue * 6;
  const discount6m = value6m * (renewalDiscount6mPercent / 100);
  const final6m = value6m - discount6m;

  const isNearDueNotice = !isOverdue && !isDueToday && daysUntilDue >= 1 && daysUntilDue <= 4;
  const isRenewPlanWindow = isOverdue || isDueToday || (daysUntilDue >= 1 && daysUntilDue <= 5);
  const planSubtitle = isOverdue
    ? "Você está em atraso!"
    : isDueToday
      ? "Vence hoje!"
      : isNearDueNotice
        ? `Vence em ${daysUntilDue} ${daysUntilDue === 1 ? "dia" : "dias"}!`
        : "Você está em dias!";
  const mainRenewalLabel = isRenewPlanWindow ? "Renovar plano" : "Antecipar renovação";
  const renewal3mLabel = isRenewPlanWindow ? "Renovar 3 meses" : "Antecipar 3 meses";
  const renewal6mLabel = isRenewPlanWindow ? "Renovar 6 meses" : "Antecipar 6 meses";
  const renewalButtonMotion = {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.01, 1],
      y: [0, -1, 0],
      boxShadow: [
        "0 8px 18px rgba(239,68,68,0.18)",
        "0 12px 28px rgba(239,68,68,0.28)",
        "0 8px 18px rgba(239,68,68,0.18)",
      ],
    },
    transition: {
      duration: 2.8,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
    whileHover: { scale: 1.018, y: -1 },
    whileTap: { scale: 0.98, y: 0 },
  };

  const renewalOptionMotion = {
    initial: { opacity: 0.96, y: 2 },
    animate: {
      opacity: 1,
      y: 0,
      boxShadow: ["0 8px 24px rgba(0,0,0,0.22)", "0 10px 30px rgba(239,68,68,0.08)", "0 8px 24px rgba(0,0,0,0.22)"],
    },
    transition: {
      duration: 4.8,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
    whileHover: {
      y: -1,
      borderColor: "rgba(239,68,68,0.45)",
      boxShadow: "0 12px 34px rgba(239,68,68,0.12)",
    },
    whileTap: { scale: 0.992, y: 0 },
  };

  return (
    <AppLayout>
      <div className="space-y-5 pb-4">
        {/* GREETING */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between pt-1"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {getTimeGreeting()}, {user?.name?.split(" ")[0]}
            </h1>
            <p
              className={`mt-0.5 text-xs font-medium ${
                isOverdue ? "text-red-400" : isDueToday || isNearDueNotice ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {planSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor} ${status.pulse ? "animate-pulse" : ""}`} />
            <span className={`text-[11px] ${status.color}`}>{status.label}</span>
          </div>
        </motion.div>

        {/* Awaiting activation banner */}
        <PendingActivationBanner userId={user?.id} effectiveStatus={effectiveStatus} />

        {/* BANNERS (optional, minimal) */}
        <BannerCarousel />

        {/* MAIN CARD — Plan */}
        <motion.div
          id="plano"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border/50 bg-card/80 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Plano IPTV</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                R$ {totalValue.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground"> / mês</span>
              </p>
            </div>
            <div className="text-right">
              {isOverdue ? (
                <span className="text-sm font-semibold text-destructive">Vencido</span>
              ) : isDueToday ? (
                <span className="text-sm font-semibold text-destructive">Vence hoje</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Vence em <span className="font-semibold text-foreground">{daysUntilDue} dias</span>
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <Progress value={progressValue} className="h-1.5 bg-muted/20" />
          </div>

          {/* Renew button */}
          <motion.button
            type="button"
            {...renewalButtonMotion}
            onClick={() => setPixModal({ months: 1, value: totalValue, discount: 0 })}
            className="group relative mt-5 w-full overflow-hidden rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-red-500"
          >
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["0%", "430%"] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
            />
            <span className="relative z-10 inline-flex items-center justify-center gap-2">
              <CreditCard size={16} />
              {mainRenewalLabel}
            </span>
          </motion.button>
        </motion.div>

        {/* PLAN DETAILS (simple text) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border/40 bg-card/60 px-5 py-3"
        >
          {(() => {
            const tvApp = (user?.iptv_tv_app || "").toLowerCase();
            const providerName = tvApp.includes("assist")
              ? (supportInfo as any)?.assist_plus_provider
              : tvApp.includes("blessed")
                ? (supportInfo as any)?.blessed_player_provider
                : null;
            return providerName ? (
              <>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Provedor de Acesso</span>
                  <span className="text-sm font-medium text-primary">{providerName}</span>
                </div>
                <div className="border-t border-border/20" />
              </>
            ) : null;
          })()}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Servidor</span>
            <span className="text-sm font-medium text-foreground">{user?.iptv_server || "—"}</span>
          </div>
          <div className="border-t border-border/20" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Telas ativas</span>
            <span className="text-sm font-medium text-foreground">{connections}</span>
          </div>
          <div className="border-t border-border/20" />
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Validade</span>
            <div className="text-right">
              <span className="text-sm font-medium text-foreground">{formattedDueDate}</span>
              {pendingFutureExpiry && <p className="text-[10px] text-blue-400 mt-0.5">Nova: {pendingFutureExpiry}</p>}
            </div>
          </div>
        </motion.div>

        {/* COUNTDOWN WARNING (only if close to due) */}
        {daysUntilDue <= 7 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-2xl border p-4 ${
              isOverdue || isDueToday ? "border-destructive/15 bg-destructive/5" : "border-warning/15 bg-warning/5"
            }`}
          >
            <p className={`text-sm font-medium ${isOverdue || isDueToday ? "text-destructive" : "text-warning"}`}>
              {isOverdue
                ? `Vencido há ${Math.abs(daysUntilDue)} dia(s)`
                : isDueToday
                  ? "Último dia para pagamento"
                  : `Faltam ${daysUntilDue} dias para o vencimento`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Bloqueio automático às 23:59 caso não identificado pagamento.
            </p>
          </motion.div>
        )}

        {/* TRUST ACTIVE BANNER */}
        {effectiveStatus === "trust_active" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3"
          >
            <p className="text-xs font-medium text-cyan-400">🤝 Ativo em Confiança</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Você tem 3 dias para efetuar o pagamento. Caso contrário, seu acesso será bloqueado e não será possível
              solicitar novo desbloqueio de confiança.
            </p>
          </motion.div>
        )}

        {/* TRUST UNLOCK REQUEST BUTTON (only when blocked/overdue) */}
        {(effectiveStatus === "blocked" || isOverdue) && effectiveStatus !== "trust_active" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            {trustPending ? (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-center">
                <p className="text-xs font-medium text-cyan-400">⏳ Solicitação de confiança enviada</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Aguardando aprovação do suporte.</p>
              </div>
            ) : trustCooldown ? (
              <div className="rounded-2xl border border-muted/30 bg-muted/10 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Desbloqueio de confiança indisponível (30 dias de espera).
                </p>
              </div>
            ) : (
              <button
                onClick={requestTrustUnlock}
                disabled={trustRequesting}
                className="w-full rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3.5 text-sm font-semibold text-cyan-400 transition-all active:scale-[0.98] hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {trustRequesting ? "Enviando..." : "🤝 Solicitar Desbloqueio de Confiança"}
              </button>
            )}
          </motion.div>
        )}

        {/* RENEWAL OPTIONS (3m, 6m) — visual mais premium e profissional */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <motion.button
            type="button"
            {...renewalOptionMotion}
            onClick={() => setPixModal({ months: 3, value: final3m, discount: discount3m })}
            className="group relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-[#111111] via-[#141414] to-[#0c0c0c] p-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/25 hover:shadow-[0_18px_40px_rgba(255,0,0,0.08)]"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-red-600/0 via-red-500/80 to-red-600/0" />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              animate={{ opacity: [0.04, 0.08, 0.04] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(circle at top right, rgba(255,0,0,0.16), transparent 42%)" }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-wide text-muted-foreground">
                    Plano recomendado
                  </span>
                  <p className="mt-3 text-xl font-bold tracking-tight text-white">{renewal3mLabel}</p>
                  <p className="mt-1 text-sm text-white/80">
                    {formatDiscountPercent(renewalDiscount3mPercent)}% de desconto
                  </p>
                </div>

                <div className="min-w-[94px] rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-right backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                  <span className="mt-1 block text-lg font-bold text-white">R$ {final3m.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/6 pt-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Economia</p>
                  <p className="text-sm font-semibold text-red-400">R$ {discount3m.toFixed(2)}</p>
                </div>
                <div className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 transition-colors duration-300 group-hover:bg-red-500/14">
                  Selecionar oferta
                </div>
              </div>
            </div>
          </motion.button>

          <motion.button
            type="button"
            {...renewalOptionMotion}
            transition={{ ...renewalOptionMotion.transition, delay: 0.4 }}
            onClick={() => setPixModal({ months: 6, value: final6m, discount: discount6m })}
            className="group relative overflow-hidden rounded-3xl border border-red-500/22 bg-gradient-to-br from-[#120b0b] via-[#151111] to-[#0d0d0d] p-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/35 hover:shadow-[0_20px_44px_rgba(255,0,0,0.12)]"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-red-600/0 via-red-500 to-red-600/0" />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              animate={{ opacity: [0.05, 0.1, 0.05] }}
              transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(circle at top right, rgba(255,0,0,0.2), transparent 44%)" }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full border border-red-500/18 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-300">
                    Maior economia
                  </span>
                  <p className="mt-3 text-xl font-bold tracking-tight text-white">{renewal6mLabel}</p>
                  <p className="mt-1 text-sm text-white/80">
                    {formatDiscountPercent(renewalDiscount6mPercent)}% de desconto
                  </p>
                </div>

                <div className="min-w-[94px] rounded-2xl border border-red-500/18 bg-black/32 px-3 py-3 text-right backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                  <span className="mt-1 block text-lg font-bold text-white">R$ {final6m.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-red-500/10 pt-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Economia</p>
                  <p className="text-sm font-semibold text-red-400">R$ {discount6m.toFixed(2)}</p>
                </div>
                <div className="rounded-full border border-red-500/28 bg-red-500/12 px-3 py-1.5 text-[11px] font-medium text-red-200 transition-colors duration-300 group-hover:bg-red-500/16">
                  Melhor custo-benefício
                </div>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* PAYMENT HISTORY (collapsible) */}
        <PaymentHistory />

        {/* TV APP */}
        <TvAppIcons tvApps={tvApps} userApp={user?.iptv_tv_app} />

        {/* ACCESS DATA */}
        <AccessDataBlock user={user} />

        {/* ADMIN NOTES */}
        <AdminNotesBlock notes={user?.admin_notes || ""} urgent={user?.admin_notes_urgent || false} />

        {/* CANCEL REQUEST */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
          {cancelPending ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-center">
              <p className="text-xs font-medium text-destructive">⏳ Solicitação de cancelamento enviada</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Aguardando análise do suporte.</p>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full rounded-2xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive/70 transition-all active:scale-[0.98] hover:bg-destructive/10"
            >
              Solicitar Cancelamento
            </button>
          )}
        </motion.div>

        {/* SUPPORT */}
        {supportInfo && (
          <motion.div
            id="suporte"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl border border-border/40 bg-card/50 p-5"
          >
            <p className="mb-3 text-xs text-muted-foreground">Suporte</p>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/20 text-sm">👤</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{supportInfo.support_name}</p>
                <p className="text-xs text-muted-foreground">{supportInfo.support_phone}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={supportInfo.whatsapp_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-medium text-success active:scale-[0.98]"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
              <a
                href={`tel:${supportInfo.support_phone.replace(/\D/g, "")}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary active:scale-[0.98]"
              >
                <Phone size={15} /> Ligar
              </a>
            </div>
          </motion.div>
        )}

        {/* FOOTER */}
        <div className="pb-2 text-center">
          <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/25">
            <Shield size={8} /> Conexão segura · Dados protegidos
          </p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground/30">Versão: {appVersion}</p>
        </div>
      </div>

      {/* PIX Modal */}
      <AnimatePresence>
        {pixModal && (
          <PixModal
            pixModal={pixModal}
            onClose={(confirmed?: boolean) => {
              setPixModal(null);
              if (confirmed) {
                refreshProfile();
              }
            }}
            supportInfo={supportInfo}
            user={user}
          />
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-foreground mb-1">Solicitar Cancelamento</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Tem certeza que deseja solicitar o cancelamento do seu plano IPTV? O suporte analisará sua solicitação.
              </p>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Conte-nos o motivo do cancelamento..."
                  className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 rounded-xl bg-muted/20 py-3 text-sm text-muted-foreground"
                >
                  Voltar
                </button>
                <button
                  onClick={requestCancellation}
                  disabled={cancelRequesting}
                  className="flex-1 rounded-xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {cancelRequesting ? "Enviando..." : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Notification Popup (banner, image, or text from push click) */}
        {notifPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setNotifPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-full rounded-3xl border border-border bg-card shadow-2xl ${notifPopup.imageOnly ? "max-w-[94vw] p-3" : "max-w-sm p-6"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {notifPopup.bannerUrl && (
                <div
                  className={`flex w-full items-center justify-center overflow-hidden rounded-2xl bg-black/20 ${notifPopup.imageOnly ? "max-h-[85vh]" : "mb-4 max-h-[60vh]"}`}
                >
                  <img
                    src={notifPopup.bannerUrl}
                    alt={notifPopup.title || "Imagem"}
                    className="h-auto max-h-[85vh] w-auto max-w-full rounded-2xl object-contain"
                  />
                </div>
              )}
              {!notifPopup.imageOnly && notifPopup.title && (
                <h3 className="text-lg font-bold text-foreground mb-2">{notifPopup.title}</h3>
              )}
              {!notifPopup.imageOnly && notifPopup.body && (
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{notifPopup.body}</p>
              )}
              <button
                onClick={() => setNotifPopup(null)}
                className={`w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground ${notifPopup.imageOnly ? "mt-3" : "mt-5"}`}
              >
                Entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default ClientDashboard;
