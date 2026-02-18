import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Volume2, VolumeX, Trophy, Clock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sfx } from "@/lib/sounds";
import { Progress } from "@/components/ui/progress";

const EMOJIS = ["🐶","🐱","🐼","🦊","🐯","🦁","🍕","🍩","⚽","🚀"];
const TOTAL_PAIRS = 10;

type Card = { id: number; emoji: string; pairId: number; flipped: boolean; matched: boolean };
type Phase = "idle" | "memorize" | "playing" | "won" | "lost";

function createDeck(): Card[] {
  const pairs: Card[] = [];
  EMOJIS.forEach((emoji, i) => {
    pairs.push({ id: i * 2, emoji, pairId: i, flipped: false, matched: false });
    pairs.push({ id: i * 2 + 1, emoji, pairId: i, flipped: false, matched: false });
  });
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

const MemoryGamePage = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [memorizeTime, setMemorizeTime] = useState(3);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [alreadyWonToday, setAlreadyWonToday] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(1.5);
  const [costPerGame, setCostPerGame] = useState(0.5);
  const [gameResult, setGameResult] = useState<{ won: boolean; rewarded: boolean; reward_amount: number } | null>(null);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [combo, setCombo] = useState(0);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const lockRef = useRef(false);
  const memTimerRef = useRef<any>(null);

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
          setCostPerGame(data.settings.cost_per_game || 0.5);
          setTimeLeft(data.settings.time_limit_seconds);
          setMemorizeTime(data.settings.memorize_seconds || 3);
        }
      }
    };
    check();
  }, []);

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

  const startGame = async () => {
    if (settings && !settings.is_active) {
      toast({ title: "Jogo desativado", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Deduct credits via edge function
    const { data, error } = await supabase.functions.invoke("memory-game", {
      body: { action: "start_game" },
    });
    if (error || data?.error) {
      toast({ title: data?.error || "Erro ao iniciar", description: data?.required ? `Necessário: R$ ${Number(data.required).toFixed(2)}` : undefined, variant: "destructive" });
      setLoading(false);
      return;
    }
    refreshProfile();
    setLoading(false);

    const deck = createDeck();
    setCards(deck.map((c) => ({ ...c, flipped: true })));
    setPhase("memorize");
    setMatchedPairs(0);
    setSelected([]);
    setGameResult(null);
    setDuration(0);
    setCombo(0);
    sound("gameStart");

    let mem = settings?.memorize_seconds || 3;
    setMemorizeTime(mem);
    memTimerRef.current = setInterval(() => {
      mem--;
      setMemorizeTime(mem);
      if (mem <= 0) {
        clearInterval(memTimerRef.current);
        // Cascade close
        setCards((prev) => prev.map((c) => ({ ...c, flipped: false })));
        setPhase("playing");
        setTimeLeft(settings?.time_limit_seconds || 60);
        startTimeRef.current = Date.now();
        sound("shuffle");
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              setPhase("lost");
              sound("lose");
              return 0;
            }
            if (prev === 6) sound("click");
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
        sound("win");
        setCombo((c) => c + 1);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === first || i === second ? { ...c, matched: true } : c
            )
          );
          const newMatched = matchedPairs + 1;
          setMatchedPairs(newMatched);

          if (newMatched === TOTAL_PAIRS) {
            clearInterval(timerRef.current);
            const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
            setDuration(dur);
            setPhase("won");
            sound("jackpot");
            completeGame(dur, TOTAL_PAIRS);
          }

          lockRef.current = false;
          setSelected([]);
        }, 350);
      } else {
        sound("lose");
        setCombo(0);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === first || i === second ? { ...c, flipped: false } : c
            )
          );
          lockRef.current = false;
          setSelected([]);
        }, 700);
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
        if (data.rewarded) refreshProfile();
        if (personalBest === null || dur < (personalBest || Infinity)) {
          setPersonalBest(dur);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (memTimerRef.current) clearInterval(memTimerRef.current);
    };
  }, []);

  const timePercent = ((settings?.time_limit_seconds || 60) - timeLeft) / (settings?.time_limit_seconds || 60) * 100;
  const isUrgent = timeLeft <= 15;
  const isCritical = timeLeft <= 5;
  const balance = Number((user as any)?.balance || 0);

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-[hsl(240,30%,8%)] via-[hsl(260,25%,12%)] to-[hsl(220,30%,10%)] text-foreground overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      
      {/* ===== TOP BAR ===== */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90 transition-colors">
          <ArrowLeft size={16} /> Sair
        </button>
        {phase === "playing" && (
          <div className="flex items-center gap-2">
            {combo >= 2 && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                <Zap size={10} /> x{combo}
              </motion.div>
            )}
            <span className={`text-lg font-bold tabular-nums ${isCritical ? "text-red-400 animate-pulse" : isUrgent ? "text-yellow-400" : "text-white"}`}>
              {timeLeft}s
            </span>
          </div>
        )}
        <button onClick={() => setMuted(!muted)} className="rounded-lg p-1.5 text-white/60 hover:text-white/90 transition-colors">
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* ===== PROGRESS BAR (playing) ===== */}
      {phase === "playing" && (
        <div className="px-3 shrink-0">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isCritical ? "bg-red-500" : isUrgent ? "bg-yellow-500" : "bg-primary"}`}
              style={{ width: `${100 - timePercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-white/40">
            <span>{matchedPairs}/{TOTAL_PAIRS} pares</span>
            <span>💰 R$ {balance.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex items-center justify-center px-2">
        
        {/* IDLE SCREEN */}
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full max-w-sm px-4">
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="mb-3">
              <span className="text-5xl">🧠</span>
            </motion.div>
            <h1 className="text-xl font-bold text-white mb-1">Desafio da Memória</h1>
            <p className="text-xs text-white/50 mb-1">
              Encontre os {TOTAL_PAIRS} pares em {settings?.time_limit_seconds || 60}s
            </p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                🏆 R$ {Number(rewardAmount).toFixed(2)}
              </span>
              <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">
                🎮 R$ {Number(costPerGame).toFixed(2)}
              </span>
            </div>

            {alreadyWonToday && (
              <div className="mb-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-400">
                ⚠️ Já ganhou hoje – pode jogar sem recompensa
              </div>
            )}

            {personalBest && (
              <div className="mb-3 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
                🏆 Recorde: {personalBest}s
              </div>
            )}

            <div className="mb-4 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/40">
              💰 Saldo: R$ {balance.toFixed(2)}
            </div>

            <button
              onClick={startGame}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-primary to-[hsl(280,80%,55%)] px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/30 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? "Iniciando..." : "▶️ JOGAR"}
            </button>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-2">
                <p className="text-base font-bold text-white">20</p>
                <p className="text-[9px] text-white/40">Cartas</p>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <p className="text-base font-bold text-white">{TOTAL_PAIRS}</p>
                <p className="text-[9px] text-white/40">Pares</p>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <p className="text-base font-bold text-white">{settings?.time_limit_seconds || 60}s</p>
                <p className="text-[9px] text-white/40">Tempo</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* MEMORIZE PHASE */}
        {phase === "memorize" && (
          <div className="w-full max-w-[340px]">
            <div className="mb-3 text-center">
              <motion.p animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="text-lg font-bold text-yellow-400">
                ⏳ Memorize! {memorizeTime}
              </motion.p>
            </div>
            <div className="grid grid-cols-4 gap-[6px]">
              {cards.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.4 }}
                  className="aspect-square rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-lg"
                  style={{ perspective: "800px" }}
                >
                  {card.emoji}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* PLAYING PHASE */}
        {phase === "playing" && (
          <div className="w-full max-w-[340px]">
            <div className="grid grid-cols-4 gap-[6px]">
              {cards.map((card, i) => {
                const isFlipped = card.flipped || card.matched;
                return (
                  <motion.button
                    key={card.id}
                    onClick={() => handleCardClick(i)}
                    whileTap={{ scale: 0.92 }}
                    className="aspect-square rounded-xl relative overflow-hidden"
                    style={{ perspective: "800px", transformStyle: "preserve-3d" }}
                  >
                    {/* Card Inner */}
                    <motion.div
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                      className="w-full h-full relative"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {/* BACK (face-down) */}
                      <div
                        className={`absolute inset-0 rounded-xl flex items-center justify-center backface-hidden ${
                          card.matched ? "opacity-0" : "bg-gradient-to-br from-[hsl(260,50%,25%)] to-[hsl(240,40%,18%)] border border-white/10 shadow-md"
                        }`}
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <span className="text-white/20 text-lg font-bold">?</span>
                      </div>
                      {/* FRONT (face-up) */}
                      <div
                        className={`absolute inset-0 rounded-xl flex items-center justify-center ${
                          card.matched
                            ? "bg-emerald-500/20 border-2 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : "bg-gradient-to-br from-white/15 to-white/5 border border-primary/30 shadow-lg"
                        }`}
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <span className="text-2xl">{card.emoji}</span>
                      </div>
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* WON SCREEN */}
        {phase === "won" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center px-6">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, repeat: 3 }}>
              <Trophy size={56} className="mx-auto text-yellow-400 mb-3" />
            </motion.div>
            <h2 className="text-xl font-bold text-white mb-1">🎉 PARABÉNS!</h2>
            <p className="text-sm text-white/60 mb-3">
              Completou em <span className="font-bold text-primary">{duration}s</span>
              {duration <= 30 && " ⚡ RÁPIDO!"}
            </p>
            {gameResult?.rewarded ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                className="mb-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 px-6 py-4">
                <p className="text-lg font-bold text-emerald-400">💰 +R$ {Number(gameResult.reward_amount).toFixed(2)}</p>
                <p className="text-[10px] text-emerald-400/70">Creditado na sua conta!</p>
              </motion.div>
            ) : (
              <div className="mb-5 rounded-2xl bg-white/5 px-6 py-3">
                <p className="text-xs text-white/40">Sem recompensa (limite diário)</p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={startGame} className="rounded-2xl bg-primary/20 px-5 py-3 text-sm font-bold text-primary hover:bg-primary/30 transition-colors">
                🔄 Jogar
              </button>
              <button onClick={() => navigate("/dashboard")} className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/15 transition-colors">
                Voltar
              </button>
            </div>
          </motion.div>
        )}

        {/* LOST SCREEN */}
        {phase === "lost" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center px-6">
            <Clock size={56} className="mx-auto text-red-400 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">⏰ Tempo Esgotado!</h2>
            <p className="text-sm text-white/40 mb-1">{matchedPairs}/{TOTAL_PAIRS} pares encontrados</p>
            <p className="text-xs text-white/30 mb-5">Tente novamente!</p>
            <div className="flex gap-3 justify-center">
              <button onClick={startGame} className="rounded-2xl bg-gradient-to-r from-primary to-[hsl(280,80%,55%)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:brightness-110 transition-all">
                🔄 Tentar
              </button>
              <button onClick={() => navigate("/dashboard")} className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/15 transition-colors">
                Voltar
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ===== BOTTOM BAR (playing) ===== */}
      {phase === "playing" && (
        <div className="px-4 pb-2 shrink-0">
          <Progress value={matchedPairs / TOTAL_PAIRS * 100} className="h-2 bg-white/10" />
        </div>
      )}
    </div>
  );
};

export default MemoryGamePage;
