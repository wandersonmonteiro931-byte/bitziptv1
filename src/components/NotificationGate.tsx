import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Shield, AlertTriangle } from "lucide-react";
import logoBitz from "@/assets/logo-bitz.jpg";

export const NotificationGate = ({ children }: { children: React.ReactNode }) => {
  const [permission, setPermission] = useState<string>("loading");
  const [requesting, setRequesting] = useState(false);
  const [notificationSupported, setNotificationSupported] = useState(true);

  const checkPermission = useCallback(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Not supported — still block but show instructions
      setNotificationSupported(false);
      setPermission("unsupported");
      return;
    }
    setNotificationSupported(true);
    setPermission(Notification.permission);
  }, []);

  // Check on mount and every 30 seconds
  useEffect(() => {
    checkPermission();
    const interval = setInterval(checkPermission, 30000);
    return () => clearInterval(interval);
  }, [checkPermission]);

  const handleRequest = async () => {
    if (!("Notification" in window)) return;
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      // ignore
    }
    setRequesting(false);
  };

  // Show loading briefly
  if (permission === "loading") {
    return null;
  }

  // ONLY allow through if explicitly granted
  if (permission === "granted") {
    return <>{children}</>;
  }

  const isDenied = permission === "denied" || permission === "unsupported";

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center overflow-y-auto bg-background p-5">
      {/* BG glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        {/* Logo */}
        <div className="relative mb-4">
          <div className="absolute -inset-3 animate-pulse rounded-3xl bg-primary/20 blur-xl" />
          <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-2 ring-primary/30" style={{ width: 80, height: 80 }}>
            <img src={logoBitz} alt="Bitz IPTV" className="h-full w-full object-cover" />
          </div>
        </div>

        <h1 className="font-display text-xl font-bold tracking-wider text-foreground mb-1">BITZ IPTV</h1>
        <p className="text-xs text-muted-foreground mb-6">Plataforma Oficial de Fidelidade</p>

        {/* Card */}
        <div className="w-full rounded-2xl border border-white/5 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {isDenied ? (
                <BellOff size={32} className="text-destructive" />
              ) : (
                <Bell size={32} className="text-primary" />
              )}
            </div>

            <h2 className="text-lg font-bold text-foreground mb-2">
              {isDenied ? "Notificações Bloqueadas" : "Ative as Notificações"}
            </h2>

            <p className="text-sm text-muted-foreground mb-5">
              {!notificationSupported
                ? "Seu navegador não suporta notificações push. Instale o aplicativo pela tela inicial para ativar as notificações e continuar usando."
                : isDenied
                ? "As notificações estão bloqueadas no seu navegador. Para usar o app, você precisa ativá-las nas configurações do celular."
                : "Para continuar usando o app, é obrigatório ativar as notificações push. Você receberá avisos importantes sobre sua conta."}
            </p>

            {isDenied ? (
              <div className="w-full space-y-3">
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
                    <div className="text-left text-xs text-yellow-400">
                      <p className="font-semibold mb-1">Como ativar:</p>
                      <ol className="list-decimal pl-3 space-y-0.5 text-yellow-400/80">
                        <li>Abra as <strong>Configurações</strong> do celular</li>
                        <li>Vá em <strong>Notificações</strong> → <strong>Navegador</strong></li>
                        <li>Permita notificações para este site</li>
                        <li>Volte e recarregue o app</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3.5 font-semibold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
                >
                  Já ativei, recarregar
                </button>
              </div>
            ) : (
              <button
                onClick={handleRequest}
                disabled={requesting}
                className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
              >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <Bell size={20} />
                {requesting ? "Aguarde..." : "ATIVAR NOTIFICAÇÕES"}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
          <Shield size={9} />
          <span>Conexão segura · Bitz IPTV © 2026</span>
        </div>
      </motion.div>
    </div>
  );
};
