import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import logoBitz from "@/assets/logo-bitz.jpg";

export function PWAUpdatePrompt() {
  // Prevent update loop: skip prompt if we just updated
  const COOLDOWN_KEY = "pwa_update_ts";
  const COOLDOWN_MS = 30_000; // 30 seconds cooldown after update
  const lastUpdate = Number(sessionStorage.getItem(COOLDOWN_KEY) || "0");
  const inCooldown = Date.now() - lastUpdate < COOLDOWN_MS;

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 1000); // Check every 30s instead of 5s
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  const showPrompt = needRefresh && !inCooldown;

  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    setUpdating(true);
    // Mark cooldown BEFORE reload to prevent loop
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));

    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error("updateServiceWorker failed:", err);
    }

    // Clear caches
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch {}

    // Force reload
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
            {/* Logo */}
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

            {/* Icon */}
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
