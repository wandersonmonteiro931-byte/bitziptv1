import { useState, useEffect, useRef } from "react";
import { Download, Smartphone, Share2, Shield, Zap, Bell, Gift, Monitor, Star, CheckCircle2, Lock, ChevronRight, Settings, ArrowDown, Plus, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoBitz from "@/assets/logo-bitz.jpg";

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

export const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");
  const [adminBypass, setAdminBypass] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("bypass") === "admin") setAdminBypass(true);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    setIsDesktop(!mobile);
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIOS(ios);
    setActiveTab(ios ? "ios" : "android");

    if (standalone) setIsInstalled(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || adminBypass) {
    return <>{children}</>;
  }

  const handleInstallClick = async () => {
    if (isIOS || !deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setIsInstalled(true);
    } catch {}
    setInstalling(false);
    setDeferredPrompt(null);
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
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="mb-3">
          <div className="relative">
            <div className="absolute -inset-3 animate-pulse rounded-3xl bg-primary/20 blur-xl" />
            <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-2 ring-primary/30" style={{ width: 88, height: 88 }}>
              <img src={logoBitz} alt="Bitz IPTV" className="h-full w-full object-cover" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-1 text-center">
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground">BITZ IPTV</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Programa Oficial de Fidelidade</p>
        </motion.div>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
          className="mb-4 flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1">
          <CheckCircle2 size={12} className="text-success" />
          <span className="text-[11px] font-semibold text-success">Aplicativo Oficial Verificado</span>
        </motion.div>

        {/* Security notice */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mb-5 w-full max-w-sm rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
            <Lock size={14} /> Acesso exclusivo via aplicativo
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Para segurança e desempenho, instale o app oficial.</p>
        </motion.div>

        {/* Stats row */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="mb-5 flex w-full max-w-sm items-center justify-center gap-5">
          <div className="text-center">
            <p className="font-display text-base font-bold text-foreground">3.000+</p>
            <p className="text-[9px] text-muted-foreground">Clientes ativos</p>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={11} className={s <= 4 ? "fill-secondary text-secondary" : "fill-secondary/50 text-secondary/50"} />
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mb-6 w-full max-w-sm">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Instalação rápida</span>
            <span className="text-primary font-semibold">Menos de 1 minuto</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
            <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ delay: 0.5, duration: 2, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent" />
          </div>
        </motion.div>

        {/* === HOW TO INSTALL SECTION === */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="w-full max-w-sm">
          <h2 className="mb-3 text-center text-sm font-bold text-foreground">📱 Como Instalar</h2>

          {/* Tabs */}
          <div className="mb-4 flex overflow-hidden rounded-xl border border-border bg-muted/20">
            <button onClick={() => setActiveTab("android")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${activeTab === "android" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Smartphone size={14} /> Android
              {!isIOS && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[9px]">Seu</span>}
            </button>
            <button onClick={() => setActiveTab("ios")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${activeTab === "ios" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              🍎 iPhone
              {isIOS && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[9px]">Seu</span>}
            </button>
          </div>

          {/* Tutorial content */}
          <AnimatePresence mode="wait">
            {activeTab === "android" ? (
              <motion.div key="android" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }}
                className="space-y-3">
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
                      <p className="text-[10px] text-muted-foreground">Ícone na tela inicial do celular</p>
                    </div>
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <div className="h-7 w-7 overflow-hidden rounded-lg border border-primary/30">
                        <img src={logoBitz} alt="" className="h-full w-full object-cover" />
                      </div>
                    </motion.div>
                  </div>
                </TutorialStep>
              </motion.div>
            ) : (
              <motion.div key="ios" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}
                className="space-y-3">
                <TutorialStep step={1} delay={0}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                      <Share2 size={18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Toque em Compartilhar</p>
                      <p className="text-[10px] text-muted-foreground">Ícone <span className="font-bold text-primary">↑</span> na barra do Safari</p>
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
                      <p className="text-[10px] text-muted-foreground">App será adicionado à sua tela</p>
                    </div>
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                      <div className="h-7 w-7 overflow-hidden rounded-lg border border-primary/30">
                        <img src={logoBitz} alt="" className="h-full w-full object-cover" />
                      </div>
                    </motion.div>
                  </div>
                </TutorialStep>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Benefits compact */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="mt-6 w-full max-w-sm">
          <div className="grid grid-cols-2 gap-2">
            {BENEFITS.map((b, i) => (
              <div key={b.label} className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/50 px-3 py-2">
                <b.icon size={14} className="shrink-0 text-primary" />
                <span className="text-[11px] font-medium text-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="mt-8 space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40">
            <Shield size={9} /> Conexão segura · Dados criptografados
          </div>
          <p className="text-[10px] text-muted-foreground/25">© Bitz IPTV 2026 · Todos os direitos reservados</p>
        </motion.div>
      </div>

      {/* === FIXED CTA BUTTON === */}
      <div className="fixed bottom-0 left-0 right-0 z-[10000] border-t border-primary/20 bg-background/95 backdrop-blur-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
        <div className="px-4 pb-2 pt-3">
          <button onClick={handleInstallClick} disabled={installing}
            className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-4 font-display text-sm font-bold tracking-wide text-primary-foreground shadow-[0_-4px_30px_hsl(210_100%_55%/0.3)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <Download size={20} />
            {installing ? "INSTALANDO..." : "INSTALAR APLICATIVO OFICIAL"}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
            Acesso liberado somente pelo app · Gratuito
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Animated sub-components ---

function TutorialStep({ step, delay, children }: { step: number; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + delay }}
      className="rounded-xl border border-border/50 bg-card/60 p-3">
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
    <motion.div animate={{ y: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}
      className="text-lg">
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
