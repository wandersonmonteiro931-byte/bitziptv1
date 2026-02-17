import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, Zap, Volume2, VolumeX } from "lucide-react";

// Phases:
// idle → showing (items visible, cups up) → covering (cups come down) → shuffling → choosing → revealing → result
type GamePhase = "idle" | "showing" | "covering" | "shuffling" | "choosing" | "revealing" | "result";

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
  shuffle: () => playTone(300, 0.08, "square", 0.08),
  click: () => playTone(600, 0.1, "sine", 0.12),
  reveal: () => playTone(500, 0.2, "triangle", 0.1),
  win: () => {
    playTone(523, 0.15, "sine", 0.15);
    setTimeout(() => playTone(659, 0.15, "sine", 0.15), 150);
    setTimeout(() => playTone(784, 0.3, "sine", 0.15), 300);
  },
  lose: () => playTone(200, 0.3, "sawtooth", 0.06),
  jackpot: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.25, "sine", 0.15), i * 120));
  },
  start: () => { playTone(440, 0.15, "sine", 0.1); setTimeout(() => playTone(550, 0.15, "sine", 0.1), 100); },
  cover: () => playTone(220, 0.25, "triangle", 0.08),
};

const CupGamePage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [chosenCup, setChosenCup] = useState<number | null>(null);
  const [cupPositions, setCupPositions] = useState([0, 1, 2]);
  const [cupsDown, setCupsDown] = useState(false);
  const [revealedCups, setRevealedCups] = useState<boolean[]>([false, false, false]);
  const [muted, setMuted] = useState(false);
  const cooldownRef = useRef(false);
  // Which position has the prize (shown before covering)
  const [prizePosition, setPrizePosition] = useState<number>(1);

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

  const getPrizeLabel = () => {
    if (!gameResult) return "💰 ???";
    // The prize shown initially is what the user CAN win
    const isWin = gameResult.credits_won > 0 || gameResult.balance_won > 0;
    if (isWin) {
      return gameResult.reward_type === "balance"
        ? `💰 R$ ${Number(gameResult.balance_won).toFixed(2)}`
        : `💎 ${gameResult.credits_won} créditos`;
    }
    // If user will lose, show the near-miss prize as the bait
    if (gameResult.other_cup.value > 0) {
      return gameResult.other_cup.reward_type === "balance"
        ? `💰 R$ ${Number(gameResult.other_cup.value).toFixed(2)}`
        : `💎 ${gameResult.other_cup.value} créditos`;
    }
    return "💰 Prêmio";
  };

  const startGame = useCallback(async () => {
    if (cooldownRef.current || phase !== "idle") return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 6000);

    sfx(playSfx.start);
    setChosenCup(null);
    setRevealedCups([false, false, false]);
    setCupsDown(false);
    setCupPositions([0, 1, 2]);
    setGameResult(null);

    try {
      // 1. Get result from server
      const result = await playMutation.mutateAsync();
      setGameResult(result);
      setPrizePosition(result.winning_position);

      // 2. Show items (cups are UP, items visible underneath)
      setPhase("showing");

      // 3. After 2s, cups come down to cover items
      await new Promise(r => setTimeout(r, 2000));
      sfx(playSfx.cover);
      setCupsDown(true);
      setPhase("covering");

      // 4. After cups are down (1s animation), start shuffling
      await new Promise(r => setTimeout(r, 1000));
      setPhase("shuffling");
      sfx(playSfx.shuffle);

      // Shuffle cups visually
      let positions = [0, 1, 2];
      const shuffleSteps = 14;
      for (let i = 0; i < shuffleSteps; i++) {
        await new Promise(r => setTimeout(r, 180));
        const a = Math.floor(Math.random() * 3);
        let b = a;
        while (b === a) b = Math.floor(Math.random() * 3);
        const temp = positions[a];
        positions[a] = positions[b];
        positions[b] = temp;
        setCupPositions([...positions]);
        if (i % 3 === 0) sfx(playSfx.shuffle);
      }

      // 5. Let user choose
      setPhase("choosing");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPhase("idle");
      setCupsDown(false);
      cooldownRef.current = false;
    }
  }, [challenge, phase, muted]);

  const chooseCup = useCallback((cupIndex: number) => {
    if (phase !== "choosing" || !gameResult) return;
    sfx(playSfx.click);
    setChosenCup(cupIndex);
    setPhase("revealing");
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
    setCupsDown(false);
  };

  const userCredits = (user as any)?.credits || 0;
  const cost = challenge?.cost_credits || 1;
  const canPlay = userCredits >= cost && phase === "idle";
  const isWin = gameResult && (gameResult.credits_won > 0 || gameResult.balance_won > 0);

  const cupXPositions = [-110, 0, 110];

  // What's under each cup position (based on shuffled positions)
  const getItemUnderCup = (visualIndex: number) => {
    if (!gameResult) return null;
    // The prize is at winning_position initially, then cups shuffle
    // After shuffling, cupPositions maps visual→slot
    // The prize followed the cup that started at the prize position
    if (visualIndex === gameResult.winning_position) {
      const isW = gameResult.credits_won > 0 || gameResult.balance_won > 0;
      if (isW) {
        return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, won: true };
      }
      // User lost: the "prize" is the near-miss
      return {
        emoji: gameResult.other_cup.reward_type === "balance" ? "💰" : "💎",
        label: gameResult.other_cup.label,
        won: false,
        nearMiss: true,
      };
    }
    return { emoji: "❌", label: "Vazio", won: false };
  };

  // For reveal phase: what did the user actually get?
  const getCupRevealContent = (visualIndex: number) => {
    if (!gameResult || !revealedCups[visualIndex]) return null;
    // The real prize position after shuffle doesn't change — winning_position is fixed
    if (visualIndex === gameResult.winning_position) {
      // This cup has the prize
      if (chosenCup === visualIndex) {
        // User chose the prize cup
        if (isWin) {
          return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, won: true };
        }
        // Backend said loss but prize is here — near miss
        return { emoji: gameResult.other_cup.reward_type === "balance" ? "💰" : "💎", label: gameResult.other_cup.label, won: false, nearMiss: true };
      }
      // User didn't choose this cup — show the prize they missed
      if (isWin) {
        return { emoji: "❌", label: "Vazio", won: false };
      }
      return { emoji: gameResult.other_cup.reward_type === "balance" ? "💰" : "💎", label: gameResult.other_cup.label, won: false, nearMiss: true };
    }
    // Non-prize cups
    if (visualIndex === chosenCup && isWin) {
      return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, won: true };
    }
    return { emoji: "❌", label: "Vazio", won: false };
  };

  // Before shuffle: show what's at each initial position
  const getPreviewItem = (posIndex: number) => {
    if (!gameResult) return null;
    if (posIndex === gameResult.winning_position) {
      return { emoji: "💰", hasPrice: true };
    }
    return { emoji: "❌", hasPrice: false };
  };

  const phaseText: Record<GamePhase, string> = {
    idle: "Clique em Jogar para começar!",
    showing: "👀 Memorize onde está o prêmio!",
    covering: "⬇️ Cobrindo os itens...",
    shuffling: "🔄 Embaralhando...",
    choosing: "👆 Escolha um copo!",
    revealing: "🔍 Revelando...",
    result: isWin ? "🎉 Parabéns!" : "😔 Não foi dessa vez...",
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

        {/* Prize info during showing phase */}
        <AnimatePresence>
          {(phase === "showing") && gameResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-center"
            >
              <p className="text-sm font-bold text-primary">Prêmio em jogo: {getPrizeLabel()}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Area */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/20 to-background p-6"
          style={{ minHeight: 340 }}>

          {/* Particles */}
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
              {phaseText[phase]}
            </motion.p>
          </AnimatePresence>

          {/* Cups & Items */}
          <div className="relative mx-auto flex items-end justify-center" style={{ height: 200 }}>
            {[0, 1, 2].map((visualIndex) => {
              const shuffledPos = cupPositions[visualIndex];
              const xPos = cupXPositions[shuffledPos];
              const isRevealed = revealedCups[visualIndex];
              const revealContent = getCupRevealContent(visualIndex);

              // Item preview (before cups cover)
              const previewItem = getPreviewItem(visualIndex);
              const showPreview = (phase === "showing" || phase === "idle") && gameResult;

              // Cups are UP when: idle, showing, or revealed
              const cupUp = !cupsDown || isRevealed;

              return (
                <motion.div
                  key={visualIndex}
                  className="absolute flex flex-col items-center"
                  animate={{
                    x: phase === "shuffling" || phase === "choosing" || phase === "revealing" || phase === "result"
                      ? xPos : cupXPositions[visualIndex],
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{ bottom: 0 }}
                >
                  {/* Item underneath */}
                  <div className="absolute bottom-0 z-0 flex flex-col items-center">
                    {/* Preview items (before covering) */}
                    {showPreview && previewItem && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex flex-col items-center rounded-lg px-4 py-2 ${previewItem.hasPrice ? "bg-primary/20" : "bg-muted/50"}`}
                      >
                        <span className="text-3xl">{previewItem.emoji}</span>
                        <span className="text-[10px] font-bold text-foreground mt-1">
                          {previewItem.hasPrice ? "PRÊMIO" : "VAZIO"}
                        </span>
                      </motion.div>
                    )}

                    {/* Revealed items (after choosing) */}
                    {isRevealed && revealContent && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex flex-col items-center rounded-lg px-3 py-1 ${
                          revealContent.won ? "bg-primary/20" : revealContent.nearMiss ? "bg-yellow-500/20" : "bg-muted/50"
                        }`}
                      >
                        <span className="text-2xl">{revealContent.emoji}</span>
                        <span className="text-[10px] font-bold text-foreground">{revealContent.label}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Cup */}
                  <motion.button
                    onClick={() => chooseCup(visualIndex)}
                    disabled={phase !== "choosing"}
                    className={`relative z-10 flex h-24 w-20 items-end justify-center rounded-t-3xl rounded-b-lg transition-all ${
                      phase === "choosing" ? "cursor-pointer" : "cursor-default"
                    } ${chosenCup === visualIndex ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                    style={{
                      background: `linear-gradient(180deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--primary) / 0.6) 100%)`,
                      boxShadow: phase === "choosing" ? "0 8px 30px hsl(var(--primary) / 0.3)" : "0 4px 15px hsl(var(--foreground) / 0.1)",
                    }}
                    animate={{
                      y: cupUp ? -70 : 0,
                      rotateX: isRevealed ? 15 : 0,
                      scale: phase === "shuffling" ? [1, 0.96, 1] : 1,
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    whileHover={phase === "choosing" ? { scale: 1.08, y: -5 } : {}}
                    whileTap={phase === "choosing" ? { scale: 0.95 } : {}}
                  >
                    {/* Shine */}
                    <div className="absolute inset-0 rounded-t-3xl rounded-b-lg overflow-hidden">
                      <div className="absolute left-2 top-2 h-16 w-3 rounded-full bg-primary-foreground/20 blur-sm" />
                    </div>
                    <span className="mb-2 text-2xl font-bold text-primary-foreground/80 select-none">
                      {visualIndex + 1}
                    </span>
                  </motion.button>

                  {/* Shadow */}
                  <motion.div
                    className="mt-1 h-2 rounded-full bg-foreground/10 blur-sm"
                    animate={{ width: cupUp ? 60 : 72, opacity: cupUp ? 0.3 : 0.6 }}
                    style={{ width: 72 }}
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
                isWin ? "border-primary/30 bg-primary/10" : "border-border bg-muted/30"
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
                <p className="text-2xl font-bold text-primary">
                  {gameResult.reward_type === "balance"
                    ? `+R$ ${Number(gameResult.balance_won).toFixed(2)} 💰`
                    : `+${gameResult.credits_won} 💎`
                  }
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">Sem prêmio desta vez</p>
                  {gameResult.other_cup.value > 0 && (
                    <p className="mt-2 text-xs text-yellow-500">
                      😱 O prêmio estava no outro copo: {gameResult.other_cup.label}!
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
          disabled={phase !== "idle" && phase !== "result" || (!canPlay && phase === "idle") || playMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playMutation.isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : phase === "result" ? (
            <>🔄 Jogar Novamente</>
          ) : phase === "choosing" ? (
            <>👆 Escolha um copo</>
          ) : phase === "shuffling" || phase === "covering" ? (
            <>🔄 Aguarde...</>
          ) : phase === "showing" ? (
            <>👀 Observe...</>
          ) : (
            <><Zap size={20} /> Jogar ({cost} 💎)</>
          )}
        </button>

        {/* Confetti on win */}
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
                    backgroundColor: ["hsl(var(--primary))", "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#FF69B4"][i % 6],
                  }}
                  initial={{ y: -10, opacity: 1, rotate: 0 }}
                  animate={{
                    y: typeof window !== "undefined" ? window.innerHeight + 20 : 800,
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
