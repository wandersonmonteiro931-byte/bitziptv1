import { useState, useEffect, useRef, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion } from "framer-motion";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useAppBranding } from "@/hooks/useAppBranding";

declare const __BUILD_TIMESTAMP__: number;

const UPDATE_CHECK_INTERVAL_MS = 3_000;
const RELOAD_GUARD_KEY = "wmcflix_update_reloaded_build";

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadingRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "Bitz IPTV";

  const forceShowUpdatePrompt = useCallback(() => {
    if (updating || reloadingRef.current) return;
    setShowPrompt(true);
  }, [updating]);

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      forceShowUpdatePrompt();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;

      const checkForUpdate = async () => {
        if (updating || reloadingRef.current) return;

        try {
          await registration.update();
        } catch {
          return;
        }

        if (registration.waiting || registration.installing) {
          forceShowUpdatePrompt();
        }
      };

      checkForUpdate();
      intervalRef.current = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });

      window.addEventListener("focus", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    const handleControllerChange = () => {
      if (reloadingRef.current) return;

      reloadingRef.current = true;
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(__BUILD_TIMESTAMP__));
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const registration = registrationRef.current;

    try {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      if (registration?.installing) {
        registration.installing.postMessage({ type: "SKIP_WAITING" });
      }

      await updateServiceWorker(true);
    } catch {
      // Fallback obrigatório para não deixar o usuário preso em versão antiga.
    }

    setTimeout(() => {
      if (!reloadingRef.current) {
        reloadingRef.current = true;
        window.location.reload();
      }
    }, 900);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black p-6">
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-sm rounded-2xl border border-red-500/25 bg-zinc-950 p-6 text-center shadow-2xl shadow-red-500/10"
      >
        <div className="mx-auto mb-6">
          <img
            src={logoUrl}
            alt={appTitle}
            className="mx-auto h-20 w-20 rounded-2xl object-contain shadow-lg shadow-red-500/20"
          />
        </div>

        <motion.div
          animate={{ rotate: updating ? 360 : 0 }}
          transition={{ duration: 1, repeat: updating ? Infinity : 0, ease: "linear" }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15"
        >
          {updating ? (
            <RefreshCw size={28} className="text-red-500" />
          ) : (
            <AlertTriangle size={28} className="text-red-500" />
          )}
        </motion.div>

        <h2 className="text-xl font-bold text-white">Atualização obrigatória</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Uma nova versão foi publicada. Para continuar usando o sistema, atualize agora.
        </p>

        <button
          onClick={handleUpdate}
          disabled={updating}
          className="mt-6 w-full rounded-xl bg-red-600 py-4 text-base font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:bg-red-500 active:scale-[0.97] disabled:opacity-70"
        >
          {updating ? "Atualizando..." : "Atualizar agora"}
        </button>

        <p className="mt-3 text-[10px] text-zinc-500">
          Todos os usuários serão obrigados a carregar a versão mais recente.
        </p>
      </motion.div>
    </div>
  );
}
