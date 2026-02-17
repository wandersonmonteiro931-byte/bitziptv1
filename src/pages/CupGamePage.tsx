import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, Zap, Volume2, VolumeX, Timer } from "lucide-react";
import { sfx, setMuted as setSfxMuted } from "@/lib/sounds";

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

const CHOOSE_TIME = 5;

const CupGamePage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const gameResultRef = useRef<GameResult | null>(null);
  const [chosenCup, setChosenCup] = useState<number | null>(null);
  const [cupPositions, setCupPositions] = useState([0, 1, 2]);
  const [cupsDown, setCupsDown] = useState(false);
  const [revealedCups, setRevealedCups] = useState<boolean[]>([false, false, false]);
  const [muted, setMuted] = useState(false);
  const cooldownRef = useRef(false);
  const [prizePosition, setPrizePosition] = useState<number>(1);
  const [finalWinningVisualIndex, setFinalWinningVisualIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(CHOOSE_TIME);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (!challenge) throw new Error("Jogo não encontrado");
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "play_cup_game", data: { challenge_id: challenge.id } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as GameResult;
    },
  });

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleTimeout = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!gameResultRef.current) return;
    
    // Block choosing immediately
    setPhase("revealing");
    setChosenCup(-1);

    // Animate reveal: lift all cups
    sfx.reveal();
    setTimeout(() => {
      setRevealedCups([true, true, true]);
      
      setTimeout(() => {
        sfx.lose();
        try { navigator.vibrate?.(200); } catch {}
        setPhase("result");
        refreshProfile();
        queryClient.invalidateQueries({ queryKey: ["my-challenge-attempts"] });
      }, 1200);
    }, 500);
  }, [refreshProfile, queryClient]);

  const startCountdown = useCallback(() => {
    setCountdown(CHOOSE_TIME);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    const start = Date.now();
    countdownRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = CHOOSE_TIME - elapsed;
      if (remaining <= 0) {
        setCountdown(0);
        if (countdownRef.current) clearInterval(countdownRef.current);
        handleTimeout();
      } else {
        setCountdown(remaining);
      }
    }, 200);
  }, [handleTimeout]);

  const startGame = useCallback(async () => {
    if (cooldownRef.current || phase !== "idle") return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 8000);

    sfx.start();
    setChosenCup(null);
    setRevealedCups([false, false, false]);
    setCupsDown(false);
    setCupPositions([0, 1, 2]);
    setGameResult(null);
    gameResultRef.current = null;

    try {
      const result = await playMutation.mutateAsync();
      setGameResult(result);
      gameResultRef.current = result;

      // Show items (cups UP)
      setPhase("showing");

      // Cups come down after 2s
      await new Promise(r => setTimeout(r, 2000));
      sfx.cover();
      setCupsDown(true);
      setPhase("covering");

      // Start shuffling after 1s
      await new Promise(r => setTimeout(r, 1000));
      setPhase("shuffling");
      sfx.shuffle();

      // 50 shuffles with varying speed
      let positions = [0, 1, 2];
      const shuffleSteps = 50;
      for (let i = 0; i < shuffleSteps; i++) {
        // Start slow, speed up in middle, slow down at end
        let speed: number;
        if (i < 8) speed = 450 - i * 25;
        else if (i > 42) speed = 250 + (i - 42) * 30;
        else speed = 280;
        await new Promise(r => setTimeout(r, speed));
        const a = Math.floor(Math.random() * 3);
        let b = a;
        while (b === a) b = Math.floor(Math.random() * 3);
        const temp = positions[a];
        positions[a] = positions[b];
        positions[b] = temp;
        setCupPositions([...positions]);
        if (i % 3 === 0) sfx.shuffle();
      }

      // Track where the winning cup ended up visually
      // positions[visualIndex] = screenSlot. We need: which visualIndex has winning_position's screen slot?
      // The winning cup started at visualIndex === result.winning_position
      // After shuffling, that visual cup is now at screen slot positions[result.winning_position]
      // But user clicks on a visual index, so we need to find which visual index the prize is at
      // Prize started at visualIndex = result.winning_position. Shuffling moves visual cups.
      // Actually positions maps visualIndex -> screenSlot. The prize is INSIDE visualIndex=winning_position.
      // So the prize visual index is STILL winning_position, just at a different screen slot.
      setFinalWinningVisualIndex(result.winning_position);

      setPhase("choosing");
      startCountdown();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPhase("idle");
      setCupsDown(false);
      cooldownRef.current = false;
    }
  }, [challenge, phase, startCountdown]);

  const chooseCup = useCallback((cupIndex: number) => {
    if (phase !== "choosing" || !gameResult) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    sfx.click();
    setChosenCup(cupIndex);
    setPhase("revealing");
    try { navigator.vibrate?.(50); } catch {}

    setTimeout(() => {
      sfx.reveal();
      setRevealedCups(prev => { const n = [...prev]; n[cupIndex] = true; return n; });

      setTimeout(() => {
        setRevealedCups([true, true, true]);

        setTimeout(() => {
          const isWin = gameResult.credits_won > 0 || gameResult.balance_won > 0;
          if (isWin) {
            sfx.celebrate();
            try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch {}
          } else {
            sfx.lose();
          }
          setPhase("result");
          refreshProfile();
          queryClient.invalidateQueries({ queryKey: ["my-challenge-attempts"] });
        }, 600);
      }, 800);
    }, 500);
  }, [phase, gameResult]);

  const resetGame = () => {
    setPhase("idle");
    setGameResult(null);
    setChosenCup(null);
    setRevealedCups([false, false, false]);
    setCupPositions([0, 1, 2]);
    setCupsDown(false);
    setCountdown(CHOOSE_TIME);
  };

  const userCredits = (user as any)?.credits || 0;
  const cost = challenge?.cost_credits || 1;
  const canPlay = userCredits >= cost && phase === "idle";
  const isWin = gameResult && (gameResult.credits_won > 0 || gameResult.balance_won > 0) && chosenCup !== -1;
  const timedOut = chosenCup === -1;

  const cupXPositions = [-110, 0, 110];

  const getPreviewItem = (posIndex: number) => {
    if (!gameResult) return null;
    if (posIndex === gameResult.winning_position) {
      return { emoji: "💰", hasPrice: true };
    }
    return { emoji: "❌", hasPrice: false };
  };

  const getCupRevealContent = (visualIndex: number) => {
    if (!gameResult || !revealedCups[visualIndex]) return null;
    if (timedOut) {
      // Timeout: show where the prize was, but no award
      if (visualIndex === gameResult.winning_position) {
        return { emoji: "💰", label: "R$ 1,50", won: false, nearMiss: true };
      }
      return { emoji: "❌", label: "Vazio", won: false };
    }
    // Backend already decided win/loss. If win, prize is under the chosen cup.
    if (isWin) {
      if (visualIndex === chosenCup) {
        return { emoji: gameResult.reward_type === "balance" ? "💰" : "💎", label: gameResult.label, won: true };
      }
      return { emoji: "❌", label: "Vazio", won: false };
    }
    // Loss: show prize under winning_position as "near miss"
    if (visualIndex === chosenCup) {
      return { emoji: "❌", label: "Vazio", won: false };
    }
    if (visualIndex === gameResult.winning_position && gameResult.other_cup.value > 0) {
      return { emoji: gameResult.other_cup.reward_type === "balance" ? "💰" : "💎", label: gameResult.other_cup.label, won: false, nearMiss: true };
    }
    return { emoji: "❌", label: "Vazio", won: false };
  };

  const phaseText: Record<GamePhase, string> = {
    idle: "Clique em Jogar para começar!",
    showing: "👀 Memorize onde está o prêmio!",
    covering: "⬇️ Cobrindo os itens...",
    shuffling: "🔄 Embaralhando...",
    choosing: `👆 Escolha um copo! (${countdown}s)`,
    revealing: "🔍 Revelando...",
    result: timedOut ? "⏰ Tempo esgotado!" : isWin ? "🎉 Parabéns!" : "😔 Não foi dessa vez...",
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
          <button onClick={() => { setMuted(!muted); setSfxMuted(!muted); }} className="rounded-full bg-muted/50 p-2 text-muted-foreground hover:text-foreground transition-colors">
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* Credits bar */}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Diamond className="text-primary" size={18} />
            <span className="text-sm text-muted-foreground">Seus créditos:</span>
            <span className="font-bold text-primary">{userCredits}</span>
          </div>
          <span className="text-xs text-muted-foreground">Custo: {cost} 💎</span>
        </div>

        {/* Timer warning before playing */}
        {phase === "idle" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
            <Timer size={16} className="text-warning shrink-0" />
            <p className="text-xs text-warning">
              ⚠️ Após o embaralhamento você terá <strong>{CHOOSE_TIME} segundos</strong> para escolher um copo. Se não escolher, perderá o prêmio!
            </p>
          </div>
        )}

        {/* Prize info during showing phase */}
        <AnimatePresence>
          {phase === "showing" && gameResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-center"
            >
              <p className="text-sm font-bold text-primary">Prêmio em jogo: 💰 R$ 1,50</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown bar during choosing */}
        <AnimatePresence>
          {phase === "choosing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-warning flex items-center gap-1">
                  <Timer size={12} /> Tempo restante
                </span>
                <span className={`text-sm font-bold ${countdown <= 2 ? "text-destructive animate-pulse" : "text-warning"}`}>
                  {countdown}s
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${countdown <= 2 ? "bg-destructive" : "bg-warning"}`}
                  initial={{ width: "100%" }}
                  animate={{ width: `${(countdown / CHOOSE_TIME) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
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
              key={phase + countdown}
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
              const previewItem = getPreviewItem(visualIndex);
              const showPreview = (phase === "showing" || phase === "idle") && gameResult;
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
                    {showPreview && previewItem && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex flex-col items-center rounded-lg px-4 py-2 ${previewItem.hasPrice ? "bg-primary/20" : "bg-muted/50"}`}
                      >
                        <span className="text-3xl">{previewItem.emoji}</span>
                        <span className="text-[10px] font-bold text-foreground mt-1">
                          {previewItem.hasPrice ? "R$ 1,50" : "VAZIO"}
                        </span>
                      </motion.div>
                    )}

                    {isRevealed && revealContent && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex flex-col items-center rounded-lg px-3 py-1 ${
                          revealContent.won ? "bg-primary/20" : revealContent.nearMiss ? "bg-warning/20" : "bg-muted/50"
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
                    <div className="absolute inset-0 rounded-t-3xl rounded-b-lg overflow-hidden">
                      <div className="absolute left-2 top-2 h-16 w-3 rounded-full bg-primary-foreground/20 blur-sm" />
                    </div>
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
                {timedOut ? "⏰" : isWin ? "🎉" : "😔"}
              </motion.div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                {timedOut ? "Tempo esgotado!" : gameResult.label}
              </h3>
              {timedOut ? (
                <p className="text-muted-foreground">Você não escolheu a tempo e perdeu o prêmio!</p>
              ) : isWin ? (
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
                    <p className="mt-2 text-xs text-warning">
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
