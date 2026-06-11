import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppBranding } from "@/hooks/useAppBranding";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "Bitz IPTV";
  const appTitleUpper = appTitle.toUpperCase();

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background"
          >
            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2 }}
                className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[100px]"
              />
            </div>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.8 }}
              className="relative"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="absolute -inset-4 rounded-3xl bg-primary/20 blur-xl"
              />
              <div
                className="relative overflow-hidden rounded-3xl shadow-2xl ring-2 ring-primary/30"
                style={{ width: 110, height: 110 }}
              >
                <img src={logoUrl} alt={appTitle} className="h-full w-full object-cover" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-5 font-display text-2xl font-bold tracking-widest text-foreground"
            >
              {appTitleUpper}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-1.5 text-xs text-muted-foreground"
            >
              Programa de Fidelidade
            </motion.p>

            {/* Loading indicator */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-8">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-muted/30">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                  className="h-full w-full rounded-full bg-primary"
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
