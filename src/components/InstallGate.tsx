import { useState, useEffect, useRef } from "react";
import { Download, Smartphone, Share2, Shield, Zap, Bell, Gift, Monitor, Star, CheckCircle2, Lock } from "lucide-react";
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

const DOWNLOAD_COUNT = 12847;

export const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [adminBypass, setAdminBypass] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Admin bypass via URL param
    const params = new URLSearchParams(window.location.search);
    if (params.get("bypass") === "admin") {
      setAdminBypass(true);
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    setIsDesktop(!mobile);
    setIsIOS(/iPhone|iPad|iPod/i.test(ua));

    if (standalone) setIsInstalled(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isInstalled || isStandalone || isDesktop || adminBypass) {
    return <>{children}</>;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowHelp(true);
      return;
    }
    if (!deferredPrompt) {
      setShowHelp(true);
      return;
    }
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
      {/* Background particles/glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-6 py-10">
        {/* === LOGO + SPLASH === */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-4 mt-6"
        >
          <div className="relative">
            {/* Glow ring */}
            <div className="absolute -inset-3 animate-pulse rounded-3xl bg-primary/20 blur-xl" />
            <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-2 ring-primary/30" style={{ width: 100, height: 100 }}>
              <img src={logoBitz} alt="Bitz IPTV" className="h-full w-full object-cover" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mb-1 text-center">
          <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">BITZ IPTV</h1>
          <p className="mt-1 text-xs text-muted-foreground">Programa Oficial de Fidelidade</p>
        </motion.div>

        {/* === OFFICIAL BADGE === */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
          className="mb-6 flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-1.5">
          <CheckCircle2 size={14} className="text-success" />
          <span className="text-xs font-semibold text-success">Aplicativo Oficial Verificado</span>
        </motion.div>

        {/* === SECURITY NOTICE === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="mb-6 w-full max-w-sm rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
            <Lock size={16} />
            <span>Acesso exclusivo via aplicativo oficial</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Para segurança e melhor desempenho, o acesso é permitido apenas pelo app instalado.
          </p>
        </motion.div>

        {/* === PHONE MOCKUP === */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="relative mb-6 w-full max-w-[200px]">
          <div className="relative mx-auto overflow-hidden rounded-[2rem] border-4 border-muted/50 bg-card shadow-2xl" style={{ aspectRatio: "9/16" }}>
            {/* Status bar mock */}
            <div className="flex h-6 items-center justify-center bg-muted/30">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            </div>
            {/* App screen mock */}
            <div className="flex flex-1 flex-col items-center p-3">
              <div className="mb-2 h-8 w-8 overflow-hidden rounded-lg">
                <img src={logoBitz} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="mb-3 h-1.5 w-16 rounded-full bg-primary/30" />
              <div className="w-full space-y-1.5">
                <div className="h-8 rounded-lg bg-success/10 border border-success/20" />
                <div className="grid grid-cols-2 gap-1">
                  <div className="h-12 rounded-lg bg-muted/30" />
                  <div className="h-12 rounded-lg bg-muted/30" />
                </div>
                <div className="h-10 rounded-lg bg-muted/20" />
                <div className="h-10 rounded-lg bg-muted/20" />
                <div className="h-8 rounded-lg bg-secondary/20" />
              </div>
            </div>
          </div>
          {/* Glow behind phone */}
          <div className="absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-gradient-to-b from-primary/10 to-accent/10 blur-2xl" />
        </motion.div>

        {/* === BENEFITS === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="mb-6 w-full max-w-sm space-y-2">
          {BENEFITS.map((b, i) => (
            <motion.div key={b.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-card/50 px-4 py-2.5 border border-border/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <b.icon size={16} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{b.label}</span>
              <CheckCircle2 size={14} className="ml-auto text-success/60" />
            </motion.div>
          ))}
        </motion.div>

        {/* === STATS === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="mb-6 flex w-full max-w-sm items-center justify-center gap-6">
          <div className="text-center">
            <p className="font-display text-lg font-bold text-foreground">{DOWNLOAD_COUNT.toLocaleString("pt-BR")}+</p>
            <p className="text-[10px] text-muted-foreground">Downloads</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={14} className={s <= 4 ? "fill-secondary text-secondary" : "fill-secondary/50 text-secondary/50"} />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">4.9 / 5.0</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="font-display text-lg font-bold text-foreground">100%</p>
            <p className="text-[10px] text-muted-foreground">Gratuito</p>
          </div>
        </motion.div>

        {/* === INSTALL BUTTON === */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="w-full max-w-sm">
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-5 font-display text-base font-bold tracking-wide text-primary-foreground shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <Download size={22} />
            {installing ? "INSTALANDO..." : "INSTALAR APLICATIVO OFICIAL"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Versão mais segura e estável • Sem loja de apps
          </p>
        </motion.div>

        {/* === HELP PANELS === */}
        <AnimatePresence>
          {showHelp && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="mt-4 w-full max-w-sm">
              {isIOS ? (
                <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-xl">
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Share2 size={18} />
                    <h3 className="font-bold text-sm">Como instalar no iPhone</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    {[
                      <>Toque em <strong className="text-foreground">Compartilhar</strong> (<span className="text-primary font-bold">↑</span>) na barra do Safari</>,
                      <>Toque em <strong className="text-foreground">"Adicionar à Tela de Início"</strong></>,
                      <>Toque em <strong className="text-foreground">"Adicionar"</strong> para confirmar</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-xl">
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Smartphone size={18} />
                    <h3 className="font-bold text-sm">Como instalar no Android</h3>
                  </div>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    {[
                      <>Toque no menu <strong className="text-foreground">⋮</strong> (três pontos) do navegador</>,
                      <>Toque em <strong className="text-foreground">"Instalar aplicativo"</strong></>,
                      <>Confirme a instalação</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* === SECURITY FOOTER === */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="mt-8 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/50">
            <Shield size={10} />
            <span>Conexão segura · Dados criptografados</span>
          </div>
          <p className="text-[10px] text-muted-foreground/30">
            © Bitz IPTV 2026 · Todos os direitos reservados
          </p>
        </motion.div>
      </div>
    </div>
  );
};
