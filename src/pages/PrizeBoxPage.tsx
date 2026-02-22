import React, { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDateTimeBRT, todayBRT, nowBRT } from "@/lib/utils";
import { Diamond, Trophy, Flame, TrendingUp, Zap, Gift, Package, Volume2, VolumeX } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { sfx, setMuted as setSfxMuted, isMuted } from "@/lib/sounds";

// ═══════════════════════════════════════════════
// PRIZE VISUAL DATA
// ═══════════════════════════════════════════════
const PRIZE_VISUALS: Record<string, { emoji: string; label: string; color: string }> = {
  nada:  { emoji: "❌", label: "Nada",       color: "#888" },
  r1:    { emoji: "🪙", label: "R$ 1",       color: "#4ade80" },
  r2:    { emoji: "🪙", label: "R$ 2",       color: "#4ade80" },
  r5:    { emoji: "💵", label: "R$ 5",       color: "#22c55e" },
  r10:   { emoji: "💵", label: "R$ 10",      color: "#16a34a" },
  r30:   { emoji: "💰", label: "R$ 30",      color: "#f59e0b" },
  r50:   { emoji: "🤑", label: "R$ 50",      color: "#f97316" },
  r100:  { emoji: "🏆", label: "R$ 100",     color: "#eab308" },
  r500:  { emoji: "👑", label: "R$ 500",     color: "#a855f7" },
  r1000: { emoji: "🌟", label: "R$ 1.000",   color: "#ec4899" },
  c1:    { emoji: "💎", label: "1 💎",       color: "#60a5fa" },
  c3:    { emoji: "💎", label: "3 💎",       color: "#3b82f6" },
  c5:    { emoji: "💎", label: "5 💎",       color: "#2563eb" },
  c10:   { emoji: "💎", label: "10 💎",      color: "#1d4ed8" },
  ticket:{ emoji: "🎟️", label: "Ticket",     color: "#f59e0b" },
  multi: { emoji: "🔥", label: "Multiplier", color: "#ef4444" },
};

function getPrizeVisual(key: string) {
  return PRIZE_VISUALS[key] || { emoji: "🎁", label: key, color: "#888" };
}

// ═══════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════
function ConfettiEffect({ active }: { active: boolean }) {
  const particles = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 2,
      color: ["#FFD700", "#FF6B35", "#00D4FF", "#FF2D95", "#39FF14", "#FFE100", "#a855f7"][Math.floor(Math.random() * 7)],
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
    })),
    []
  );
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", opacity: [1, 1, 0], rotate: p.rotation + 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
          className="absolute"
          style={{ width: p.size, height: p.size * 0.6, backgroundColor: p.color, borderRadius: "2px" }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// PARTICLE BURST ON BOX OPEN
// ═══════════════════════════════════════════════
function ParticleBurst({ color }: { color: string }) {
  const parts = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    angle: (i / 20) * Math.PI * 2,
    dist: 60 + Math.random() * 80,
    size: 3 + Math.random() * 5,
    delay: Math.random() * 0.15,
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {parts.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: "50%", top: "50%",
            width: p.size, height: p.size,
            backgroundColor: color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist,
            opacity: 0,
            scale: 0.3,
          }}
          transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MYSTERY BOX COMPONENT
// ═══════════════════════════════════════════════
function MysteryBox({
  index,
  state,
  prizeKey,
  label,
  onChoose,
  disabled,
  isChosen,
  isOther,
}: {
  index: number;
  state: "closed" | "opening" | "open";
  prizeKey: string | null;
  label: string | null;
  onChoose: () => void;
  disabled: boolean;
  isChosen: boolean;
  isOther: boolean;
}) {
  const prize = prizeKey ? getPrizeVisual(prizeKey) : null;
  const isWin = prizeKey && prizeKey !== "nada";
  const boxColor = index === 0
    ? { bg: "from-blue-600/80 to-blue-900/80", border: "hsl(210 100% 55% / 0.5)", glow: "hsl(210 100% 55% / 0.3)" }
    : { bg: "from-purple-600/80 to-purple-900/80", border: "hsl(270 80% 60% / 0.5)", glow: "hsl(270 80% 60% / 0.3)" };

  return (
    <motion.button
      onClick={onChoose}
      disabled={disabled || state !== "closed"}
      className="relative flex flex-col items-center focus:outline-none group"
      whileHover={state === "closed" && !disabled ? { scale: 1.05 } : {}}
      whileTap={state === "closed" && !disabled ? { scale: 0.95 } : {}}
    >
      <AnimatePresence mode="wait">
        {state === "closed" && (
          <motion.div
            key="closed"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.2, rotateY: 90 }}
            transition={{ duration: 0.4 }}
            className={`relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-2xl bg-gradient-to-br ${boxColor.bg} border-2 select-none`}
            style={{
              borderColor: boxColor.border,
              boxShadow: `0 0 30px ${boxColor.glow}, 0 8px 32px rgba(0,0,0,0.5)`,
            }}
          >
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              initial={false}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
              />
            </motion.div>
            {/* Ribbon */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-14 h-5 rounded-b-lg bg-gradient-to-b from-yellow-400 to-yellow-600 shadow-lg" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="text-5xl sm:text-6xl select-none">🎁</span>
              </motion.div>
            </div>
            <span className="absolute bottom-3 text-[10px] font-bold text-white/60 uppercase tracking-widest">
              Caixa {index + 1}
            </span>
            {/* Touch glow on hover */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/5 transition-colors duration-300"
            />
          </motion.div>
        )}

        {state === "opening" && (
          <motion.div
            key="opening"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-2xl"
            style={{ perspective: "800px" }}
          >
            <motion.div
              className="h-full w-full rounded-2xl bg-gradient-to-br from-yellow-500/30 to-yellow-700/30 border-2 border-yellow-500/50 flex items-center justify-center"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(234,179,8,0.3)",
                  "0 0 60px rgba(234,179,8,0.6)",
                  "0 0 20px rgba(234,179,8,0.3)",
                ],
              }}
              transition={{ duration: 0.6, repeat: 2 }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 5, -5, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8 }}
                className="text-5xl"
              >
                ✨
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {state === "open" && prize && (
          <motion.div
            key="open"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
            className="relative flex h-36 w-36 sm:h-44 sm:w-44 flex-col items-center justify-center rounded-2xl border-2"
            style={{
              background: isWin && isChosen
                ? `radial-gradient(circle, ${prize.color}20, hsl(220 20% 8%))`
                : "hsl(220 18% 10%)",
              borderColor: isChosen
                ? isWin ? `${prize.color}80` : "hsl(0 80% 55% / 0.5)"
                : `${prize.color}40`,
              boxShadow: isWin && isChosen ? `0 0 40px ${prize.color}40` : "none",
            }}
          >
            {isWin && isChosen && <ParticleBurst color={prize.color} />}
            <motion.span
              className="text-4xl sm:text-5xl"
              animate={isWin && isChosen ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 0.6, repeat: isWin && isChosen ? 2 : 0 }}
            >
              {prize.emoji}
            </motion.span>
            <motion.p
              className="mt-1 text-xs sm:text-sm font-bold"
              style={{ color: prize.color }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {label || prize.label}
            </motion.p>
            {isChosen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-1 text-[9px] font-bold uppercase tracking-wider"
                style={{ color: isWin ? "#4ade80" : "#ef4444" }}
              >
                {isWin ? "🎉 Sua escolha!" : "Sua escolha"}
              </motion.span>
            )}
            {isOther && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Outra caixa
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════
// LUCK BAR
// ═══════════════════════════════════════════════
function LuckBar({ gamesPlayed }: { gamesPlayed: number }) {
  const level = Math.min(gamesPlayed % 10, 9);
  const labels = ["😐", "😐", "🙂", "🙂", "😊", "😊", "🤩", "🤩", "🔥", "⭐"];
  return (
    <div className="flex items-center gap-1.5">
      <Zap size={12} className="text-yellow-400" />
      <div className="flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-2.5 w-1.5 rounded-full transition-all duration-500"
            style={{
              background: i <= level ? `hsl(${90 + i * 15} 80% ${45 + i * 2}%)` : "hsl(220 15% 18%)",
              boxShadow: i <= level ? `0 0 6px hsl(${90 + i * 15} 80% 50% / 0.6)` : "none",
            }}
          />
        ))}
      </div>
      <span className="text-xs">{labels[level]}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
const PrizeBoxPage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const [gameState, setGameState] = useState<"idle" | "choosing" | "opening" | "result">("idle");
  const [chosenBox, setChosenBox] = useState<number | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [boxStates, setBoxStates] = useState<["closed" | "opening" | "open", "closed" | "opening" | "open"]>(["closed", "closed"]);
  const [cooldown, setCooldown] = useState(false);
  const [muted, setMuted] = useState(false);

  const userCredits = (user as any)?.credits || 0;

  // Queries
  const { data: boxChallenge } = useQuery({
    queryKey: ["prize-box-challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_challenges")
        .select("*")
        .eq("challenge_type", "prize_box")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: recentResults = [] } = useQuery({
    queryKey: ["prize-box-results"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_attempts")
        .select("*, credit_challenges(name, icon)")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []).filter((a: any) => a.metadata?.challenge_type === "prize_box");
    },
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["prize-box-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_attempts")
        .select("credits_spent, credits_won, metadata")
        .eq("user_id", user?.id);
      const boxGames = (data || []).filter((a: any) => a.metadata?.challenge_type === "prize_box");
      return {
        total: boxGames.length,
        totalWon: boxGames.reduce((s, a) => s + a.credits_won, 0),
        totalBalanceWon: boxGames.reduce((s, a: any) => s + (a.metadata?.balance_won || 0), 0),
        totalSpent: boxGames.reduce((s, a) => s + a.credits_spent, 0),
      };
    },
    enabled: !!user?.id,
  });

  const { data: streakData } = useQuery({
    queryKey: ["prize-box-streak"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_attempts")
        .select("created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!data || data.length === 0) return { streak: 0 };
      let streak = 0;
      const today = nowBRT();
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (data.some((a: any) => a.created_at.slice(0, 10) === dateStr)) streak++;
        else if (i > 0) break;
      }
      return { streak };
    },
    enabled: !!user?.id,
  });

  // Play mutation
  const playMutation = useMutation({
    mutationFn: async (boxIndex: number) => {
      if (!boxChallenge) throw new Error("Caixa Premiada não disponível");
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "play_prize_box", data: { challenge_id: boxChallenge.id } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return { ...data, chosenBox: boxIndex };
    },
    onSuccess: async (data) => {
      const boxIdx = data.chosenBox as number;
      const otherIdx = boxIdx === 0 ? 1 : 0;
      setResultData(data);
      setGameState("opening");

      sfx.click();

      // Open chosen box first
      setBoxStates(prev => {
        const next = [...prev] as typeof prev;
        next[boxIdx] = "opening";
        return next;
      });

      setTimeout(() => {
        sfx.boxOpen();
        setBoxStates(prev => {
          const next = [...prev] as typeof prev;
          next[boxIdx] = "open";
          return next;
        });

        const isWin = data.prize_key && data.prize_key !== "nada";
        if (isWin && navigator.vibrate) navigator.vibrate([100, 50, 200]);
        if (!isWin && navigator.vibrate) navigator.vibrate(30);

        // Reveal other box after a delay
        setTimeout(() => {
          setBoxStates(prev => {
            const next = [...prev] as typeof prev;
            next[otherIdx] = "opening";
            return next;
          });
          setTimeout(() => {
            setBoxStates(prev => {
              const next = [...prev] as typeof prev;
              next[otherIdx] = "open";
              return next;
            });
            setGameState("result");

            if (isWin) {
              sfx.celebrate();
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 4000);
            } else {
              sfx.lose();
            }
          }, 400);
        }, 1200);
      }, 600);

      // Refresh balance immediately
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["prize-box-results"] });
      queryClient.invalidateQueries({ queryKey: ["prize-box-stats"] });
      queryClient.invalidateQueries({ queryKey: ["prize-box-streak"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setGameState("idle");
      setChosenBox(null);
    },
  });

  const handleChoose = useCallback((boxIndex: number) => {
    if (gameState !== "idle" || cooldown || playMutation.isPending) return;
    sfx.start();
    setChosenBox(boxIndex);
    playMutation.mutate(boxIndex);
  }, [gameState, cooldown, playMutation]);

  const handleNewGame = useCallback(() => {
    setCooldown(true);
    setGameState("idle");
    setChosenBox(null);
    setResultData(null);
    setBoxStates(["closed", "closed"]);
    setTimeout(() => setCooldown(false), 3000);
  }, []);

  const cost = boxChallenge?.cost_credits || 1;
  const canBuy = userCredits >= cost;

  return (
    <AppLayout>
      <ConfettiEffect active={showConfetti} />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 text-2xl font-bold"
            style={{ color: "hsl(var(--foreground))" }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, hsl(45 100% 50%), hsl(30 100% 50%))",
                boxShadow: "0 0 20px hsl(45 100% 50% / 0.5)",
              }}
            >
              <Gift size={20} className="text-primary-foreground" />
            </div>
            Caixa Premiada
          </motion.h1>
          <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Escolha uma das 2 caixas e descubra seu prêmio! 🎁
          </p>
        </div>
        <button onClick={() => { setMuted(!muted); setSfxMuted(!muted); }} className="rounded-full bg-muted/50 p-2 text-muted-foreground hover:text-foreground transition-colors">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { icon: Diamond, label: "Créditos", value: `${userCredits}`, color: "hsl(var(--primary))" },
          { icon: Flame, label: "Streak", value: `${streakData?.streak || 0}🔥`, color: "hsl(30 100% 55%)" },
          { icon: Trophy, label: "Ganhos💎", value: `${stats?.totalWon || 0}`, color: "hsl(145 70% 45%)" },
          { icon: TrendingUp, label: "Ganhos💰", value: `R$${(stats?.totalBalanceWon || 0).toFixed(0)}`, color: "hsl(45 100% 50%)" },
        ].map((s) => (
          <div key={s.label} className="stat-card rounded-xl p-2.5 text-center">
            <s.icon size={14} style={{ color: s.color }} className="mx-auto" />
            <p className="mt-0.5 text-[9px] text-muted-foreground">{s.label}</p>
            <p className="font-display text-sm font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Luck Bar + Games played */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-muted/30 border border-border px-3 py-2">
        <LuckBar gamesPlayed={stats?.total || 0} />
        <span className="text-xs text-muted-foreground">{stats?.total || 0} jogadas</span>
      </div>

      {/* Game Area */}
      <div className="mb-6">
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          {/* Cost info */}
          {gameState === "idle" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-6"
            >
              <p className="text-sm text-muted-foreground">
                Custo: <span className="font-bold text-primary">{cost} 💎</span>
              </p>
              {!canBuy && (
                <p className="text-xs text-destructive mt-1">Créditos insuficientes</p>
              )}
              {cooldown && (
                <p className="text-xs text-yellow-400 mt-1">Aguarde...</p>
              )}
            </motion.div>
          )}

          {/* Boxes */}
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            <MysteryBox
              index={0}
              state={boxStates[0]}
              prizeKey={
                boxStates[0] === "open"
                  ? chosenBox === 0 ? resultData?.prize_key : resultData?.other_box?.prize_key
                  : null
              }
              label={
                boxStates[0] === "open"
                  ? chosenBox === 0 ? resultData?.label : resultData?.other_box?.label
                  : null
              }
              onChoose={() => handleChoose(0)}
              disabled={!canBuy || cooldown || gameState !== "idle" || playMutation.isPending}
              isChosen={chosenBox === 0 && boxStates[0] === "open"}
              isOther={chosenBox === 1 && boxStates[0] === "open"}
            />
            <div className="flex flex-col items-center gap-1">
              <motion.span
                className="text-2xl font-bold text-muted-foreground"
                animate={gameState === "idle" ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.2 }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                VS
              </motion.span>
            </div>
            <MysteryBox
              index={1}
              state={boxStates[1]}
              prizeKey={
                boxStates[1] === "open"
                  ? chosenBox === 1 ? resultData?.prize_key : resultData?.other_box?.prize_key
                  : null
              }
              label={
                boxStates[1] === "open"
                  ? chosenBox === 1 ? resultData?.label : resultData?.other_box?.label
                  : null
              }
              onChoose={() => handleChoose(1)}
              disabled={!canBuy || cooldown || gameState !== "idle" || playMutation.isPending}
              isChosen={chosenBox === 1 && boxStates[1] === "open"}
              isOther={chosenBox === 0 && boxStates[1] === "open"}
            />
          </div>

          {/* Result message */}
          <AnimatePresence>
            {gameState === "result" && resultData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-center"
              >
                {resultData.prize_key !== "nada" ? (
                  <>
                    <motion.p
                      className="text-lg font-bold text-green-400"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.5, repeat: 2 }}
                    >
                      🎉 Parabéns! Você ganhou!
                    </motion.p>
                    <p className="text-2xl font-bold mt-1" style={{ color: getPrizeVisual(resultData.prize_key).color }}>
                      {resultData.reward_type === "balance"
                        ? `+R$ ${Number(resultData.balance_won).toFixed(2)} 💰`
                        : `+${resultData.credits_won} 💎`}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground">
                    😔 Não foi dessa vez...
                  </p>
                )}

                {/* Near miss effect */}
                {resultData.prize_key === "nada" && resultData.other_box?.prize_key !== "nada" && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="mt-2 text-sm text-yellow-400"
                  >
                    😱 A outra caixa tinha {resultData.other_box.label}!
                  </motion.p>
                )}

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  onClick={handleNewGame}
                  className="mt-4 flex mx-auto items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:brightness-110 transition-all"
                >
                  <Package size={16} /> Jogar Novamente
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading state */}
          {playMutation.isPending && gameState === "idle" && (
            <div className="mt-4 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* Instruction */}
          {gameState === "idle" && !playMutation.isPending && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-center text-xs text-muted-foreground"
            >
              Toque em uma caixa para escolher 👆
            </motion.p>
          )}
        </div>
      </div>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <>
          <h2 className="mb-3 font-display text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy size={18} className="text-yellow-400" /> Últimas Jogadas
          </h2>
          <div className="space-y-2 mb-6">
            {recentResults.map((a: any) => (
              <div key={a.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>🎁</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Caixa Premiada</p>
                    <p className="text-xs text-muted-foreground">{formatDateTimeBRT(a.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">-{a.credits_spent} 💎</p>
                  {a.metadata?.reward_type === "balance" && a.metadata?.balance_won > 0 ? (
                    <p className="text-sm font-bold text-green-400">+R$ {Number(a.metadata.balance_won).toFixed(2)} 💰</p>
                  ) : (
                    <p className={`text-sm font-bold ${a.credits_won > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                      {a.credits_won > 0 ? `+${a.credits_won} 💎` : a.result_label}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default PrizeBoxPage;
