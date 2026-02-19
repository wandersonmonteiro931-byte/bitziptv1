import { useState, useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import logoBitz from "@/assets/logo-bitz.jpg";

const UPDATED_KEY = "pwa_just_updated";

function wasJustUpdated(): boolean {
  const ts = sessionStorage.getItem(UPDATED_KEY);
  if (!ts) return false;
  // Consider "just updated" for 30 seconds after reload
  return Date.now() - Number(ts) < 30_000;
}

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressRef = useRef(wasJustUpdated());

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      if (!suppressRef.current) {
        setShowPrompt(true);
      }
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      intervalRef.current = setInterval(async () => {
        if (suppressRef.current) return;
        try {
          await registration.update();
        } catch {}
        if (registration.waiting && !suppressRef.current) {
          setShowPrompt(true);
        }
      }, 5_000);
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Clear the suppress flag after 30s so future real updates are detected
  useEffect(() => {
    if (suppressRef.current) {
      const timeout = setTimeout(() => {
        suppressRef.current = false;
        sessionStorage.removeItem(UPDATED_KEY);
      }, 30_000);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Mark as just updated BEFORE reload so the next mount skips the prompt
    sessionStorage.setItem(UPDATED_KEY, String(Date.now()));

    try {
      await updateServiceWorker(true);
    } catch {}
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch {}
    window.location.reload();
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
