import { useState, useEffect, useRef } from "react";
import { Download, Smartphone, Share2 } from "lucide-react";
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
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

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

  if (isInstalled || isStandalone) return <>{children}</>;
  if (isDesktop) return <>{children}</>;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSHelp(true);
      return;
    }
    if (!deferredPrompt) {
      // Fallback: try to trigger via menu
      setShowIOSHelp(true);
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      {/* Logo */}
      <div className="mb-6 overflow-hidden rounded-3xl shadow-2xl ring-4 ring-primary/20" style={{ width: 120, height: 120 }}>
        <img src={logoBitz} alt="Bitz IPTV" className="h-full w-full object-cover" />
      </div>

      <h1 className="mb-1 text-3xl font-bold text-foreground">Bitz IPTV</h1>
      <p className="mb-8 text-sm text-muted-foreground">Programa de Fidelidade</p>

      <div className="w-full max-w-sm space-y-4">
        {/* Main download button */}
        <Button
          onClick={handleInstallClick}
          disabled={installing}
          className="h-16 w-full text-lg font-bold rounded-2xl shadow-lg gap-3"
          size="lg"
        >
          <Download size={24} />
          {installing ? "Baixando..." : "📲 Baixar Aplicativo"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Gratuito • Rápido • Sem loja de apps
        </p>

        {/* iOS instructions (shown after tap) */}
        {showIOSHelp && isIOS && (
          <div className="animate-fade-in rounded-2xl border border-border bg-card p-5 text-left shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Share2 size={20} />
              <h3 className="font-bold">Como instalar no iPhone</h3>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span>Toque em <strong className="text-foreground">Compartilhar</strong> (ícone <span className="text-primary font-bold">↑</span>) na barra do Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span>Toque em <strong className="text-foreground">"Adicionar à Tela de Início"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <span>Toque em <strong className="text-foreground">"Adicionar"</strong> para confirmar</span>
              </li>
            </ol>
          </div>
        )}

        {/* Android fallback instructions (shown if no prompt available) */}
        {showIOSHelp && !isIOS && (
          <div className="animate-fade-in rounded-2xl border border-border bg-card p-5 text-left shadow-lg">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Smartphone size={20} />
              <h3 className="font-bold">Como instalar no Android</h3>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span>Toque no menu <strong className="text-foreground">⋮</strong> (três pontos) do navegador</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span>Toque em <strong className="text-foreground">"Instalar aplicativo"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <span>Confirme a instalação</span>
              </li>
            </ol>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/50">
          Após instalar, abra o app pela tela inicial do seu celular.
        </p>
      </div>
    </div>
  );
};
