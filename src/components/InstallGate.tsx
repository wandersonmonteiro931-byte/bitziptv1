import { useState, useEffect, useRef } from "react";
import {
  Download,
  Smartphone,
  Share2,
  Shield,
  Zap,
  Bell,
  Gift,
  Monitor,
  Star,
  CheckCircle2,
  Lock,
  ChevronRight,
  Settings,
  ArrowDown,
  Plus,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppBranding } from "@/hooks/useAppBranding";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const BENEFITS = [
  { icon: Monitor, label: "Acesso completo ao servidor" },
  { icon: Zap, label: "Atualizações em tempo real" },
  { icon: Bell, label: "Notificações automáticas" },
  { icon: Gift, label: "Programa de recompensas" },
  { icon: Shield, label: "Segurança reforçada" },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensurePwaAssetsReady() {
  if (typeof window === "undefined") return;

  try {
    await fetch(`/manifest.webmanifest?install_check=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
  } catch {
    // Continua: alguns navegadores bloqueiam o fetch, mas ainda conseguem ler o manifest.
  }

  if (!("serviceWorker" in navigator)) return;

  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    const registration = existing || (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
    await registration.update().catch(() => undefined);
    await navigator.serviceWorker.ready;
  } catch {
    // Se falhar, o botão ainda mostra instruções manuais.
  }
}

const isComputerBrowser = () => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // iPadOS can masquerade as Mac in Safari desktop mode.
  // It must continue being treated as mobile/tablet, not as PC.
  const isIpadOSDesktopMode = /Macintosh/i.test(ua) && maxTouchPoints > 1;
  const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isDesktopPlatform = /Win32|Win64|Windows|MacIntel|MacPPC|Mac68K|Linux x86_64|Linux i686/i.test(platform);
  const isDesktopUserAgent = /Windows NT|Macintosh|X11|CrOS|Linux x86_64|Linux i686/i.test(ua);

  return !isIpadOSDesktopMode && !isMobileOrTablet && (isDesktopPlatform || isDesktopUserAgent);
};

export const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showContinueMessage, setShowContinueMessage] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => isComputerBrowser());
  const [isIOS, setIsIOS] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [pwaReady, setPwaReady] = useState(false);
  const [nativeInstallReady, setNativeInstallReady] = useState(false);
  const [adminBypass, setAdminBypass] = useState(false);
  const checkedRef = useRef(false);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "Bitz IPTV";
  const appTitleUpper = appTitle.toUpperCase();

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("bypass") === "admin") setAdminBypass(true);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsDesktop(isComputerBrowser());
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIOS(ios);
    // Platform auto-detected via isIOS state

    if (standalone) setIsInstalled(true);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setNativeInstallReady(true);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setShowContinueMessage(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    ensurePwaAssetsReady().finally(() => setPwaReady(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (isStandalone || adminBypass || isDesktop) {
    return <>{children}</>;
  }

  const waitForNativePrompt = async () => {
    if (deferredPromptRef.current) return deferredPromptRef.current;

    await ensurePwaAssetsReady();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (deferredPromptRef.current) return deferredPromptRef.current;
      await sleep(250);
    }

    return deferredPromptRef.current;
  };

  const handleInstallClick = async () => {
    // iOS — always show manual instructions. iOS não possui prompt nativo igual Android.
    if (isIOS) {
      setShowManualSteps(true);
      return;
    }

    setInstalling(true);

    const prompt = await waitForNativePrompt();

    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        deferredPromptRef.current = null;
        setNativeInstallReady(false);

        if (choice.outcome === "accepted") {
          setShowContinueMessage(true);
          setInstalling(false);
          return;
        }
      } catch {
        deferredPromptRef.current = null;
        setNativeInstallReady(false);
      }
    }

    setInstalling(false);

    // Sem prompt nativo: mostra instrução correta para instalar como app.
    // Depois das correções de manifest/SW, o navegador deve mostrar "Instalar aplicativo",
    // não apenas "Criar atalho".
    setShowManualSteps(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto bg-background">
      {/* BG glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/4 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-5 pb-32 pt-8">
        {/* === LOGO === */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-3"
        >
          <div className="relative">
            <div className="absolute -inset-3 animate-pulse rounded-3xl bg-primary/20 blur-xl" />
            <div
              className="relative overflow-hidden rounded-3xl shadow-2xl ring-2 ring-primary/30"
              style={{ width: 88, height: 88 }}
            >
              <img src={logoUrl} alt={appTitle} className="h-full w-full object-contain" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-1 text-center"
        >
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground">{appTitleUpper}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Programa Oficial de Fidelidade</p>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="mb-4 flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1"
        >
          <CheckCircle2 size={12} className="text-success" />
          <span className="text-[11px] font-semibold text-success">Aplicativo Oficial Verificado</span>
        </motion.div>

        {/* Security notice */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-5 w-full max-w-sm rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
            <Lock size={14} /> Acesso exclusivo via aplicativo
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Para segurança e desempenho, instale o app oficial.
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-5 flex w-full max-w-sm items-center justify-center gap-5"
        >
          <div className="text-center">
            <p className="font-display text-base font-bold text-foreground">3.000+</p>
            <p className="text-[9px] text-muted-foreground">Clientes ativos</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={11}
                  className={s <= 4 ? "fill-secondary text-secondary" : "fill-secondary/50 text-secondary/50"}
                />
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground">4.9 / 5.0</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="text-center">
            <p className="font-display text-base font-bold text-foreground">&lt;1min</p>
            <p className="text-[9px] text-muted-foreground">Instalação</p>
          </div>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-6 w-full max-w-sm"
        >
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Instalação rápida</span>
            <span className="text-primary font-semibold">Menos de 1 minuto</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.5, duration: 2, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            />
          </div>
        </motion.div>

        {/* === HOW TO INSTALL SECTION === */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-sm"
        >
          <h2 className="mb-3 text-center text-sm font-bold text-foreground">📱 Como Instalar</h2>

          {/* Platform label */}
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2">
            {isIOS ? (
              <>
                🍎 <span className="text-xs font-semibold text-foreground">Instruções para iPhone</span>
              </>
            ) : (
              <>
                <Smartphone size={14} className="text-primary" />{" "}
                <span className="text-xs font-semibold text-foreground">Instruções para Android</span>
              </>
            )}
          </div>

          {/* Tutorial content - show only the user's platform */}
          {!isIOS ? (
            <motion.div
              key="android"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <TutorialStep step={1} delay={0}>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                    <Download size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Clique em "Instalar Aplicativo"</p>
                    <p className="text-[10px] text-muted-foreground">Toque no botão abaixo</p>
                  </div>
                  <AnimatedFinger />
                </div>
              </TutorialStep>

              <TutorialStep step={2} delay={0.1}>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15">
                    <Settings size={18} className="text-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Se pedir permissão</p>
                    <p className="text-[10px] text-muted-foreground">Toque em "Permitir" → "Instalar"</p>
                  </div>
                  <CheckCircle2 size={16} className="text-success/60" />
                </div>
              </TutorialStep>

              <TutorialStep step={3} delay={0.2}>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15">
                    <CheckCircle2 size={18} className="text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Pronto! Abra o app</p>
                    <p className="text-[10px] text-muted-foreground">Ícone instalado como app na tela inicial</p>
                  </div>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <div className="h-7 w-7 overflow-hidden rounded-lg border border-primary/30">
                      <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                    </div>
                  </motion.div>
                </div>
              </TutorialStep>
            </motion.div>
          ) : (
            <motion.div key="ios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <TutorialStep step={1} delay={0}>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                    <Share2 size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Toque em Compartilhar</p>
                    <p className="text-[10px] text-muted-foreground">
                      Ícone <span className="font-bold text-primary">↑</span> na barra do Safari
                    </p>
                  </div>
                  <AnimatedArrow />
                </div>
              </TutorialStep>

              <TutorialStep step={2} delay={0.1}>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
                    <Plus size={18} className="text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">"Adicionar à Tela de Início"</p>
                    <p className="text-[10px] text-muted-foreground">Role a lista e toque na opção</p>
                  </div>
                  <AnimatedFinger />
                </div>
              </TutorialStep>

              <TutorialStep step={3} delay={0.2}>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15">
                    <CheckCircle2 size={18} className="text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Toque em "Adicionar"</p>
                    <p className="text-[10px] text-muted-foreground">App será instalado na tela inicial</p>
                  </div>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <div className="h-7 w-7 overflow-hidden rounded-lg border border-primary/30">
                      <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                    </div>
                  </motion.div>
                </div>
              </TutorialStep>
            </motion.div>
          )}
        </motion.div>

        {/* Benefits compact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6 w-full max-w-sm"
        >
          <div className="grid grid-cols-2 gap-2">
            {BENEFITS.map((b, i) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/50 px-3 py-2"
              >
                <b.icon size={14} className="shrink-0 text-primary" />
                <span className="text-[11px] font-medium text-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 space-y-1.5 text-center"
        >
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40">
            <Shield size={9} /> Conexão segura · Dados criptografados
          </div>
          <p className="text-[10px] text-muted-foreground/25">© {appTitle} 2026 · Todos os direitos reservados</p>
        </motion.div>
      </div>

      {/* === FIXED CTA BUTTON === */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[10000] border-t border-primary/20 bg-background/95 backdrop-blur-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
      >
        <div className="px-4 pb-2 pt-3">
          {showContinueMessage ? (
            <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-6 py-4">
              <CheckCircle2 size={24} className="text-success" />
              <p className="text-sm font-bold text-success">App instalado com sucesso!</p>
              <p className="text-xs text-muted-foreground text-center">
                Feche o navegador e continue pelo aplicativo na sua tela inicial.
              </p>
              <div className="mt-1 flex items-center gap-2">
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <div className="h-8 w-8 overflow-hidden rounded-xl border border-primary/30">
                    <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  </div>
                </motion.div>
                <ChevronRight size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Abra o {appTitle}</span>
              </div>
            </div>
          ) : showManualSteps ? (
            <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                <Download size={24} className="text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground text-center">Siga os passos para instalar</p>
              {isIOS ? (
                <ol className="list-none space-y-3 text-sm text-foreground w-full">
                  <li className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    <span>
                      Toque no ícone <strong className="text-primary">Compartilhar</strong> (↑) na barra do Safari
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <span>
                      Role e toque em <strong className="text-primary">"Adicionar à Tela de Início"</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <span>
                      Toque em <strong className="text-primary">"Adicionar"</strong> e abra o app
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="list-none space-y-3 text-sm text-foreground w-full">
                  <li className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    <span>
                      Toque no menu <strong className="text-primary">⋮</strong> (3 pontos) no canto superior do
                      navegador
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <span>
                      Selecione <strong className="text-primary">"Instalar aplicativo"</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <span>Confirme e abra o app pela tela inicial</span>
                  </li>
                </ol>
              )}
              <button
                onClick={() => setShowManualSteps(false)}
                className="mt-1 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
              >
                ← Tentar instalar novamente
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-4 font-display text-sm font-bold tracking-wide text-primary-foreground shadow-[0_-4px_30px_hsl(210_100%_55%/0.3)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <Download size={20} />
                {installing
                  ? "PREPARANDO INSTALAÇÃO..."
                  : nativeInstallReady || pwaReady
                    ? "INSTALAR APLICATIVO OFICIAL"
                    : "PREPARAR APP OFICIAL"}
              </button>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
                Instala como PWA oficial · Não é apenas atalho
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Animated sub-components ---

function TutorialStep({ step, delay, children }: { step: number; delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 + delay }}
      className="rounded-xl border border-border/50 bg-card/60 p-3"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {step}
        </span>
        <div className="flex-1">{children}</div>
      </div>
    </motion.div>
  );
}

function AnimatedFinger() {
  return (
    <motion.div animate={{ y: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-lg">
      👆
    </motion.div>
  );
}

function AnimatedArrow() {
  return (
    <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
      <ArrowDown size={16} className="rotate-180 text-primary" />
    </motion.div>
  );
}
