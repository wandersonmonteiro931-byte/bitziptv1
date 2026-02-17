import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, Zap, Volume2, VolumeX } from "lucide-react";

type GamePhase = "idle" | "shuffling" | "choosing" | "revealing" | "result";

interface GameResult {
  winning_position: number;
  credits_won: number;
  balance_won: number;
  reward_type: string;
  label: string;
  prize_key: string;
  other_cup: { prize_key: string; label: string; value: number; reward_type: string };
  new_credits: number;
  new_balance: number;
}

// Simple sound using AudioContext
const playTone = (freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15) => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  } catch {}
};

const playSfx = {
  shuffle: () => { playTone(300, 0.08, "square", 0.08); },
  click: () => { playTone(600, 0.1, "sine", 0.12); },
  reveal: () => { playTone(500, 0.2, "triangle", 0.1); },
  win: () => { 
    playTone(523, 0.15, "sine", 0.15);
    setTimeout(() => playTone(659, 0.15, "sine", 0.15), 150);
    setTimeout(() => playTone(784, 0.3, "sine", 0.15), 300);
  },
  lose: () => { playTone(200, 0.3, "sawtooth", 0.06); },
  jackpot: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.25, "sine", 0.15), i * 120));
  },
  start: () => { playTone(440, 0.15, "sine", 0.1); setTimeout(() => playTone(550, 0.15, "sine", 0.1), 100); },
};

const CupGamePage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [chosenCup, setChosenCup] = useState<number | null>(null);
  const [cupPositions, setCupPositions] = useState([0, 1, 2]);
  const [revealedCups, setRevealedCups] = useState<boolean[]>([false, false, false]);
  const [muted, setMuted] = useState(false);
  const cooldownRef = useRef(false);

  const sfx = useCallback((fn: () => void) => { if (!muted) fn(); }, [muted]);

  const { data: challenge } = useQuery({
    queryKey: ["cup-game-challenge"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_challenges")
        .select("*").eq("challenge_type", "cup_game").eq("is_active", true).limit(1).single();
      return data;
    },
  });

  const playMutation = useMutation({
    mutationFn: async () => {
      if (!challenge) throw new Error("Desafio não encontrado");
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "play_cup_game", data: { challenge_id: challenge.id } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as GameResult;
    },
  });

  const startGame = useCallback(async () => {
    if (cooldownRef.current || phase !== "idle") return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 4000);

    sfx(playSfx.start);
    setChosenCup(null);
    setRevealedCups([false, false, false]);
    setGameResult(null);

    // Get result from server first
    try {
      const result = await playMutation.mutateAsync();
      setGameResult(result);

      // Start shuffle animation
      setPhase("shuffling");
      sfx(playSfx.shuffle);

      // Shuffle cups visually
      let positions = [0, 1, 2];
      const shuffleSteps = 12;
      for (let i = 0; i < shuffleSteps; i++) {
        await new Promise(r => setTimeout(r, 200));
        const a = Math.floor(Math.random() * 3);
        let b = a;
        while (b === a) b = Math.floor(Math.random() * 3);
        const temp = positions[a];
        positions[a] = positions[b];
        positions[b] = temp;
        setCupPositions([...positions]);
        if (i % 3 === 0) sfx(playSfx.shuffle);
      }

      // Let user choose
      setPhase("choosing");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPhase("idle");
      cooldownRef.current = false;
    }
  }, [challenge, phase, muted]);

  const chooseCup = useCallback((cupIndex: number) => {
    if (phase !== "choosing" || !gameResult) return;
    sfx(playSfx.click);
    setChosenCup(cupIndex);
    setPhase("revealing");

    // Vibrate on mobile
    try { navigator.vibrate?.(50); } catch {}

    // Reveal chosen cup first
    setTimeout(() => {
      sfx(playSfx.reveal);
      setRevealedCups(prev => { const n = [...prev]; n[cupIndex] = true; return n; });

      // Reveal others after delay
      setTimeout(() => {
        setRevealedCups([true, true, true]);

        setTimeout(() => {
          const isWin = gameResult.credits_won > 0 || gameResult.balance_won > 0;
          if (isWin) {
            sfx(gameResult.balance_won >= 50 ? playSfx.jackpot : playSfx.win);
            try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch {}
          } else {
            sfx(playSfx.lose);
          }
          setPhase("result");
          refreshProfile();
          queryClient.invalidateQueries({ queryKey: ["my-challenge-attempts"] });
        }, 600);
      }, 800);
    }, 500);
  }, [phase, gameResult, muted]);

  const resetGame = () => {
    setPhase("idle");
    setGameResult(null);
    setChosenCup(null);
    setRevealedCups([false, false, false]);
    setCupPositions([0, 1, 2]);
  };

  const userCredits = (user as any)?.credits || 0;
  const cost = challenge?.cost_credits || 1;
  const canPlay = userCredits >= cost && phase === "idle";
  const isWin = gameResult && (gameResult.credits_won > 0 || gameResult.balance_won > 0);

  // Cup X positions based on shuffled positions
  const cupXPositions = [-110, 0, 110]; // mobile-friendly spacing

  const getCupContent = (visualIndex: number) => {
    if (!gameResult || !revealedCups[visualIndex]) return null;
    // The winning position from backend
    if (visualIndex === gameResult.winning_position) {
      if (isWin) {
        return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, value: gameResult.reward_type === "balance" ? `R$ ${gameResult.balance_won}` : `${gameResult.credits_won}💎` };
      } else {
        // Lost but winning position shows near-miss prize
        return { emoji: gameResult.other_cup.reward_type === "balance" ? "💰" : "💎", label: gameResult.other_cup.label, value: `${gameResult.other_cup.value}` };
      }
    }
    // Non-winning cups
    if (!isWin && visualIndex === chosenCup) {
      return { emoji: "❌", label: "Nada", value: "" };
    }
    if (isWin && visualIndex === chosenCup) {
      return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, value: gameResult.reward_type === "balance" ? `R$ ${gameResult.balance_won}` : `${gameResult.credits_won}💎` };
    }
    return { emoji: "❌", label: "Vazio", value: "" };
  };

  // Recalculate: chosen cup gets the result, winning_position gets the "other" side
  const getCupContentFixed = (visualIndex: number) => {
    if (!gameResult || !revealedCups[visualIndex]) return null;
    if (visualIndex === chosenCup) {
      // This is what the user gets
      if (isWin) {
        return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, won: true };
      } else {
        return { emoji: "❌", label: "Nada", won: false };
      }
    }
    // Other cups
    if (!isWin) {
      // One of the other cups shows the near-miss prize, the rest show nothing
      if (visualIndex === ((chosenCup || 0) + 1) % 3) {
        return { emoji: gameResult.other_cup.reward_type === "balance" ? "💰" : "💎", label: gameResult.other_cup.label, won: false, nearMiss: true };
      }
      return { emoji: "❌", label: "Vazio", won: false };
    }
    // Won: other cups are empty
    return { emoji: "❌", label: "Vazio", won: false };
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">🥤 Jogo dos Copos</h1>
            <p className="text-sm text-muted-foreground">Encontre o copo com o prêmio!</p>
          </div>
          <button onClick={() => setMuted(!muted)} className="rounded-full bg-muted/50 p-2 text-muted-foreground hover:text-foreground transition-colors">
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* Credits bar */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Diamond className="text-primary" size={18} />
            <span className="text-sm text-muted-foreground">Seus créditos:</span>
            <span className="font-bold text-primary">{userCredits}</span>
          </div>
          <span className="text-xs text-muted-foreground">Custo: {cost} 💎</span>
        </div>

        {/* Game Area */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/20 to-background p-6"
          style={{ minHeight: 320 }}>

          {/* Animated background particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-primary/20"
                style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
                animate={{ y: [0, -20, 0], opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>

          {/* Phase text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-8 text-center text-sm font-medium text-muted-foreground"
            >
              {phase === "idle" && "Clique em Jogar para começar!"}
              {phase === "shuffling" && "🔄 Embaralhando..."}
              {phase === "choosing" && "👆 Escolha um copo!"}
              {phase === "revealing" && "🔍 Revelando..."}
              {phase === "result" && (isWin ? "🎉 Parabéns!" : "😔 Não foi dessa vez...")}
            </motion.p>
          </AnimatePresence>

          {/* Cups */}
          <div className="relative mx-auto flex items-end justify-center" style={{ height: 180 }}>
            {[0, 1, 2].map((visualIndex) => {
              const shuffledPos = cupPositions[visualIndex];
              const xPos = cupXPositions[shuffledPos];
              const content = getCupContentFixed(visualIndex);
              const isChosen = chosenCup === visualIndex;
              const isRevealed = revealedCups[visualIndex];

              return (
                <motion.div
                  key={visualIndex}
                  className="absolute flex flex-col items-center"
                  animate={{ x: xPos }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{ bottom: 0 }}
                >
                  {/* Prize underneath */}
                  <AnimatePresence>
                    {isRevealed && content && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`absolute -bottom-1 z-0 flex flex-col items-center rounded-lg px-3 py-1 text-center ${content.won ? "bg-primary/20" : content.nearMiss ? "bg-yellow-500/20" : "bg-muted/50"}`}
                      >
                        <span className="text-2xl">{content.emoji}</span>
                        <span className="text-[10px] font-bold text-foreground">{content.label}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cup */}
                  <motion.button
                    onClick={() => chooseCup(visualIndex)}
                    disabled={phase !== "choosing"}
                    className={`relative z-10 flex h-24 w-20 items-end justify-center rounded-t-3xl rounded-b-lg transition-all ${
                      phase === "choosing" ? "cursor-pointer hover:brightness-125" : "cursor-default"
                    } ${isChosen ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                    style={{
                      background: `linear-gradient(180deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--primary) / 0.6) 100%)`,
                      boxShadow: phase === "choosing" ? "0 8px 30px hsl(var(--primary) / 0.3)" : "0 4px 15px rgba(0,0,0,0.3)",
                    }}
                    animate={{
                      y: isRevealed ? -60 : 0,
                      rotateX: isRevealed ? 20 : 0,
                      scale: phase === "choosing" ? 1 : phase === "shuffling" ? [1, 0.95, 1] : 1,
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    whileHover={phase === "choosing" ? { scale: 1.08, y: -5 } : {}}
                    whileTap={phase === "choosing" ? { scale: 0.95 } : {}}
                  >
                    {/* Cup shine */}
                    <div className="absolute inset-0 rounded-t-3xl rounded-b-lg overflow-hidden">
                      <div className="absolute left-2 top-2 h-16 w-3 rounded-full bg-white/20 blur-sm" />
                    </div>
                    {/* Cup number */}
                    <span className="mb-2 text-2xl font-bold text-primary-foreground/80 select-none">
                      {visualIndex + 1}
                    </span>
                  </motion.button>

                  {/* Shadow */}
                  <motion.div
                    className="mt-1 h-2 rounded-full bg-foreground/10 blur-sm"
                    animate={{ width: isRevealed ? 60 : 72, opacity: isRevealed ? 0.3 : 0.6 }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Result Banner */}
        <AnimatePresence>
          {phase === "result" && gameResult && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`mb-6 rounded-2xl border p-6 text-center ${
                isWin ? "border-green-500/30 bg-green-500/10" : "border-border bg-muted/30"
              }`}
            >
              <motion.div
                animate={isWin ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: isWin ? 2 : 0 }}
                className="text-5xl mb-3"
              >
                {isWin ? "🎉" : "😔"}
              </motion.div>
              <h3 className="text-xl font-bold text-foreground mb-1">{gameResult.label}</h3>
              {isWin ? (
                <p className="text-2xl font-bold text-green-400">
                  {gameResult.reward_type === "balance"
                    ? `+R$ ${Number(gameResult.balance_won).toFixed(2)} 💰`
                    : `+${gameResult.credits_won} 💎`
                  }
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">Sem prêmio desta vez</p>
                  {gameResult.other_cup.value > 0 && (
                    <p className="mt-2 text-xs text-yellow-400">
                      😱 O outro copo tinha: {gameResult.other_cup.label}!
                    </p>
                  )}
                </>
              )}
              <p className="mt-2 text-sm text-muted-foreground">Créditos: {gameResult.new_credits} 💎</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <button
          onClick={phase === "result" ? resetGame : startGame}
          disabled={phase === "shuffling" || phase === "revealing" || phase === "choosing" || (!canPlay && phase === "idle") || playMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playMutation.isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : phase === "result" ? (
            <>🔄 Jogar Novamente</>
          ) : phase === "choosing" ? (
            <>👆 Escolha um copo</>
          ) : phase === "shuffling" ? (
            <>🔄 Embaralhando...</>
          ) : (
            <><Zap size={20} /> Jogar ({cost} 💎)</>
          )}
        </button>

        {/* Confetti effect on win */}
        <AnimatePresence>
          {phase === "result" && isWin && (
            <div className="pointer-events-none fixed inset-0 z-50">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute h-2 w-2 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: -10,
                    backgroundColor: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FF69B4"][i % 6],
                  }}
                  initial={{ y: -10, opacity: 1, rotate: 0 }}
                  animate={{
                    y: window.innerHeight + 20,
                    opacity: [1, 1, 0],
                    rotate: Math.random() * 720,
                    x: (Math.random() - 0.5) * 200,
                  }}
                  transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5, ease: "easeIn" }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default CupGamePage;
