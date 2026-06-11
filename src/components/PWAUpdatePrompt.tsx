import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useAppBranding } from "@/hooks/useAppBranding";

declare const __BUILD_TIMESTAMP__: number;

type RemoteVersion = {
  buildTimestamp?: number;
  buildId?: string;
  version?: string;
};

const CHECK_INTERVAL_MS = 2500;
const UPDATE_FLAG_KEY = "wmcflix_force_update_pending";

function getCurrentBuild(): number {
  return Number(__BUILD_TIMESTAMP__ || 0);
}

async function clearOldPwaData() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

function buildReloadUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("force_update", String(Date.now()));
  return url.toString();
}

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [remoteBuild, setRemoteBuild] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadingRef = useRef(false);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "Bitz IPTV";

  const forcePrompt = useCallback((build?: number | null) => {
    if (reloadingRef.current) return;
    if (typeof build === "number") setRemoteBuild(build);
    setShowPrompt(true);
  }, []);

  const checkRemoteVersion = useCallback(async () => {
    if (updating || reloadingRef.current) return;

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) return;

      const remote = (await response.json()) as RemoteVersion;
      const remoteTimestamp = Number(remote.buildTimestamp || 0);
      const currentTimestamp = getCurrentBuild();

      if (remoteTimestamp && currentTimestamp && remoteTimestamp > currentTimestamp) {
        forcePrompt(remoteTimestamp);
      }
    } catch {
      // Sem internet ou deploy em propagação: tenta novamente no próximo intervalo.
    }
  }, [forcePrompt, updating]);

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      forcePrompt(null);
    },
    onOfflineReady() {
      checkRemoteVersion();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;

      const runChecks = async () => {
        if (updating || reloadingRef.current) return;

        await checkRemoteVersion();

        try {
          await registration.update();
        } catch {
          return;
        }

        if (registration.waiting || registration.installing) {
          forcePrompt(null);
        }
      };

      runChecks();
      intervalRef.current = setInterval(runChecks, CHECK_INTERVAL_MS);

      const visibleCheck = () => {
        if (document.visibilityState === "visible") runChecks();
      };

      document.addEventListener("visibilitychange", visibleCheck);
      window.addEventListener("focus", runChecks);
      window.addEventListener("online", runChecks);

      return () => {
        document.removeEventListener("visibilitychange", visibleCheck);
        window.removeEventListener("focus", runChecks);
        window.removeEventListener("online", runChecks);
      };
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    checkRemoteVersion();

    const handleControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      sessionStorage.setItem(UPDATE_FLAG_KEY, "1");
      window.location.replace(buildReloadUrl());
    };

    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkRemoteVersion]);

  const handleUpdate = async () => {
    setUpdating(true);
    sessionStorage.setItem(UPDATE_FLAG_KEY, "1");

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const registration = registrationRef.current;

    try {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
      registration?.installing?.postMessage({ type: "SKIP_WAITING" });
      await updateServiceWorker(true);
    } catch {
      // Continua para limpeza forçada.
    }

    try {
      await clearOldPwaData();
    } catch {
      // Mesmo se falhar, recarrega com cache-buster.
    }

    reloadingRef.current = true;
    window.location.replace(buildReloadUrl());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black p-6">
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-zinc-950 p-6 text-center shadow-2xl shadow-red-500/20"
      >
        <img
          src={logoUrl}
          alt={appTitle}
          className="mx-auto mb-5 h-20 w-20 rounded-2xl object-contain shadow-lg shadow-red-500/20"
        />

        <motion.div
          animate={{ rotate: updating ? 360 : [0, -8, 8, 0] }}
          transition={{
            duration: updating ? 1 : 0.75,
            repeat: updating ? Infinity : Infinity,
            repeatDelay: updating ? 0 : 1.2,
          }}
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
          Uma nova versão do sistema foi publicada. Atualize agora para continuar usando.
        </p>

        {remoteBuild && <p className="mt-2 text-[10px] text-zinc-500">Nova versão detectada: {remoteBuild}</p>}

        <button
          onClick={handleUpdate}
          disabled={updating}
          className="mt-6 w-full rounded-xl bg-red-600 py-4 text-base font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:bg-red-500 active:scale-[0.97] disabled:opacity-70"
        >
          {updating ? "Atualizando..." : "Atualizar agora"}
        </button>

        <p className="mt-3 text-[10px] text-zinc-500">O cache antigo será limpo automaticamente.</p>
      </motion.div>
    </div>
  );
}
