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

const CHECK_INTERVAL_MS = 12000;
const UPDATE_HANDLED_KEY = "wmcflix_pwa_update_handled_build";
const UPDATE_LOCK_UNTIL_KEY = "wmcflix_pwa_update_lock_until";
const AUTO_UPDATE_ATTEMPT_KEY = "wmcflix_pwa_auto_update_attempt";

let globalPromptVisible = false;
let globalUpdateRunning = false;
let globalReloading = false;
let globalAutoUpdating = false;

function getCurrentBuild(): number {
  return Number(__BUILD_TIMESTAMP__ || 0);
}

function getUpdateKey(build?: number | null) {
  return build ? String(build) : "sw-update";
}

function isUpdateLocked() {
  const until = Number(sessionStorage.getItem(UPDATE_LOCK_UNTIL_KEY) || 0);
  return until > Date.now();
}

function lockUpdatePrompt(minutes = 5) {
  sessionStorage.setItem(UPDATE_LOCK_UNTIL_KEY, String(Date.now() + minutes * 60 * 1000));
}

function wasUpdateHandled(build?: number | null) {
  return sessionStorage.getItem(UPDATE_HANDLED_KEY) === getUpdateKey(build);
}

function markUpdateHandled(build?: number | null) {
  sessionStorage.setItem(UPDATE_HANDLED_KEY, getUpdateKey(build));
}

async function clearPwaCaches() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

async function forceAutomaticPwaUpdate(build?: number | null) {
  const key = getUpdateKey(build);
  if (globalAutoUpdating || globalReloading || globalUpdateRunning) return false;
  if (sessionStorage.getItem(AUTO_UPDATE_ATTEMPT_KEY) === key) return false;

  globalAutoUpdating = true;
  sessionStorage.setItem(AUTO_UPDATE_ATTEMPT_KEY, key);
  sessionStorage.removeItem(UPDATE_LOCK_UNTIL_KEY);
  sessionStorage.removeItem(UPDATE_HANDLED_KEY);

  try {
    const registrations = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];

    await Promise.all(
      registrations.map(async (registration) => {
        try {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          registration.installing?.postMessage({ type: "SKIP_WAITING" });
          registration.active?.postMessage({ type: "SKIP_WAITING" });
          await registration.update();

          // Remove SW antigo quando ele está travando bundle/cache velho.
          await registration.unregister();
        } catch {
          // Continua com os outros registros.
        }
      }),
    );

    await clearPwaCaches();
  } catch {
    // Mesmo se der erro, tenta recarregar com cache-buster.
  }

  if (!globalReloading) {
    globalReloading = true;
    window.location.replace(buildReloadUrl());
  }

  return true;
}

function buildReloadUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("pwa_update", String(Date.now()));
  return url.toString();
}

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [remoteBuild, setRemoteBuild] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadingRef = useRef(false);
  const showPromptRef = useRef(false);
  const updatingRef = useRef(false);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "WMCFLIX";

  showPromptRef.current = showPrompt;
  updatingRef.current = updating;

  const forcePrompt = useCallback((build?: number | null) => {
    if (reloadingRef.current || globalReloading || updatingRef.current || globalUpdateRunning) return;
    if (isUpdateLocked()) return;
    if (wasUpdateHandled(build)) return;

    // Evita dois modais ao mesmo tempo, mesmo se o componente montar duas vezes.
    if (globalPromptVisible || document.getElementById("wmcflix-pwa-update-prompt")) return;

    if (typeof build === "number") setRemoteBuild(build);
    globalPromptVisible = true;
    setShowPrompt(true);
  }, []);

  const checkRemoteVersion = useCallback(async () => {
    if (updatingRef.current || reloadingRef.current || globalUpdateRunning || globalReloading) return;
    if (isUpdateLocked()) return;

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
        const autoStarted = await forceAutomaticPwaUpdate(remoteTimestamp);
        if (!autoStarted) {
          forcePrompt(remoteTimestamp);
        }
      }
    } catch {
      // Se estiver sem internet ou em propagação, tenta novamente depois.
    }
  }, [forcePrompt]);

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      void forceAutomaticPwaUpdate(remoteBuild).then((autoStarted) => {
        if (!autoStarted) forcePrompt(remoteBuild);
      });
    },
    onOfflineReady() {
      checkRemoteVersion();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;

      const runChecks = async () => {
        if (updatingRef.current || reloadingRef.current || globalUpdateRunning || globalReloading) return;
        if (isUpdateLocked()) return;

        await checkRemoteVersion();

        try {
          await registration.update();
        } catch {
          return;
        }

        if (registration.waiting || registration.installing) {
          forcePrompt(remoteBuild);
        }
      };

      // Uma única verificação ao abrir/carregar o aplicativo.
      // Não fica consultando o Cloudflare em intervalo, foco ou reconexão.
      runChecks();
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    checkRemoteVersion();

    const handleControllerChange = () => {
      if (reloadingRef.current || globalReloading) return;

      globalReloading = true;
      reloadingRef.current = true;
      lockUpdatePrompt(5);
      markUpdateHandled(remoteBuild);
      window.location.replace(buildReloadUrl());
    };

    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);

      if (showPromptRef.current) {
        globalPromptVisible = false;
      }
    };
  }, [checkRemoteVersion, remoteBuild]);

  const handleUpdate = async () => {
    if (globalUpdateRunning || updatingRef.current) return;

    globalUpdateRunning = true;
    setUpdating(true);
    lockUpdatePrompt(5);
    markUpdateHandled(remoteBuild);

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
      await clearPwaCaches();
    } catch {
      // Mesmo se falhar, recarrega com cache-buster.
    }

    if (!globalReloading && !reloadingRef.current) {
      globalReloading = true;
      reloadingRef.current = true;
      window.location.replace(buildReloadUrl());
    }
  };

  if (!showPrompt) return null;

  return (
    <div
      id="wmcflix-pwa-update-prompt"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black p-6"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-zinc-950 p-6 text-center shadow-2xl shadow-red-500/20"
      >
        <img
          src={logoUrl}
          alt={appTitle}
          className="mx-auto mb-5 h-20 w-20 rounded-2xl object-contain bg-black shadow-lg shadow-red-500/20"
        />

        <motion.div
          animate={{ rotate: updating ? 360 : [0, -8, 8, 0] }}
          transition={{ duration: updating ? 1 : 0.75, repeat: Infinity, repeatDelay: updating ? 0 : 1.2 }}
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
          Uma nova versão foi publicada. Atualize agora para continuar usando o sistema.
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
