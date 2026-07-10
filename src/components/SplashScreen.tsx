import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppBranding } from "@/hooks/useAppBranding";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = (appName || "WMCPLAYER").trim().toUpperCase();

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-black px-6"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.08),transparent_48%)]" />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative z-10 flex w-full max-w-sm flex-col items-center text-center"
            >
              {logoUrl ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.38, ease: "easeOut" }}
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-2 shadow-[0_18px_55px_rgba(0,0,0,0.5)]"
                >
                  <img src={logoUrl} alt={appTitle} className="h-full w-full object-contain" />
                </motion.div>
              ) : null}

              <h1 className="mt-6 font-display text-2xl font-extrabold tracking-[0.12em] text-white">
                {appTitle}
              </h1>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/45">
                Carregando sistema
              </p>

              <div className="mt-7 h-1 w-48 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.25, ease: "easeInOut" }}
                  className="h-full rounded-full bg-red-500/80"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
