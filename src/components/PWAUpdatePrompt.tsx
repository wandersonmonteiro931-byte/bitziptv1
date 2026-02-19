import { useState, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import logoBitz from "@/assets/logo-bitz.jpg";

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const prompted = useRef(false);

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      // Only show once per session and only in installed PWA
      if (!prompted.current && isStandaloneMode()) {
        prompted.current = true;
        setShowPrompt(true);
      }
    },
    onRegisteredSW(_swUrl, registration) {
      // Poll every 60s only in standalone — no aggressive polling
      if (registration && isStandaloneMode()) {
        setInterval(() => {
          registration.update();
        }, 60_000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  const handleUpdate = async () => {
    setUpdating(true);
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
              <img src={logoBitz} alt="Bitz IPTV" className="mx-auto h-20 w-20 rounded-2xl shadow-lg shadow-primary/20" />
            </motion.div>

            <motion.div
              initial={{ rotate: 0 }}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
