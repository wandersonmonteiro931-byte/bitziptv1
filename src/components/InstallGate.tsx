import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Plus, Share2, ShieldCheck, Smartphone } from "lucide-react";
import { APP_MANIFEST_ENDPOINT, prepareBrandingForPwaInstall, useAppBranding } from "@/hooks/useAppBranding";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensurePwaAssetsReady() {
  if (typeof window === "undefined") return;

  await prepareBrandingForPwaInstall();

  try {
    const manifestHref =
      document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href || APP_MANIFEST_ENDPOINT;
    await fetch(manifestHref, { cache: "no-store" });
  } catch {
    // O navegador ainda pode instalar o PWA mesmo se bloquear esta leitura.
  }

  if (!("serviceWorker" in navigator)) return;

  try {
    const existing = await navigator.serviceWorker.getRegistration("/app/");
    const registration = existing || (await navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }));
    await registration.update().catch(() => undefined);
    await navigator.serviceWorker.ready;
  } catch {
    // Se não houver prompt nativo, serão exibidas instruções manuais.
  }
}

const isComputerBrowser = () => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isIpadOSDesktopMode = /Macintosh/i.test(ua) && maxTouchPoints > 1;
  const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isDesktopPlatform = /Win32|Win64|Windows|MacIntel|MacPPC|Mac68K|Linux x86_64|Linux i686/i.test(platform);
  const isDesktopUserAgent = /Windows NT|Macintosh|X11|CrOS|Linux x86_64|Linux i686/i.test(ua);

  return !isIpadOSDesktopMode && !isMobileOrTablet && (isDesktopPlatform || isDesktopUserAgent);
};

export const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [showContinueMessage, setShowContinueMessage] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => isComputerBrowser());
  const [isIOS, setIsIOS] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [pwaReady, setPwaReady] = useState(false);
  const [nativeInstallReady, setNativeInstallReady] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const checkedRef = useRef(false);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "WMCPLAYER";
  const appTitleUpper = appTitle.toUpperCase();

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;

    setIsStandalone(standalone);
    setIsDesktop(isComputerBrowser());
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));

    const promptHandler = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setNativeInstallReady(true);
    };

    const installedHandler = () => {
      // A instalação não libera o sistema dentro do navegador.
      // O cliente deve fechar esta página e abrir o ícone instalado.
      setShowContinueMessage(true);
    };

    window.addEventListener("beforeinstallprompt", promptHandler);
    window.addEventListener("appinstalled", installedHandler);

    ensurePwaAssetsReady().finally(() => setPwaReady(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", promptHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // Em celular e tablet, o sistema só é liberado quando aberto como PWA instalado.
  // O navegador móvel permanece exclusivamente como página de instalação.
  if (isStandalone || isDesktop) {
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
    setShowManualSteps(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const steps = isIOS
    ? [
        { icon: Share2, title: "Toque em Compartilhar", description: "Use o botão de compartilhar do Safari." },
        { icon: Plus, title: "Adicionar à Tela de Início", description: "Encontre essa opção na lista." },
        { icon: CheckCircle2, title: "Confirme em Adicionar", description: "Depois, abra o ícone na tela inicial." },
      ]
    : [
        { icon: Download, title: "Toque em Instalar", description: "Use o botão vermelho abaixo." },
        { icon: CheckCircle2, title: "Confirme a instalação", description: "Autorize quando o navegador solicitar." },
        { icon: Smartphone, title: "Abra pela tela inicial", description: "O aplicativo ficará instalado no celular." },
      ];

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(239,35,42,0.12),transparent_42%)]" />

      <main className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-32 pt-[max(24px,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3 border-b border-white/10 pb-5">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-red-500/30 bg-black shadow-[0_10px_30px_rgba(239,35,42,0.18)]">
            <img src={logoUrl} alt={appTitle} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-extrabold tracking-wide">{appTitleUpper}</p>
            <p className="mt-0.5 text-xs text-white/55">Aplicativo oficial de fidelidade</p>
          </div>
        </header>

        <section className="pt-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
            <ShieldCheck size={14} /> Aplicativo oficial e seguro
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-[-0.04em]">
            Instale o {appTitleUpper}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
            No celular, o acesso ao sistema é liberado exclusivamente pelo aplicativo instalado na tela inicial.
          </p>
        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Como instalar</p>
              <p className="mt-0.5 text-[11px] text-white/45">{isIOS ? "iPhone e iPad" : "Celular Android"}</p>
            </div>
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
              3 passos
            </span>
          </div>

          <div className="space-y-2.5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/35 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-300">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-300">{index + 1}</span>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-4 text-white/45">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ["Rápido", "Abre em segundos"],
            ["Seguro", "Acesso protegido"],
            ["Prático", "Ícone na tela"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.025] px-2 py-3">
              <p className="text-xs font-bold text-white">{title}</p>
              <p className="mt-1 text-[9px] leading-3 text-white/35">{description}</p>
            </div>
          ))}
        </div>

        <p className="mt-7 text-center text-[10px] leading-4 text-white/25">
          Instalação gratuita. Nenhum dado do seu celular é acessado.
        </p>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-[10000] border-t border-white/10 bg-black/95 px-4 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-md">
          {showContinueMessage ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-300">
                <CheckCircle2 size={18} /> Aplicativo instalado
              </div>
              <p className="mt-1 text-[11px] leading-4 text-white/65">Este navegador continuará bloqueado. Feche esta página e abra o ícone do aplicativo na tela inicial.</p>
            </div>
          ) : showManualSteps ? (
            <div className="rounded-2xl border border-red-500/25 bg-[#130708] p-4">
              <p className="text-center text-sm font-bold">Instalação manual</p>
              <div className="mt-3 space-y-2 text-xs leading-5 text-white/65">
                {isIOS ? (
                  <>
                    <p><strong className="text-white">1.</strong> Toque em Compartilhar no Safari.</p>
                    <p><strong className="text-white">2.</strong> Toque em “Adicionar à Tela de Início”.</p>
                    <p><strong className="text-white">3.</strong> Confirme em “Adicionar”.</p>
                  </>
                ) : (
                  <>
                    <p><strong className="text-white">1.</strong> Abra o menu de três pontos do navegador.</p>
                    <p><strong className="text-white">2.</strong> Toque em “Instalar aplicativo”.</p>
                    <p><strong className="text-white">3.</strong> Confirme a instalação.</p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowManualSteps(false)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white/70"
              >
                Voltar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ef232a] px-5 py-4 text-sm font-extrabold text-white shadow-[0_12px_35px_rgba(239,35,42,0.28)] transition active:scale-[0.99] disabled:opacity-60"
            >
              <Download size={19} />
              {installing
                ? "Preparando instalação..."
                : nativeInstallReady || pwaReady
                  ? "Instalar aplicativo"
                  : "Preparar aplicativo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
