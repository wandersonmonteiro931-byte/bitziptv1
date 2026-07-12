import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useAppBranding } from "@/hooks/useAppBranding";
import {
  APP_UPDATE_CHECK_EVENT,
  checkForAppUpdate,
  type AppUpdateCheckResult,
} from "@/lib/appVersion";

type VersionGateState = "checking" | "current" | "update-required" | "verification-error";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const waitForWorkerActivation = (worker: ServiceWorker, timeoutMs = 12000) =>
  new Promise<void>((resolve) => {
    if (worker.state === "activated" || worker.state === "redundant") {
      resolve();
      return;
    }
    if (worker.state === "installed") {
      worker.postMessage({ type: "SKIP_WAITING" });
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (worker.state === "installed") {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
      if (worker.state === "activated" || worker.state === "redundant") finish();
    };

    worker.addEventListener("statechange", onStateChange);
    window.setTimeout(finish, timeoutMs);
  });

const isAppRegistration = (registration: ServiceWorkerRegistration) => {
  try {
    const scopePath = new URL(registration.scope).pathname;
    return scopePath === "/app/" || scopePath.startsWith("/app/");
  } catch {
    return registration.scope.includes("/app/");
  }
};

export function PWAUpdatePrompt() {
  const [gateState, setGateState] = useState<VersionGateState>("checking");
  const [updating, setUpdating] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const updateLockRef = useRef(false);
  const updateRequestedRef = useRef(false);
  const navigationStartedRef = useRef(false);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "WMCPLAYER";

  useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      setGateState("update-required");
    },
    onRegisterError(error) {
      console.error("Falha ao registrar o aplicativo:", error);
    },
  });

  const navigateToUpdatedBuild = useCallback(
    (buildId?: string) => {
      if (navigationStartedRef.current) return;
      navigationStartedRef.current = true;

      const url = new URL(window.location.href);
      url.searchParams.delete("pwa_auto_update");
      url.searchParams.set("pwa_version", buildId || remoteBuildId || String(Date.now()));
      window.location.replace(url.toString());
    },
    [remoteBuildId],
  );

  const verifyLatestVersion = useCallback(async () => {
    setGateState("checking");
    setErrorMessage("");

    try {
      const result = await checkForAppUpdate();
      setRemoteBuildId(result.publishedBuildId);
      setGateState(result.updateAvailable ? "update-required" : "current");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível verificar a versão mais recente.",
      );
      setGateState("verification-error");
    }
  }, []);

  useEffect(() => {
    void verifyLatestVersion();
  }, [verifyLatestVersion]);

  useEffect(() => {
    const onManualUpdateCheck = (event: Event) => {
      const result = (event as CustomEvent<AppUpdateCheckResult>).detail;

      if (result?.publishedBuildId) {
        setRemoteBuildId(result.publishedBuildId);
        setErrorMessage("");
        setGateState(result.updateAvailable ? "update-required" : "current");
        return;
      }

      void verifyLatestVersion();
    };

    window.addEventListener(APP_UPDATE_CHECK_EVENT, onManualUpdateCheck);
    return () => window.removeEventListener(APP_UPDATE_CHECK_EVENT, onManualUpdateCheck);
  }, [verifyLatestVersion]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      if (updateRequestedRef.current) navigateToUpdatedBuild();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  }, [navigateToUpdatedBuild]);

  const handleUpdate = async () => {
    if (updateLockRef.current) return;
    updateLockRef.current = true;
    updateRequestedRef.current = true;
    setUpdating(true);
    setErrorMessage("");

    try {
      if (!("serviceWorker" in navigator)) {
        navigateToUpdatedBuild(remoteBuildId);
        return;
      }

      let registrations = (await navigator.serviceWorker.getRegistrations()).filter(isAppRegistration);

      if (registrations.length === 0) {
        const readyRegistration = await Promise.race([
          navigator.serviceWorker.ready,
          delay(4000).then(() => null),
        ]);
        if (readyRegistration && isAppRegistration(readyRegistration)) {
          registrations = [readyRegistration];
        }
      }

      for (const registration of registrations) {
        await registration.update();

        const installingWorker = registration.installing;
        if (installingWorker) {
          await waitForWorkerActivation(installingWorker);
        }

        const waitingWorker = registration.waiting;
        if (waitingWorker) {
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
          await waitForWorkerActivation(waitingWorker);
        }
      }

      await delay(500);
      navigateToUpdatedBuild(remoteBuildId);
    } catch (error) {
      updateLockRef.current = false;
      updateRequestedRef.current = false;
      setUpdating(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível aplicar a atualização.",
      );
      setGateState("verification-error");
    }
  };

  if (gateState === "current") return null;

  const checking = gateState === "checking";
  const verificationError = gateState === "verification-error";

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black p-6">
      <motion.div
        initial={{ scale: 0.96, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.28 }}
        className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-zinc-950 p-6 text-center shadow-2xl shadow-red-500/20"
      >
        <img
          src={logoUrl}
          alt={appTitle}
          className="mx-auto mb-5 h-20 w-20 rounded-2xl bg-black object-contain shadow-lg shadow-red-500/20"
        />

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
          {checking || updating ? (
            <Loader2 size={28} className="animate-spin text-red-500" />
          ) : verificationError ? (
            <WifiOff size={28} className="text-red-500" />
          ) : (
            <AlertTriangle size={28} className="text-red-500" />
          )}
        </div>

        <h2 className="text-xl font-bold text-white">
          {checking
            ? "Verificando atualização"
            : verificationError
              ? "Não foi possível verificar a versão"
              : "Atualização obrigatória"}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {checking
            ? "Aguarde enquanto confirmamos se o aplicativo está na versão mais recente."
            : verificationError
              ? "É necessário confirmar a versão mais recente antes de entrar no aplicativo. Verifique sua internet e tente novamente."
              : "Uma versão mais recente foi publicada. Atualize agora para continuar usando o aplicativo."}
        </p>

        {errorMessage && (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        {!checking && (
          <button
            type="button"
            onClick={verificationError ? () => void verifyLatestVersion() : handleUpdate}
            disabled={updating}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-4 text-base font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:bg-red-500 active:scale-[0.97] disabled:opacity-70"
          >
            {updating ? (
              <>
                <RefreshCw size={19} className="animate-spin" /> Atualizando...
              </>
            ) : verificationError ? (
              <>
                <RefreshCw size={19} /> Verificar novamente
              </>
            ) : (
              <>
                <RefreshCw size={19} /> Atualizar agora
              </>
            )}
          </button>
        )}

        <p className="mt-4 text-[10px] leading-4 text-zinc-500">
          Não existe opção para ignorar uma atualização obrigatória.
        </p>
      </motion.div>
    </div>
  );
}
