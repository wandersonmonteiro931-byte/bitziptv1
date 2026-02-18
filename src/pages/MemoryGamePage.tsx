import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, Trophy, Clock, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sfx } from "@/lib/sounds";

const EMOJIS = [
  "🐶","🐱","🐼","🐸","🦄","🦊","🐯","🦁","🐵","🐔",
  "🍕","🍩","🍔","🍟","🍉","🍓","🍒","🍍","🍪","🍫",
  "⚽","🎮","🎧","🚗","🚀",
];

type Card = { id: number; emoji: string; pairId: number; flipped: boolean; matched: boolean };
type Phase = "idle" | "memorize" | "playing" | "won" | "lost";

function createDeck(): Card[] {
  const pairs: Card[] = [];
  EMOJIS.forEach((emoji, i) => {
    pairs.push({ id: i * 2, emoji, pairId: i, flipped: false, matched: false });
    pairs.push({ id: i * 2 + 1, emoji, pairId: i, flipped: false, matched: false });
  });
  // Shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

const MemoryGamePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [memorizeTime, setMemorizeTime] = useState(5);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [alreadyWonToday, setAlreadyWonToday] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(1.5);
  const [gameResult, setGameResult] = useState<{ won: boolean; rewarded: boolean; reward_amount: number } | null>(null);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const lockRef = useRef(false);

  // Check daily status
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.functions.invoke("memory-game", {
        body: { action: "check_daily" },
      });
      if (data) {
        setAlreadyWonToday(data.already_won_today);
        if (data.settings) {
          setSettings(data.settings);
          setRewardAmount(data.settings.reward_amount);
          setTimeLeft(data.settings.time_limit_seconds);
          setMemorizeTime(data.settings.memorize_seconds);
        }
      }
    };
    check();
  }, []);

  // Load personal best
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("game_memory_sessions")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .eq("won", true)
        .order("duration_seconds", { ascending: true })
        .limit(1);
      if (data && data.length > 0) setPersonalBest(data[0].duration_seconds);
    };
    load();
  }, [user]);

  const sound = useCallback((name: string) => {
    if (!muted && sfx[name as keyof typeof sfx]) sfx[name as keyof typeof sfx]();
  }, [muted]);

  const startGame = () => {
    if (settings && !settings.is_active) {
      toast({ title: "Jogo desativado pelo administrador", variant: "destructive" });
      return;
    }
    const deck = createDeck();
    setCards(deck.map((c) => ({ ...c, flipped: true })));
    setPhase("memorize");
    setMatchedPairs(0);
    setSelected([]);
    setGameResult(null);
    setDuration(0);
    sound("gameStart");

    // Memorize countdown
    let mem = settings?.memorize_seconds || 5;
    setMemorizeTime(mem);
    const memTimer = setInterval(() => {
      mem--;
      setMemorizeTime(mem);
      if (mem <= 0) {
        clearInterval(memTimer);
        // Flip all cards down
        setCards((prev) => prev.map((c) => ({ ...c, flipped: false })));
        setPhase("playing");
        setTimeLeft(settings?.time_limit_seconds || 60);
        startTimeRef.current = Date.now();
        sound("shuffle");
        // Start game timer
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              setPhase("lost");
              sound("lose");
              return 0;
            }
            if (prev === 16) sound("click"); // tension sound
            return prev - 1;
          });
        }, 1000);
      }
    }, 1000);
  };

  const handleCardClick = (index: number) => {
    if (phase !== "playing" || lockRef.current) return;
    const card = cards[index];
    if (card.flipped || card.matched) return;

    sound("click");

    const newCards = [...cards];
    newCards[index] = { ...card, flipped: true };
    setCards(newCards);

    const newSelected = [...selected, index];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      lockRef.current = true;
      const [first, second] = newSelected;
      const c1 = newCards[first];
      const c2 = newCards[second];

      if (c1.pairId === c2.pairId) {
        // Match!
        sound("win");
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === first || i === second ? { ...c, matched: true } : c
            )
          );
          const newMatched = matchedPairs + 1;
          setMatchedPairs(newMatched);

          if (newMatched === 25) {
            // Won!
            clearInterval(timerRef.current);
            const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
            setDuration(dur);
            setPhase("won");
            sound("jackpot");
            completeGame(dur, 25);
          }

          lockRef.current = false;
          setSelected([]);
        }, 300);
      } else {
        // No match
        sound("lose");
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === first || i === second ? { ...c, flipped: false } : c
            )
          );
          lockRef.current = false;
          setSelected([]);
        }, 800);
      }
    }
  };

  const completeGame = async (dur: number, pairs: number) => {
    try {
      const { data } = await supabase.functions.invoke("memory-game", {
        body: { action: "complete_game", duration_seconds: dur, pairs_found: pairs },
      });
      if (data) {
        setGameResult(data);
        if (data.rewarded && personalBest === null || (dur < (personalBest || Infinity))) {
          setPersonalBest(dur);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const timePercent = ((settings?.time_limit_seconds || 60) - timeLeft) / (settings?.time_limit_seconds || 60) * 100;
  const isUrgent = timeLeft <= 15;
  const isCritical = timeLeft <= 5;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
          <button onClick={() => setMuted(!muted)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* ===== IDLE SCREEN ===== */}
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }} className="mb-4">
              <Brain size={64} className="mx-auto text-primary" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">🎮 Desafio da Memória</h1>
            <p className="text-sm text-muted-foreground mb-1">
              Encontre os 25 pares em {settings?.time_limit_seconds || 60} segundos
            </p>
            <p className="text-lg font-bold text-primary mb-6">
              💰 Ganhe R$ {Number(rewardAmount).toFixed(2)}
            </p>

            {alreadyWonToday && (
              <div className="mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-400">
                ⚠️ Você já ganhou hoje. Pode jogar, mas sem recompensa.
              </div>
            )}

            {personalBest && (
              <div className="mb-4 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
                🏆 Seu recorde: {personalBest}s
              </div>
            )}

            <button
              onClick={startGame}
              className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition-all"
            >
              ▶️ COMEÇAR
            </button>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-lg font-bold text-foreground">50</p>
                <p className="text-[10px] text-muted-foreground">Cartas</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-lg font-bold text-foreground">25</p>
                <p className="text-[10px] text-muted-foreground">Pares</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-lg font-bold text-foreground">{settings?.time_limit_seconds || 60}s</p>
                <p className="text-[10px] text-muted-foreground">Tempo</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== MEMORIZE PHASE ===== */}
        {phase === "memorize" && (
          <div>
            <div className="mb-4 text-center">
              <motion.p animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-xl font-bold text-yellow-400">
                ⏳ Memorize! {memorizeTime}s
              </motion.p>
              <p className="text-xs text-muted-foreground mt-1">As cartas serão viradas em breve...</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
              {cards.map((card, i) => (
                <div key={card.id} className="aspect-square rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-lg sm:text-xl">
                  {card.emoji}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== PLAYING PHASE ===== */}
        {phase === "playing" && (
          <div>
            {/* Timer */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Clock size={14} className={isCritical ? "text-red-400 animate-pulse" : isUrgent ? "text-yellow-400" : "text-primary"} />
                  <span className={`text-lg font-bold ${isCritical ? "text-red-400 animate-pulse" : isUrgent ? "text-yellow-400" : "text-foreground"}`}>
                    {timeLeft}s
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{matchedPairs}/25 pares</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-colors ${isCritical ? "bg-red-500" : isUrgent ? "bg-yellow-500" : "bg-primary"}`}
                  style={{ width: `${100 - timePercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
              {cards.map((card, i) => (
                <motion.button
                  key={card.id}
                  onClick={() => handleCardClick(i)}
                  whileTap={{ scale: 0.95 }}
                  className={`aspect-square rounded-lg text-lg sm:text-xl flex items-center justify-center transition-all duration-300 ${
                    card.matched
                      ? "bg-emerald-500/20 border border-emerald-500/30 shadow-sm shadow-emerald-500/20"
                      : card.flipped
                      ? "bg-card border border-primary/30 shadow-md"
                      : "bg-muted/80 border border-border hover:border-primary/30 hover:bg-muted cursor-pointer"
                  }`}
                  style={{
                    perspective: "600px",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <AnimatePresence mode="wait">
                    {card.flipped || card.matched ? (
                      <motion.span
                        key="front"
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {card.emoji}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="back"
                        initial={{ rotateY: -90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-muted-foreground text-xs"
                      >
                        ?
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ===== WON SCREEN ===== */}
        {phase === "won" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, repeat: 3 }}>
              <Trophy size={64} className="mx-auto text-yellow-400 mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground mb-2">🎉 PARABÉNS!</h2>
            <p className="text-muted-foreground mb-4">
              Completou em <span className="font-bold text-primary">{duration}s</span>!
            </p>
            {gameResult?.rewarded ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="mb-6 rounded-xl bg-emerald-500/15 border border-emerald-500/20 px-6 py-4"
              >
                <p className="text-lg font-bold text-emerald-400">💰 +R$ {Number(gameResult.reward_amount).toFixed(2)}</p>
                <p className="text-xs text-emerald-400/70">Creditado na sua conta!</p>
              </motion.div>
            ) : (
              <div className="mb-6 rounded-xl bg-muted px-6 py-4">
                <p className="text-sm text-muted-foreground">Sem recompensa (limite diário atingido)</p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={startGame} className="rounded-xl bg-primary/15 px-6 py-3 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors">
                🔄 Jogar Novamente
              </button>
              <button onClick={() => navigate("/dashboard")} className="rounded-xl bg-muted px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors">
                Voltar
              </button>
            </div>
          </motion.div>
        )}

        {/* ===== LOST SCREEN ===== */}
        {phase === "lost" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
            <Clock size={64} className="mx-auto text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">⏰ Tempo Esgotado!</h2>
            <p className="text-muted-foreground mb-2">Encontrou {matchedPairs}/25 pares</p>
            <p className="text-xs text-muted-foreground mb-6">Tente novamente!</p>
            <div className="flex gap-3 justify-center">
              <button onClick={startGame} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 transition-all">
                🔄 Tentar Novamente
              </button>
              <button onClick={() => navigate("/dashboard")} className="rounded-xl bg-muted px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors">
                Voltar
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default MemoryGamePage;
