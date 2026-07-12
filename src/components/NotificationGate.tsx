import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, BellOff, Loader2, Shield } from "lucide-react";
import { useAppBranding } from "@/hooks/useAppBranding";
import { useAuth } from "@/contexts/AuthContext";
import {
  enablePushNotifications,
  getPushNotificationState,
  isPushNotificationSupported,
  PUSH_DISABLED_STORAGE,
  PUSH_STATE_CHANGED_EVENT,
} from "@/lib/pushNotifications";

const isAndroidDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
};

type NotificationGateState =
  | "checking"
  | "not-required"
  | "active"
  | "default"
  | "denied"
  | "unsupported"
  | "inactive"
  | "error";

export const NotificationGate = ({ children }: { children: React.ReactNode }) => {
  const android = useMemo(() => isAndroidDevice(), []);
  const { user, loading: authLoading } = useAuth();
  const [gateState, setGateState] = useState<NotificationGateState>(() =>
    android ? "checking" : "not-required",
  );
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "WMCPLAYER";
  const appTitleUpper = appTitle.toUpperCase();

  const checkNotifications = useCallback(async () => {
    if (!android) {
      setGateState("not-required");
      return;
    }

    if (!isPushNotificationSupported()) {
      setGateState("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "default") {
      setGateState("default");
      return;
    }

    if (permission === "denied") {
      setGateState("denied");
      return;
    }

    if (authLoading) {
      setGateState("checking");
      return;
    }

    const disabledByUser = localStorage.getItem(PUSH_DISABLED_STORAGE) === "1";

    // Antes do login, a permissão concedida já libera a tela de acesso.
    // Assim que o usuário entra, a inscrição Push completa é conferida abaixo.
    if (!user?.id) {
      setGateState(disabledByUser ? "inactive" : "active");
      return;
    }

    try {
      const state = await getPushNotificationState();
      setGateState(state.enabled ? "active" : "inactive");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar se as notificações estão ativas.",
      );
      setGateState("error");
    }
  }, [android, authLoading, user?.id]);

  useEffect(() => {
    if (!android) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkNotifications();
    };
    const onPushStateChanged = () => void checkNotifications();

    void checkNotifications();
    window.addEventListener("focus", onPushStateChanged);
    window.addEventListener("pageshow", onPushStateChanged);
    window.addEventListener(PUSH_STATE_CHANGED_EVENT, onPushStateChanged);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onPushStateChanged);
      window.removeEventListener("pageshow", onPushStateChanged);
      window.removeEventListener(PUSH_STATE_CHANGED_EVENT, onPushStateChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [android, checkNotifications]);

  const handleActivate = async () => {
    if (!android) return;

    setRequesting(true);
    setErrorMessage("");

    try {
      await enablePushNotifications({
        userId: user?.id,
        requestPermission: true,
        forceServerSync: true,
      });
      await checkNotifications();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível ativar as notificações.";
      setErrorMessage(message);

      if (Notification.permission === "denied") {
        setGateState("denied");
      } else {
        setGateState("error");
      }
    } finally {
      setRequesting(false);
    }
  };

  // A obrigatoriedade continua somente no Android.
  // iPhone, iPad e computadores não são bloqueados pela permissão Push.
  if (!android || gateState === "not-required" || gateState === "active") {
    return <>{children}</>;
  }

  if (gateState === "checking") {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background">
        <Loader2 size={30} className="animate-spin text-primary" />
      </div>
    );
  }

  const isDenied = gateState === "denied" || gateState === "unsupported";
  const title = isDenied
    ? "Ative as notificações do Android"
    : gateState === "inactive"
      ? "Notificações desativadas"
      : gateState === "error"
        ? "Não foi possível confirmar as notificações"
        : "Notificações obrigatórias";

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center overflow-y-auto bg-background p-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        <div
          className="relative mb-4 overflow-hidden rounded-3xl shadow-2xl ring-2 ring-primary/30"
          style={{ width: 80, height: 80 }}
        >
          <img src={logoUrl} alt={appTitle} className="h-full w-full object-contain" />
        </div>

        <h1 className="mb-1 font-display text-xl font-bold tracking-wider text-foreground">
          {appTitleUpper}
        </h1>
        <p className="mb-6 text-xs text-muted-foreground">Aplicativo oficial</p>

        <div className="w-full rounded-2xl border border-white/5 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {isDenied ? (
                <BellOff size={32} className="text-destructive" />
              ) : (
                <Bell size={32} className="text-primary" />
              )}
            </div>

            <h2 className="mb-2 text-lg font-bold text-foreground">{title}</h2>

            <p className="mb-5 text-sm leading-6 text-muted-foreground">
              {gateState === "unsupported"
                ? "Para usar o aplicativo no Android, abra pelo Google Chrome, instale na tela inicial e permita as notificações."
                : gateState === "denied"
                  ? "As notificações estão bloqueadas. No Android, elas precisam estar permitidas para entrar no aplicativo."
                  : gateState === "inactive"
                    ? "A permissão existe, mas a inscrição de notificações não está ativa. Ative agora para continuar usando o aplicativo."
                    : gateState === "error"
                      ? "O aplicativo precisa confirmar a inscrição das notificações antes de liberar o acesso."
                      : "Para usar o aplicativo no Android, é obrigatório permitir as notificações. Elas são usadas para avisos importantes da sua conta."}
            </p>

            {errorMessage && (
              <p className="mb-4 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-xs text-red-300">
                {errorMessage}
              </p>
            )}

            {isDenied ? (
              <div className="w-full space-y-3">
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
                    <div className="text-left text-xs text-yellow-400">
                      <p className="mb-1 font-semibold">Como liberar no Android:</p>
                      <ol className="list-decimal space-y-1 pl-4 text-yellow-400/80">
                        <li>Abra as Configurações do celular.</li>
                        <li>Entre em Aplicativos e abra WMCPLAYER ou Google Chrome.</li>
                        <li>Toque em Notificações e permita o acesso.</li>
                        <li>Volte ao aplicativo e toque no botão abaixo.</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void checkNotifications()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3.5 font-semibold text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
                >
                  Já ativei, verificar novamente
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleActivate}
                disabled={requesting}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {requesting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Bell size={20} />
                )}
                {requesting ? "ATIVANDO..." : "ATIVAR NOTIFICAÇÕES"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
          <Shield size={9} />
          <span>Conexão segura · {appTitle}</span>
        </div>
      </motion.div>
    </div>
  );
};
