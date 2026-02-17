import { useState, useEffect, useRef } from "react";
import { Download, Smartphone, Apple, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoBitz from "@/assets/logo-bitz.jpg";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Check if already running as installed PWA (standalone)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check device type
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    setIsDesktop(!mobile);
    setIsIOS(/iPhone|iPad|iPod/i.test(ua));

    // If standalone, mark as installed
    if (standalone) {
      setIsInstalled(true);
    }

    // Listen for install prompt (Android / Chrome desktop)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect when app is installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // If running in standalone mode (installed), show the app
  if (isInstalled || isStandalone) {
    return <>{children}</>;
  }

  // On desktop, allow usage (PWA install is optional on desktop)
  if (isDesktop) {
    return <>{children}</>;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
    } catch {}
    setInstalling(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      {/* Logo */}
      <div className="mb-6 overflow-hidden rounded-3xl shadow-2xl" style={{ width: 120, height: 120 }}>
        <img src={logoBitz} alt="Bitz IPTV" className="h-full w-full object-cover" />
      </div>

      <h1 className="mb-2 text-3xl font-bold text-foreground">Bitz IPTV</h1>
      <p className="mb-8 text-muted-foreground">Programa de Fidelidade</p>

      {/* Install instructions */}
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-center gap-2 text-primary">
          <Download size={24} />
          <h2 className="text-lg font-bold">Instale o App</h2>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Para usar o Bitz IPTV, instale o aplicativo no seu dispositivo.
        </p>

        {/* Android - has beforeinstallprompt */}
        {deferredPrompt && (
          <Button
            onClick={handleInstallClick}
            disabled={installing}
            className="mb-4 h-14 w-full text-base font-bold rounded-xl"
            size="lg"
          >
            <Smartphone className="mr-2" size={20} />
            {installing ? "Instalando..." : "Instalar Agora"}
          </Button>
        )}

        {/* iOS instructions */}
        {isIOS && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4 text-left">
              <Apple className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <p className="text-sm font-semibold text-foreground">iPhone / iPad</p>
                <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                    <span>Toque no botão <strong>Compartilhar</strong> (ícone ↑) na barra do Safari</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                    <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
                    <span>Toque em <strong>"Adicionar"</strong> para confirmar</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Android without prompt (fallback) */}
        {!isIOS && !deferredPrompt && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4 text-left">
              <Smartphone className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <p className="text-sm font-semibold text-foreground">Android</p>
                <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                    <span>Toque no menu <strong>⋮</strong> (três pontos) do navegador</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                    <span>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
                    <span>Confirme a instalação</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-[11px] text-muted-foreground/60">
          Após instalar, abra o app pela tela inicial do seu celular.
        </p>
      </div>
    </div>
  );
};
