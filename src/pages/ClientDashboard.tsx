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
import { getFhdImageUrl, preloadFhdImage } from "@/lib/imageQuality";
import {
  addBillingMonthsByFixedDay,
  addDays,
  calculateFirstCycleCharge,
  formatDateBR,
  getBillingGraceDays,
  getNextBillingDueDate,
  getFirstCycleStartDate,
  getFixedBillingCycleStartDate,
  parseDateOnly,
  pickBillingDueDate,
  toBrazilDateOnlyString,
  toDateOnlyString,
} from "@/lib/billing";

import appAssistPlus from "@/assets/app-assist-plus.webp";
import appBlessedPlayer from "@/assets/app-blessed-player.png";
import appMaxPlayer from "@/assets/app-max-player.png";
import appSmarters from "@/assets/app-smarters-pro.png";

declare const __BUILD_TIMESTAMP__: number;

type AppVersionState = {
  buildId?: string;
  version?: string;
};

const APP_VERSION_STORAGE_KEY = "wmcflix_app_version_state_v2";
const LEGACY_APP_VERSION_STORAGE_KEYS = ["wmcflix_app_version_state_v1", "bitz_app_version_state_v1"];
const APP_VERSION_INITIAL = "v1.1";

const getLocalBuildId = () => String(typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : Date.now());

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

const parseVersionState = (raw: string | null): AppVersionState | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AppVersionState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const readAppVersionState = (): AppVersionState | null => {
  if (typeof window === "undefined") return null;

  const current = parseVersionState(localStorage.getItem(APP_VERSION_STORAGE_KEY));
  if (current?.version) return current;

  for (const key of LEGACY_APP_VERSION_STORAGE_KEYS) {
    const legacy = parseVersionState(localStorage.getItem(key));
    if (legacy?.version) return legacy;
  }

  return null;
};

const cleanLegacyVersionKeys = () => {
  if (typeof window === "undefined") return;

  LEGACY_APP_VERSION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

const calculateAndStoreAppVersion = (buildId: string) => {
  const fallback = APP_VERSION_INITIAL;

  if (typeof window === "undefined") return fallback;

  try {
    const stored = readAppVersionState();

    if (stored?.buildId === buildId && stored?.version) {
      cleanLegacyVersionKeys();
      localStorage.setItem(APP_VERSION_STORAGE_KEY, JSON.stringify(stored));
      return stored.version;
    }

    const nextVersion = stored?.version ? incrementAppVersion(stored.version) : fallback;
    const state: AppVersionState = {
      buildId,
      version: nextVersion,
    };

    localStorage.setItem(APP_VERSION_STORAGE_KEY, JSON.stringify(state));
    cleanLegacyVersionKeys();

    return nextVersion;
  } catch {
    return fallback;
  }
};

const getCurrentAppVersion = () => {
  const stored = readAppVersionState();
  return stored?.version || APP_VERSION_INITIAL;
};

const syncCurrentAppVersion = async () => {
  let buildId = getLocalBuildId();

  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (response.ok) {
      const remote = (await response.json()) as { buildId?: string; buildTimestamp?: number; version?: string };
      buildId = String(remote.buildId || remote.buildTimestamp || remote.version || buildId);
    }
  } catch {
    // Sem internet/cache offline: usa o build embutido no pacote atual.
  }

  return calculateAndStoreAppVersion(buildId);
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
const optimizeImageUrl = (url: string, width = 1920): string => getFhdImageUrl(url, width);

function BannerCarousel() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef(0);
  const loadedIdsRef = useRef<Set<string>>(new Set());

  const markLoaded = useCallback((id: string) => {
    setLoadedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      loadedIdsRef.current = next;
      return next;
    });
  }, []);

  const preloadBanner = useCallback(
    async (banner: any) => {
      if (!banner) return;

      if (!banner.banner_url) {
        markLoaded(banner.id);
        return;
      }

      await preloadFhdImage(banner.banner_url, 1600);
      markLoaded(banner.id);
    },
    [markLoaded],
  );

  const goToSlide = useCallback(
    async (targetIndex: number) => {
      if (!banners.length) return;

      const normalizedIndex = (targetIndex + banners.length) % banners.length;
      const nextBanner = banners[normalizedIndex];

      // Nunca troca para imagem ainda carregando. Isso evita piscar preto.
      if (!loadedIdsRef.current.has(nextBanner.id)) {
        await preloadBanner(nextBanner);
      }

      if (!loadedIdsRef.current.has(nextBanner.id)) return;

      setCurrent(normalizedIndex);

      // Prepara a próxima imagem antes da transição seguinte.
      const afterNext = banners[(normalizedIndex + 1) % banners.length];
      void preloadBanner(afterNext);
    },
    [banners, preloadBanner],
  );

  useEffect(() => {
    const now = new Date().toISOString();

    supabase
      .from("content")
      .select("id, title, body, banner_url, redirect_url, sort_order, ends_at, display_duration_seconds")
      .eq("is_active", true)
      .eq("content_type", "banner")
      .lte("starts_at", now)
      .order("sort_order")
      .then(({ data }) => {
        const active = ((data as any[]) || []).filter((b: any) => !b.ends_at || b.ends_at > now);
        setBanners(active);
        setCurrent(0);
        setLoadedIds(new Set());
        loadedIdsRef.current = new Set();

        // Carrega todas em FHD em paralelo, sem cortar e sem perder qualidade.
        active.forEach((banner: any) => void preloadBanner(banner));
      });
  }, [preloadBanner]);

  useEffect(() => {
    loadedIdsRef.current = loadedIds;
  }, [loadedIds]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (banners.length <= 1) return;

    const currentBanner = banners[current] || banners[0];
    const seconds = Math.max(2, Math.min(60, Number(currentBanner?.display_duration_seconds || 5)));

    timeoutRef.current = setTimeout(() => {
      void goToSlide(current + 1);
    }, seconds * 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [banners, current, goToSlide]);

  if (banners.length === 0) return null;

  const firstReady = banners.length > 0 && loadedIds.has(banners[0].id);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      void goToSlide(diff > 0 ? current + 1 : current - 1);
    }
  };

  // Antes da primeira imagem estar pronta, mantém espaço limpo.
  // Depois disso, nunca mostra placeholder preto entre slides.
  if (!firstReady) {
    return (
      <div className="mx-4 mt-2 mb-4">
        <div className="h-40 w-full rounded-[20px] bg-transparent" />
      </div>
    );
  }

  const banner = banners[current] || banners[0];

  const openBannerDestination = (raw?: string) => {
    const destination = String(raw || "").trim();
    if (!destination) return;

    if (
      destination.startsWith("http://") ||
      destination.startsWith("https://") ||
      destination.startsWith("tel:") ||
      destination.startsWith("mailto:") ||
      destination.startsWith("whatsapp://")
    ) {
      window.open(destination, destination.startsWith("http") ? "_blank" : "_self", "noopener,noreferrer");
      return;
    }

    if (destination.startsWith("#")) {
      document.getElementById(destination.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    navigate(destination);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="mx-4 mt-2 mb-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={() => openBannerDestination(banner.redirect_url)}
        className={`block w-full ${banner.redirect_url ? "cursor-pointer" : "cursor-default"}`}
      >
        <div
          className="relative flex w-full items-center justify-center overflow-hidden rounded-[20px] bg-transparent"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
        >
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={banner.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: "easeInOut" }}
              className="flex w-full items-center justify-center rounded-[20px] bg-transparent"
            >
              {banner.banner_url ? (
                <img
                  src={optimizeImageUrl(banner.banner_url)}
                  alt={banner.title}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="block h-auto max-h-[70vh] w-auto max-w-full rounded-[20px] object-contain"
                  draggable={false}
                />
              ) : (
                <div className="flex min-h-40 w-full flex-col items-center justify-center rounded-[20px] bg-black/70 p-6">
                  <p className="text-center text-sm font-semibold text-foreground">{banner.title}</p>
                  {banner.body && <p className="mt-1 text-center text-xs text-muted-foreground">{banner.body}</p>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </button>

      {banners.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => void goToSlide(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-primary/60" : "w-1.5 bg-muted-foreground/15"}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

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
  const [pixModal, setPixModal] = useState<PixModalData | null>(null);
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
  const [billingDueDates, setBillingDueDates] = useState<any[]>([]);
  const [appVersion, setAppVersion] = useState(() => getCurrentAppVersion());

  useEffect(() => {
    let cancelled = false;

    syncCurrentAppVersion().then((nextVersion) => {
      if (!cancelled) setAppVersion(nextVersion);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const id = decodeURIComponent(location.hash.slice(1));
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);

    return () => clearTimeout(timer);
  }, [location.hash]);

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
      await (supabase as any).rpc("auto_block_overdue_clients").catch(() => undefined);

      const [support, apps, platform, billingDates] = await Promise.all([
        supabase.from("support_settings").select("*").limit(1).maybeSingle(),
        supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
        supabase
          .from("platform_settings")
          .select("renewal_discount_3m_percent, renewal_discount_6m_percent")
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("billing_due_dates")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("day_of_month", { ascending: true }),
      ]);
      setSupportInfo(support.data);
      setTvApps(apps.data || []);
      setBillingDueDates(billingDates.data || []);

      if (platform.data) {
        setRenewalDiscount3mPercent(Number((platform.data as any).renewal_discount_3m_percent ?? 5));
        setRenewalDiscount6mPercent(Number((platform.data as any).renewal_discount_6m_percent ?? 10));
      }
    };
    loadData();

    const billingDatesChannel = supabase
      .channel("billing-due-dates-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_due_dates" }, () => {
        loadData();
        refreshProfile();
      })
      .subscribe();

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
      supabase.removeChannel(billingDatesChannel);
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

  const now = parseDateOnly(toBrazilDateOnlyString(new Date()));
  const selectedBillingDueDate = pickBillingDueDate(billingDueDates, user);
  const billingDueDay = Number(selectedBillingDueDate?.day_of_month || user?.iptv_due_day || 10);
  const billingGraceDays = getBillingGraceDays(selectedBillingDueDate, user, 5);

  let dueDate: Date;
  if (user?.iptv_expiry) {
    dueDate = parseDateOnly(user.iptv_expiry);
  } else {
    dueDate = getNextBillingDueDate(now, billingDueDay);
  }

  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / (1000 * 60 * 60 * 24),
  );
  const isOverdue = daysUntilDue < 0;
  const overdueDays = isOverdue ? Math.abs(daysUntilDue) : 0;
  const isPastGraceLimit = isOverdue && overdueDays > billingGraceDays;
  const blockAfterDate = addDays(dueDate, billingGraceDays);

  const monthlyValue = Number(user?.iptv_monthly_value || 0);
  const connections = user?.iptv_connections || 1;
  const totalValue = monthlyValue * connections;

  const billingCycleStart = getFirstCycleStartDate(user);
  const fixedCycleStart = getFixedBillingCycleStartDate(user, billingDueDay);
  const firstCycleCalc = calculateFirstCycleCharge(totalValue, billingCycleStart, billingDueDay);
  const firstCycleAlreadyPaid = Boolean(user?.billing_first_cycle_paid);
  const proportionalEnabled = Boolean(user?.billing_proportional_enabled);
  const useFirstCycleProportional = proportionalEnabled && !firstCycleAlreadyPaid && firstCycleCalc.isProportional;
  const firstCycleRenewalValue = useFirstCycleProportional ? firstCycleCalc.amount : totalValue;

  // Bloqueia somente após o limite configurado pelo admin.
  const effectiveStatus =
    isPastGraceLimit && user?.iptv_status === "active" ? "blocked" : user?.iptv_status || "active";
  const status = SYSTEM_STATUS_MAP[effectiveStatus] || SYSTEM_STATUS_MAP.active;
  const isDueToday = daysUntilDue === 0;

  const formattedDueDate = formatDateBR(dueDate);
  const formattedBlockDate = formatDateBR(blockAfterDate);

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
  const planSubtitle = isPastGraceLimit
    ? "Você está bloqueado por atraso!"
    : isOverdue
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

  useEffect(() => {
    const renew = new URLSearchParams(location.search).get("renew");
    if (!renew) return;

    const timer = setTimeout(() => {
      if (renew === "3") {
        setPixModal({ months: 3, value: final3m, discount: discount3m });
      } else if (renew === "6") {
        setPixModal({ months: 6, value: final6m, discount: discount6m });
      } else {
        setPixModal({ months: 1, value: firstCycleRenewalValue, discount: 0, billingDueDay });
      }

      window.history.replaceState(null, "", `${location.pathname}${location.hash || ""}`);
    }, 350);

    return () => clearTimeout(timer);
  }, [
    location.search,
    location.pathname,
    location.hash,
    firstCycleRenewalValue,
    final3m,
    final6m,
    discount3m,
    discount6m,
  ]);

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
          className="rounded-2xl border border-border/50 bg-black/90 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Meu plano</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                R$ {totalValue.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground"> / mês</span>
              </p>
              {useFirstCycleProportional && (
                <p className="mt-1 text-[11px] font-semibold text-red-300">
                  1º pagamento proporcional: R$ {firstCycleRenewalValue.toFixed(2)} por {firstCycleCalc.days} dia(s)
                  <br />
                  <span className="text-[10px] text-muted-foreground">
                    Base: cadastro em {formatDateBR(parseDateOnly(billingCycleStart))}
                  </span>
                </p>
              )}
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
            onClick={() =>
              setPixModal({
                months: 1,
                value: firstCycleRenewalValue,
                discount: 0,
                periodStartOverride: useFirstCycleProportional
                  ? toDateOnlyString(parseDateOnly(billingCycleStart))
                  : undefined,
                periodEndOverride: useFirstCycleProportional ? toDateOnlyString(firstCycleCalc.dueDate) : undefined,
                firstCycle: useFirstCycleProportional,
                billingDueDay,
                notes: useFirstCycleProportional
                  ? `Primeiro pagamento proporcional (${firstCycleCalc.days} dia(s)) até o vencimento unificado`
                  : undefined,
              })
            }
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
          className="rounded-2xl border border-border/40 bg-black/90 px-5 py-3"
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
            <span className="text-sm text-muted-foreground">Próximo vencimento:</span>
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
              Bloqueio automático em {formattedBlockDate}, após {billingGraceDays} dia(s) corridos de atraso.
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
              <div className="rounded-2xl border border-muted/30 bg-black px-4 py-3 text-center">
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
            onClick={() => setPixModal({ months: 3, value: final3m, discount: discount3m, billingDueDay })}
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
            onClick={() => setPixModal({ months: 6, value: final6m, discount: discount6m, billingDueDay })}
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
            className="rounded-2xl border border-border/40 bg-black/90 p-5"
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
          <p className="mt-1 text-[10px] font-semibold text-red-400/80">Versão: {appVersion}</p>
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
                  className={`flex w-full items-center justify-center overflow-hidden rounded-2xl bg-black ${notifPopup.imageOnly ? "max-h-[85vh]" : "mb-4 max-h-[60vh]"}`}
                >
                  <img
                    src={getFhdImageUrl(notifPopup.bannerUrl)}
                    alt={notifPopup.title || "Imagem"}
                    className="h-auto max-h-[85vh] w-auto max-w-full rounded-2xl object-contain bg-black"
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
