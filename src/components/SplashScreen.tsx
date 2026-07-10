import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppBranding } from "@/hooks/useAppBranding";

const particles = [
  { left: "10%", top: "18%", size: 5, delay: 0.05, duration: 2.8 },
  { left: "18%", top: "72%", size: 4, delay: 0.2, duration: 3.2 },
  { left: "28%", top: "32%", size: 6, delay: 0.35, duration: 2.6 },
  { left: "38%", top: "84%", size: 4, delay: 0.1, duration: 3.4 },
  { left: "50%", top: "12%", size: 5, delay: 0.25, duration: 2.9 },
  { left: "62%", top: "78%", size: 6, delay: 0.45, duration: 3.1 },
  { left: "73%", top: "26%", size: 4, delay: 0.15, duration: 2.7 },
  { left: "82%", top: "66%", size: 5, delay: 0.3, duration: 3.3 },
  { left: "90%", top: "38%", size: 4, delay: 0.5, duration: 2.8 },
  { left: "12%", top: "44%", size: 3, delay: 0.4, duration: 3.5 },
];

const redBeams = [
  { rotate: 18, delay: 0 },
  { rotate: 72, delay: 0.12 },
  { rotate: 136, delay: 0.24 },
  { rotate: 214, delay: 0.36 },
  { rotate: 292, delay: 0.48 },
];

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  const { appName, logoUrl } = useAppBranding();
  const appTitle = appName || "Bitz TV";
  const appTitleUpper = appTitle.toUpperCase();

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => setShow(false), 3600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden bg-black"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.16)_0%,rgba(20,0,0,0.14)_32%,rgba(0,0,0,1)_72%)]" />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.25, 0.55, 0.25] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-red-500/60 shadow-[0_0_35px_rgba(239,68,68,0.9)]"
            />

            {redBeams.map((beam, index) => (
              <motion.div
                key={`beam-${index}`}
                initial={{ opacity: 0, scaleX: 0.2 }}
                animate={{ opacity: [0, 0.5, 0], scaleX: [0.15, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 2.4, delay: beam.delay, ease: "easeInOut" }}
                className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[78vw] origin-left bg-gradient-to-r from-red-500/70 via-red-500/20 to-transparent"
                style={{ rotate: `${beam.rotate}deg` }}
              />
            ))}

            {particles.map((particle, index) => (
              <motion.span
                key={`particle-${index}`}
                className="pointer-events-none absolute rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.9)]"
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                }}
                initial={{ opacity: 0, scale: 0, y: 30 }}
                animate={{
                  opacity: [0, 1, 0.25, 0],
                  scale: [0, 1.3, 0.8, 0],
                  y: [30, -18, -42, -70],
                }}
                transition={{
                  repeat: Infinity,
                  duration: particle.duration,
                  delay: particle.delay,
                  ease: "easeInOut",
                }}
              />
            ))}

            <motion.div
              className="absolute h-[340px] w-[340px] rounded-full border border-red-500/10"
              initial={{ opacity: 0, scale: 0.55, rotate: 0 }}
              animate={{ opacity: [0.2, 0.7, 0.25], scale: [0.7, 1.05, 0.78], rotate: 360 }}
              transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
            />
            <motion.div
              className="absolute h-[230px] w-[230px] rounded-full border border-red-500/20"
              initial={{ opacity: 0, scale: 0.7, rotate: 360 }}
              animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 0.86, 1], rotate: 0 }}
              transition={{ repeat: Infinity, duration: 3.6, ease: "linear" }}
            />

            <motion.div
              initial={{ opacity: 0, y: 35, scale: 0.68, rotateX: 30 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              transition={{ type: "spring", stiffness: 190, damping: 14, duration: 0.9 }}
              className="relative z-10 flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -8, 0], scale: [1, 1.035, 1] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="relative"
              >
                <motion.div
                  animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.18, 0.9] }}
                  transition={{ repeat: Infinity, duration: 1.55, ease: "easeInOut" }}
                  className="absolute -inset-5 rounded-[2rem] bg-red-500/25 blur-2xl"
                />
                <motion.div
                  animate={{ rotate: [0, 4, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  className="relative flex h-32 w-32 items-center justify-center rounded-[2rem] border border-red-500/35 bg-zinc-950/90 p-3 shadow-2xl shadow-red-500/25"
                >
                  <img src={logoUrl} alt={appTitle} className="h-full w-full rounded-2xl object-contain" />
                </motion.div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18, letterSpacing: "0.35em" }}
                animate={{ opacity: 1, y: 0, letterSpacing: "0.12em" }}
                transition={{ delay: 0.45, duration: 0.65, ease: "easeOut" }}
                className="mt-7 text-center font-display text-3xl font-black uppercase text-white drop-shadow-[0_0_18px_rgba(239,68,68,0.55)]"
              >
                {appTitleUpper}
              </motion.h1>

              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 180, opacity: 1 }}
                transition={{ delay: 0.85, duration: 0.55 }}
                className="mt-3 h-[2px] rounded-full bg-gradient-to-r from-transparent via-red-500 to-transparent"
              />

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05, duration: 0.45 }}
                className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-red-300"
              >
                Carregando sistema
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="mt-8 w-64"
              >
                <div className="relative h-2 overflow-hidden rounded-full bg-zinc-800 shadow-inner">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.1, delay: 0.25, ease: "easeInOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-red-900 via-red-500 to-red-300 shadow-[0_0_18px_rgba(239,68,68,0.8)]"
                  />
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "260%" }}
                    transition={{ repeat: Infinity, duration: 0.85, ease: "easeInOut" }}
                    className="absolute inset-y-0 left-0 w-24 bg-white/25 blur-sm"
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
