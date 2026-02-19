import { useState, useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import logoBitz from "@/assets/logo-bitz.jpg";

// Unique build ID — changes on every new build/publish
const BUILD_VERSION = __BUILD_TIMESTAMP__;

export function PWAUpdatePrompt() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);

  const {
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration && isStandalone) {
        setInterval(() => {
          registration.update();
        }, 5 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  // Check if there's a new version compared to what was last seen
  useEffect(() => {
    if (!isStandalone) return;

    const STORED_KEY = "pwa_build_version";
    const storedVersion = localStorage.getItem(STORED_KEY);

    if (storedVersion === null) {
      // First time — just store current version, no prompt
      localStorage.setItem(STORED_KEY, String(BUILD_VERSION));
      return;
    }

    if (String(BUILD_VERSION) !== storedVersion) {
      // New build detected — show update prompt
      setShowPrompt(true);
    }
  }, [isStandalone]);

  const handleUpdate = async () => {
    setUpdating(true);
    // Save new version so prompt won't show again after reload
    localStorage.setItem("pwa_build_version", String(BUILD_VERSION));

    try {
      await updateServiceWorker(true);
    } catch {}

    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch {}

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="mx-auto mb-6"
            >
              <img
                src={logoBitz}
                alt="Bitz IPTV"
                className="mx-auto h-20 w-20 rounded-2xl shadow-lg shadow-primary/20"
              />
            </motion.div>

            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15"
            >
              <RefreshCw size={28} className="text-primary" />
            </motion.div>

            <h2 className="text-xl font-bold text-foreground">
              Nova atualização disponível
            </h2>
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

            <p className="mt-3 text-[10px] text-muted-foreground/50">
              O app será reiniciado automaticamente
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
