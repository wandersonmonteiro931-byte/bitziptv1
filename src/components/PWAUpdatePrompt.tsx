import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import logoBitz from "@/assets/logo-bitz.jpg";

declare const __BUILD_TIMESTAMP__: number;
const UPDATED_BUILD_KEY = "pwa_updated_build";
const SW_URL = "/service-worker.js";
const CHECK_INTERVAL = 5_000;

function isCurrentBuild(): boolean {
  const stored = localStorage.getItem(UPDATED_BUILD_KEY);
  if (!stored) return false;
  return stored === String(__BUILD_TIMESTAMP__);
}

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressRef = useRef(isCurrentBuild());

  const checkForUpdate = useCallback(async () => {
    if (suppressRef.current) return;
    const reg = registrationRef.current;
    if (!reg) return;
    try {
      await reg.update();
    } catch {}
    if (reg.waiting && !suppressRef.current) {
      setShowPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
        registrationRef.current = reg;

        // If there's already a waiting worker, show prompt
        if (reg.waiting && !suppressRef.current) {
          setShowPrompt(true);
        }

        // Listen for new workers
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller && !suppressRef.current) {
              setShowPrompt(true);
            }
          });
        });

        // Poll for updates
        intervalRef.current = setInterval(checkForUpdate, CHECK_INTERVAL);
      } catch (err) {
        console.error("[PWA] Registration failed:", err);
      }
    };

    register();

    // Handle controller change (after skipWaiting)
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [checkForUpdate]);

  // On mount: if flag is "pending", store current build to suppress future prompts
  useEffect(() => {
    if (localStorage.getItem(UPDATED_BUILD_KEY) === "pending") {
      localStorage.setItem(UPDATED_BUILD_KEY, String(__BUILD_TIMESTAMP__));
      suppressRef.current = true;
    }
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    localStorage.setItem(UPDATED_BUILD_KEY, "pending");

    const reg = registrationRef.current;
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Fallback reload after 3 seconds if controllerchange doesn't fire
    setTimeout(() => window.location.reload(), 3000);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mx-auto mb-6">
          <img src={logoBitz} alt="Bitz IPTV" className="mx-auto h-20 w-20 rounded-2xl shadow-lg shadow-primary/20" />
        </div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15"
        >
          <RefreshCw size={28} className="text-primary" />
        </motion.div>

        <h2 className="text-xl font-bold text-foreground">Nova atualização disponível</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Uma nova versão do app está disponível. Atualize agora para continuar utilizando.
        </p>

        <button
          onClick={handleUpdate}
          disabled={updating}
          className="mt-6 w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all active:scale-[0.97] disabled:opacity-60"
        >
          {updating ? "Atualizando..." : "Atualizar agora"}
        </button>

        <p className="mt-3 text-[10px] text-muted-foreground/50">O app será reiniciado automaticamente</p>
      </motion.div>
    </div>
  );
}
