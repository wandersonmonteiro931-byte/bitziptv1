import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useAppBranding } from "@/hooks/useAppBranding";

let promptAlreadyVisible = false;
let updateAlreadyRunning = false;

export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const reloadScheduledRef = useRef(false);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "WMCPLAYER";

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      if (promptAlreadyVisible || updateAlreadyRunning) return;
      promptAlreadyVisible = true;
      setShowPrompt(true);
    },
    onRegisterError(error) {
      console.error("Falha ao registrar o aplicativo:", error);
    },
  });

  useEffect(() => {
    const handleControllerChange = () => {
      if (reloadScheduledRef.current) return;
      reloadScheduledRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      if (showPrompt) promptAlreadyVisible = false;
    };
  }, [showPrompt]);

  const handleUpdate = async () => {
    if (updateAlreadyRunning) return;
    updateAlreadyRunning = true;
    setUpdating(true);

    try {
      // Atualiza somente por ordem do usuário. Não desregistra o SW,
      // não apaga caches em uso e não cria loop de recarregamento.
      await updateServiceWorker(true);

      // Segurança para navegadores que não disparam controllerchange.
      window.setTimeout(() => {
        if (reloadScheduledRef.current) return;
        reloadScheduledRef.current = true;
        window.location.reload();
      }, 1800);
    } catch (error) {
      console.error("Falha ao aplicar atualização:", error);
      updateAlreadyRunning = false;
      setUpdating(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div
      id="wmcplayer-pwa-update-prompt"
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
          className="mx-auto mb-5 h-20 w-20 rounded-2xl bg-black object-contain shadow-lg shadow-red-500/20"
        />

        <motion.div
          animate={{ rotate: updating ? 360 : [0, -8, 8, 0] }}
          transition={{ duration: updating ? 1 : 0.75, repeat: Infinity, repeatDelay: updating ? 0 : 1.2 }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15"
        >
          {updating ? <RefreshCw size={28} className="text-red-500" /> : <AlertTriangle size={28} className="text-red-500" />}
        </motion.div>

        <h2 className="text-xl font-bold text-white">Atualização disponível</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Uma nova versão foi publicada. Toque abaixo para atualizar com segurança.
        </p>

        <button
          onClick={handleUpdate}
          disabled={updating}
          className="mt-6 w-full rounded-xl bg-red-600 py-4 text-base font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:bg-red-500 active:scale-[0.97] disabled:opacity-70"
        >
          {updating ? "Atualizando..." : "Atualizar agora"}
        </button>
      </motion.div>
    </div>
  );
}
