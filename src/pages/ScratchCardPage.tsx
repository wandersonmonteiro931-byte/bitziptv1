import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, Ticket, RotateCcw, Trophy, Flame, Star, TrendingUp, Zap, Crown, Sparkles, Shield, Volume2, VolumeX } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { sfx, setMuted as setSfxMuted, isMuted } from "@/lib/sounds";

// ═══════════════════════════════════════════════
// PRIZE DEFINITIONS
// ═══════════════════════════════════════════════
const PRIZE_DATA: Record<string, { emoji: string; label: string; color: string; glow: string }> = {
  nada:  { emoji: "❌", label: "Nada",       color: "#888",    glow: "transparent" },
  r1:    { emoji: "🪙", label: "R$ 1",       color: "#4ade80", glow: "#4ade8040" },
  r5:    { emoji: "💵", label: "R$ 5",       color: "#22c55e", glow: "#22c55e40" },
  c1:    { emoji: "💎", label: "1 💎",       color: "#60a5fa", glow: "#60a5fa40" },
  c3:    { emoji: "💎", label: "3 💎",       color: "#3b82f6", glow: "#3b82f640" },
  r30:   { emoji: "💰", label: "R$ 30",      color: "#f59e0b", glow: "#f59e0b40" },
  r50:   { emoji: "🤑", label: "R$ 50",      color: "#f97316", glow: "#f9731640" },
  r100:  { emoji: "🏆", label: "R$ 100",     color: "#eab308", glow: "#eab30860" },
  r500:  { emoji: "👑", label: "R$ 500",     color: "#a855f7", glow: "#a855f760" },
  r1000: { emoji: "🌟", label: "R$ 1.000",   color: "#ec4899", glow: "#ec489960" },
};

// ═══════════════════════════════════════════════
// LOCAL STORAGE PERSISTENCE
// ═══════════════════════════════════════════════
const STORAGE_KEY = "scratch_game_state";

interface SavedGameState {
  grid: string[];
  revealedCells: boolean[];
  matchedCells: number[];
  backendResult: any;
  wonPrizeKey: string | null;
  gameState: "scratching" | "finished";
  gameFinished: boolean;
  showResult: boolean;
  userId: string;
  timestamp: number;
}

function saveGameState(state: SavedGameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadGameState(userId: string): SavedGameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGameState;
    // Must belong to the same user and be less than 24h old
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ═══════════════════════════════════════════════
// CONFETTI EFFECT
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
// SCRATCH CELL – canvas brush-based scratch effect
// ═══════════════════════════════════════════════
interface ScratchCellHandle {
  scratchAt: (clientX: number, clientY: number) => void;
  resetLastPoint: () => void;
}

const CELL_SIZE = 200;
const BRUSH_RADIUS = 38; // Large brush - reveals wherever finger passes
const REVEAL_THRESHOLD = 0.20; // 20% to auto-reveal
const CHECK_INTERVAL = 3; // Check every 3 strokes

const ScratchCell = React.forwardRef<
  ScratchCellHandle,
  {
    prizeKey: string;
    index: number;
    revealed: boolean;
    isMatched: boolean;
    onReveal: (index: number) => void;
    disabled: boolean;
  }
>(({ prizeKey, index, revealed, isMatched, onReveal, disabled }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellRevealed = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokeCount = useRef(0);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";

    const gradient = ctx.createLinearGradient(0, 0, CELL_SIZE, CELL_SIZE);
    gradient.addColorStop(0, "#2a1a4e");
    gradient.addColorStop(0.3, "#1e3a6e");
    gradient.addColorStop(0.5, "#3d1b69");
    gradient.addColorStop(0.7, "#1e3a6e");
    gradient.addColorStop(1, "#2a1a4e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);

    // Sparkle particles
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${180 + Math.random() * 75}, ${150 + Math.random() * 105}, 255, ${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * CELL_SIZE, Math.random() * CELL_SIZE, Math.random() * 2 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crosshatch texture
    ctx.strokeStyle = "rgba(100, 200, 255, 0.06)";
    ctx.lineWidth = 0.5;
    for (let i = -CELL_SIZE; i < CELL_SIZE * 2; i += 12) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CELL_SIZE, CELL_SIZE); ctx.stroke();
    }

    // Question mark
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#00d4ff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", CELL_SIZE / 2, CELL_SIZE / 2);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = "rgba(0, 200, 255, 0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4);
  }, []);

  useEffect(() => {
    cellRevealed.current = false;
    lastPoint.current = null;
    strokeCount.current = 0;
    if (!revealed) initCanvas();
  }, [initCanvas, prizeKey, revealed]);

  const checkRevealPercent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || cellRevealed.current) return;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, CELL_SIZE, CELL_SIZE);
    let cleared = 0;
    let total = 0;
    // Sample every 4th pixel for performance
    for (let i = 3; i < imageData.data.length; i += 16) {
      total++;
      if (imageData.data[i] === 0) cleared++;
    }
    if (cleared / total >= REVEAL_THRESHOLD) {
      cellRevealed.current = true;
      // Don't clear entire canvas - fade it out gradually so only scratched area shows first
      const canvasEl = canvas;
      let opacity = 1;
      const fadeOut = () => {
        opacity -= 0.08;
        if (opacity <= 0) {
          canvasEl.style.opacity = "0";
          onReveal(index);
        } else {
          canvasEl.style.opacity = String(opacity);
          requestAnimationFrame(fadeOut);
        }
      };
      requestAnimationFrame(fadeOut);
      if (navigator.vibrate) navigator.vibrate(15);
    }
  }, [index, onReveal]);

  // Draw a brush stroke as a thick line from lastPoint to current point
  const brushStroke = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || cellRevealed.current || disabled) return;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH_RADIUS * 2;

    const prev = lastPoint.current;
    if (prev) {
      // Draw a thick line between previous and current position
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // First touch: just draw a dot
      ctx.beginPath();
      ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    lastPoint.current = { x, y };

    // Only check percentage every N strokes for performance
    strokeCount.current++;
    if (strokeCount.current % CHECK_INTERVAL === 0) {
      checkRevealPercent();
    }
  }, [disabled, checkRevealPercent]);

  React.useImperativeHandle(ref, () => ({
    scratchAt(clientX: number, clientY: number) {
      const canvas = canvasRef.current;
      if (!canvas || cellRevealed.current || disabled) return;
      const rect = canvas.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        // Pointer left this cell, reset lastPoint so we don't draw a line across
        lastPoint.current = null;
        return;
      }
      const x = (clientX - rect.left) * (CELL_SIZE / rect.width);
      const y = (clientY - rect.top) * (CELL_SIZE / rect.height);
      brushStroke(x, y);
    },
    resetLastPoint() {
      lastPoint.current = null;
    },
  }), [brushStroke, disabled]);

  const prize = PRIZE_DATA[prizeKey] || PRIZE_DATA["nada"];

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl aspect-square select-none"
      style={{
        border: isMatched
          ? "2px solid hsl(45 100% 55%)"
          : revealed
            ? `1px solid ${prize.color}30`
            : "1px solid hsl(270 30% 30% / 0.4)",
        boxShadow: isMatched
          ? `0 0 20px ${prize.glow}, 0 0 40px ${prize.glow}`
          : "none",
      }}
      animate={
        isMatched
          ? { scale: [1, 1.12, 1.05], boxShadow: [`0 0 0px transparent`, `0 0 30px ${prize.glow}`, `0 0 15px ${prize.glow}`] }
          : {}
      }
      transition={{ duration: 0.8, repeat: isMatched ? 3 : 0, ease: "easeInOut" }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
        style={{
          background: isMatched
            ? `radial-gradient(circle at center, ${prize.color}15, hsl(220 20% 6%))`
            : "linear-gradient(135deg, hsl(220 20% 8%), hsl(220 15% 5%))",
        }}
      >
        <motion.span
          className="text-2xl sm:text-3xl leading-none"
          animate={isMatched ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
          transition={{ duration: 0.6, repeat: isMatched ? 2 : 0 }}
        >
          {prize.emoji}
        </motion.span>
        <span className="text-[8px] sm:text-[10px] font-extrabold leading-tight" style={{ color: prize.color }}>
          {prize.label}
        </span>
      </div>

      {!revealed && (
        <canvas
          ref={canvasRef}
          width={CELL_SIZE}
          height={CELL_SIZE}
          className="relative z-10 w-full h-full"
          style={{ touchAction: "none", pointerEvents: "none" }}
        />
      )}
    </motion.div>
  );
});
ScratchCell.displayName = "ScratchCell";

// ═══════════════════════════════════════════════
// LUCK BAR COMPONENT
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
              background:
                i <= level
                  ? `hsl(${90 + i * 15} 80% ${45 + i * 2}%)`
                  : "hsl(220 15% 18%)",
              boxShadow:
                i <= level
                  ? `0 0 6px hsl(${90 + i * 15} 80% 50% / 0.6)`
                  : "none",
            }}
          />
        ))}
      </div>
      <span className="text-xs">{labels[level]}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════
// NEAR-MISS INDICATOR
// ═══════════════════════════════════════════════
function NearMissIndicator({ grid, revealedCells }: { grid: string[]; revealedCells: boolean[] }) {
  const counts: Record<string, number> = {};
  revealedCells.forEach((r, i) => {
    if (r) {
      const key = grid[i];
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const bestCount = Math.max(0, ...Object.values(counts).filter((c) => c < 3));
  const revealedCount = revealedCells.filter(Boolean).length;

  if (revealedCount < 2 || bestCount < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-1"
    >
      <motion.p
        className="text-xs font-bold"
        style={{ color: "hsl(45 100% 55%)" }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        🔥 Quase lá! 2 iguais encontrados!
      </motion.p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════
// MAIN SCRATCH CARD PAGE
// ═══════════════════════════════════════════════
const ScratchCardPage = () => {
  const { user, refreshProfile } = useAuth();
  const [muted, setMutedLocal] = useState(false);
  const queryClient = useQueryClient();
  const hasRestoredRef = useRef(false);
  const isPointerDown = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);
  const cellRefs = useRef<(ScratchCellHandle | null)[]>(Array(10).fill(null));

  // Scratch all cells at pointer position (only the one containing the point will respond)
  const scratchAllAtPoint = useCallback((clientX: number, clientY: number) => {
    cellRefs.current.forEach((ref) => ref?.scratchAt(clientX, clientY));
  }, []);

  // Game state
  const [gameState, setGameState] = useState<"idle" | "scratching" | "finished">("idle");
  const [grid, setGrid] = useState<string[]>([]);
  const [revealedCells, setRevealedCells] = useState<boolean[]>(Array(10).fill(false));
  const [matchedCells, setMatchedCells] = useState<number[]>([]);
  const [backendResult, setBackendResult] = useState<any>(null);
  const [wonPrizeKey, setWonPrizeKey] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);

  const userCredits = (user as any)?.credits || 0;
  const userLevel = (user as any)?.user_level || "bronze";
  const isVip = (user as any)?.vip_badge || false;

  // ── Restore saved game on mount ──
  useEffect(() => {
    if (!user?.id || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const saved = loadGameState(user.id);
    if (saved && saved.grid.length === 10) {
      setGrid(saved.grid);
      setRevealedCells(saved.revealedCells);
      setMatchedCells(saved.matchedCells);
      setBackendResult(saved.backendResult);
      setWonPrizeKey(saved.wonPrizeKey);
      setGameState(saved.gameState);
      setGameFinished(saved.gameFinished);
      setShowResult(saved.showResult);
    }
  }, [user?.id]);

  // ── Save game state whenever it changes ──
  useEffect(() => {
    if (!user?.id || gameState === "idle" || grid.length === 0) return;
    saveGameState({
      grid,
      revealedCells,
      matchedCells,
      backendResult,
      wonPrizeKey,
      gameState,
      gameFinished,
      showResult,
      userId: user.id,
      timestamp: Date.now(),
    });
  }, [grid, revealedCells, matchedCells, backendResult, wonPrizeKey, gameState, gameFinished, showResult, user?.id]);

  // ── Queries ──
  const { data: scratchChallenge } = useQuery({
    queryKey: ["scratch-challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_challenges")
        .select("*")
        .eq("challenge_type", "scratch_card")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: recentResults = [] } = useQuery({
    queryKey: ["scratch-results"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_attempts")
        .select("*, credit_challenges(name, icon)")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []).filter(
        (a: any) =>
          a.credit_challenges?.name === "Raspadinha" ||
          a.metadata?.challenge_type === "scratch_card"
      );
    },
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["scratch-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_attempts")
        .select("credits_spent, credits_won, metadata")
        .eq("user_id", user?.id);
      const scratches = (data || []).filter(
        (a: any) => a.metadata?.challenge_type === "scratch_card"
      );
      return {
        total: scratches.length,
        totalWon: scratches.reduce((s, a) => s + a.credits_won, 0),
        totalBalanceWon: scratches.reduce(
          (s, a: any) => s + (a.metadata?.balance_won || 0),
          0
        ),
        totalSpent: scratches.reduce((s, a) => s + a.credits_spent, 0),
      };
    },
    enabled: !!user?.id,
  });

  const { data: streakData } = useQuery({
    queryKey: ["scratch-streak"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_attempts")
        .select("created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!data || data.length === 0) return { streak: 0 };
      let streak = 0;
      const today = new Date();
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

  // ── Play mutation ──
  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!scratchChallenge) throw new Error("Raspadinha não disponível");
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: {
          action: "play_challenge",
          data: { challenge_id: scratchChallenge.id },
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      sfx.start();
      setBackendResult(data);
      setWonPrizeKey(data.prize_key !== "nada" ? data.prize_key : null);
      setGrid(data.grid || []);
      setRevealedCells(Array(10).fill(false));
      setMatchedCells([]);
      setShowResult(false);
      setShowConfetti(false);
      setGameFinished(false);
      setGameState("scratching");

      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["scratch-results"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-streak"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Cell reveal handler ──
  const handleCellReveal = useCallback(
    (index: number) => {
      if (gameFinished) return;
      sfx.cellReveal();

      setRevealedCells((prev) => {
        const next = [...prev];
        next[index] = true;
        return next;
      });

      // Process match logic outside of the state updater
      setRevealedCells((current) => {
        const revealedCount = current.filter(Boolean).length;

        const counts: Record<string, number[]> = {};
        current.forEach((r, i) => {
          if (r) {
            const key = grid[i];
            if (!counts[key]) counts[key] = [];
            counts[key].push(i);
          }
        });

        let foundMatch = false;
        let matchIndices: number[] = [];
        for (const [, indices] of Object.entries(counts)) {
          if (indices.length >= 3) {
            foundMatch = true;
            matchIndices = indices.slice(0, 3);
            break;
          }
        }

        if (foundMatch) {
          setMatchedCells(matchIndices);
          setGameFinished(true);
          sfx.match();
          setTimeout(async () => {
            setRevealedCells(Array(10).fill(true));
            setGameState("finished");
            setShowResult(true);
            clearGameState();
            await refreshProfile();
            if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
            if (wonPrizeKey) {
              sfx.celebrate();
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 4000);
            } else {
              sfx.lose();
            }
          }, 800);
        } else if (revealedCount >= 10) {
          setGameFinished(true);
          setTimeout(async () => {
            sfx.lose();
            setGameState("finished");
            setShowResult(true);
            clearGameState();
            await refreshProfile();
            if (navigator.vibrate) navigator.vibrate(30);
          }, 500);
        }

        return current; // don't modify, just read
      });
    },
    [grid, wonPrizeKey, backendResult, gameFinished, refreshProfile]
  );


  // ── Derived values ──
  const cost = scratchChallenge?.cost_credits || 1;
  const canBuy = userCredits >= cost;
  const revealedCount = revealedCells.filter(Boolean).length;
  const progressPct = grid.length > 0 ? (revealedCount / 10) * 100 : 0;

  const levelColors: Record<string, string> = {
    bronze: "from-amber-800 to-amber-600",
    prata: "from-gray-400 to-gray-200",
    ouro: "from-yellow-500 to-yellow-300",
    diamante: "from-cyan-400 to-blue-400",
  };

  return (
    <AppLayout>
      <ConfettiEffect active={showConfetti} />

      {/* ── Header ── */}
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
                background: "linear-gradient(135deg, hsl(280 70% 50%), hsl(200 100% 55%))",
                boxShadow: "0 0 20px hsl(280 70% 50% / 0.5)",
              }}
            >
              <Ticket size={20} className="text-primary-foreground" />
            </div>
            Raspadinha
          </motion.h1>
          <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Encontre 3 iguais e ganhe o prêmio! 🎰
          </p>
        </div>
        <button onClick={() => { setMutedLocal(!muted); setSfxMuted(!muted); }} className="rounded-full bg-muted/50 p-2 text-muted-foreground hover:text-foreground transition-colors">
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { icon: Diamond, label: "Créditos", value: `${userCredits}`, color: "hsl(var(--primary))" },
          { icon: Flame, label: "Streak", value: `${streakData?.streak || 0}🔥`, color: "hsl(30 100% 55%)" },
          { icon: Trophy, label: "Ganhos💎", value: `${stats?.totalWon || 0}`, color: "hsl(145 70% 45%)" },
          { icon: TrendingUp, label: "Ganhos💰", value: `R$${(stats?.totalBalanceWon || 0).toFixed(0)}`, color: "hsl(45 100% 50%)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-2 text-center"
            style={{
              background: "hsl(var(--card) / 0.6)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <s.icon size={14} style={{ color: s.color }} className="mx-auto" />
            <p className="text-[9px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</p>
            <p className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-md">
        {/* ── Level & Luck ── */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 rounded-full bg-gradient-to-r ${levelColors[userLevel] || levelColors.bronze} px-2.5 py-1`}
            >
              <Crown size={11} className="text-white" />
              <span className="text-[10px] font-bold text-white capitalize">
                {userLevel}
              </span>
            </div>
            {isVip && (
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(45 100% 40%), hsl(30 100% 40%))",
                }}
              >
                <Star size={9} className="text-white" />
                <span className="text-[9px] font-bold text-white">VIP</span>
              </div>
            )}
          </div>
          <LuckBar gamesPlayed={stats?.total || 0} />
        </div>

        {/* ═══ MAIN GAME CARD ═══ */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background:
              "linear-gradient(160deg, hsl(250 25% 10%), hsl(220 20% 7%))",
            border: "1px solid hsl(260 30% 22% / 0.6)",
            boxShadow:
              "0 0 40px hsl(260 40% 15% / 0.4), inset 0 1px 0 hsl(260 30% 30% / 0.15)",
          }}
        >
          {/* Card Header */}
          <div
            className="px-4 py-3 text-center"
            style={{
              background:
                "linear-gradient(90deg, hsl(280 60% 20% / 0.5), hsl(200 60% 20% / 0.5))",
              borderBottom: "1px solid hsl(260 30% 25% / 0.4)",
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles size={14} style={{ color: "hsl(45 100% 60%)" }} />
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "hsl(45 100% 60%)" }}
              >
                Raspe & Ganhe
              </span>
              <Sparkles size={14} style={{ color: "hsl(45 100% 60%)" }} />
            </div>
            <p
              className="text-[10px]"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {gameState === "idle"
                ? "Compre para começar a raspar!"
                : gameState === "scratching"
                  ? `Raspe todos os campos! (${revealedCount}/10)`
                  : "Jogo finalizado!"}
            </p>

            {gameState === "scratching" && (
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(220 15% 15%)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, hsl(280 70% 55%), hsl(200 100% 55%))",
                  }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4">
            {/* Prize Legend */}
            <div className="mb-3 flex flex-wrap justify-center gap-1">
              {["r1", "r5", "c1", "c3", "r30", "r50", "r100", "r500", "r1000"].map((k) => {
                const p = PRIZE_DATA[k];
                return (
                  <span
                    key={k}
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                    style={{
                      background: `${p.color}15`,
                      color: p.color,
                      border: `1px solid ${p.color}30`,
                    }}
                  >
                    {p.emoji} {p.label}
                  </span>
                );
              })}
            </div>

            {/* ── GRID ── */}
            {gameState !== "idle" && grid.length === 10 ? (
              <>
                <div
                  ref={gridRef}
                  className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3"
                  style={{ touchAction: "none", userSelect: "none" }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    isPointerDown.current = true;
                    // Reset lastPoint on all cells so first touch doesn't draw line from old position
                    cellRefs.current.forEach((ref) => ref?.resetLastPoint());
                    scratchAllAtPoint(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) => {
                    if (!isPointerDown.current) return;
                    e.preventDefault();
                    scratchAllAtPoint(e.clientX, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    isPointerDown.current = false;
                    cellRefs.current.forEach((ref) => ref?.resetLastPoint());
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={(e) => {
                    isPointerDown.current = false;
                    cellRefs.current.forEach((ref) => ref?.resetLastPoint());
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                >
                  {grid.map((prizeKey, i) => (
                    <ScratchCell
                      key={`cell-${i}-${grid.join("")}`}
                      ref={(el) => { cellRefs.current[i] = el; }}
                      prizeKey={prizeKey}
                      index={i}
                      revealed={revealedCells[i]}
                      isMatched={matchedCells.includes(i)}
                      onReveal={handleCellReveal}
                      disabled={gameFinished}
                    />
                  ))}
                </div>

                {gameState === "scratching" && !gameFinished && (
                  <NearMissIndicator
                    grid={grid}
                    revealedCells={revealedCells}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-10">
                <motion.div
                  className="text-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-6xl block mb-2">🎰</span>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    Compre uma raspadinha!
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}
                  >
                    Custo: {cost} 💎
                  </p>
                </motion.div>
              </div>
            )}

            {/* ── Result Panel ── */}
            <AnimatePresence>
              {showResult && backendResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="mb-4 rounded-xl p-5 text-center"
                  style={{
                    background: wonPrizeKey
                      ? `radial-gradient(circle at center, ${PRIZE_DATA[wonPrizeKey]?.glow || "transparent"}, hsl(45 30% 5%))`
                      : "hsl(var(--muted) / 0.2)",
                    border: `1px solid ${
                      wonPrizeKey
                        ? `${PRIZE_DATA[wonPrizeKey]?.color}50`
                        : "hsl(var(--border))"
                    }`,
                    boxShadow: wonPrizeKey
                      ? `0 0 30px ${PRIZE_DATA[wonPrizeKey]?.glow}`
                      : "none",
                  }}
                >
                  {wonPrizeKey ? (
                    <>
                      <motion.p
                        className="text-5xl mb-2"
                        animate={{
                          scale: [1, 1.4, 1.1],
                          rotate: [0, 15, -15, 0],
                        }}
                        transition={{ duration: 0.8 }}
                      >
                        🎉
                      </motion.p>
                      <motion.p
                        className="font-bold text-xl"
                        style={{ color: PRIZE_DATA[wonPrizeKey]?.color }}
                        animate={{
                          textShadow: [
                            `0 0 0px transparent`,
                            `0 0 20px ${PRIZE_DATA[wonPrizeKey]?.glow}`,
                            `0 0 8px ${PRIZE_DATA[wonPrizeKey]?.glow}`,
                          ],
                        }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                      >
                        3 IGUAIS! {PRIZE_DATA[wonPrizeKey]?.emoji}
                      </motion.p>
                      <p
                        className="text-base font-bold mt-1"
                        style={{ color: "hsl(145 70% 55%)" }}
                      >
                        {backendResult.reward_type === "balance"
                          ? `💰 +R$ ${Number(backendResult.balance_won).toFixed(2)}`
                          : `💎 +${backendResult.credits_won} créditos`}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        {backendResult.reward_type === "balance"
                          ? "Adicionado ao seu saldo real!"
                          : "Créditos adicionados!"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-4xl mb-2">😢</p>
                      <p
                        className="font-bold text-base"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        Não foi dessa vez...
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "hsl(var(--muted-foreground) / 0.7)" }}
                      >
                        Continue tentando! A sorte pode mudar! 🍀
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Buy / Play Again Button ── */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                clearGameState();
                setGameState("idle");
                setGrid([]);
                setShowResult(false);
                setMatchedCells([]);
                setShowConfetti(false);
                setGameFinished(false);
                buyMutation.mutate();
              }}
              disabled={
                !canBuy || buyMutation.isPending || gameState === "scratching"
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:
                  canBuy && gameState !== "scratching"
                    ? "linear-gradient(135deg, hsl(280 70% 50%), hsl(200 100% 55%))"
                    : "hsl(var(--muted))",
                color: "white",
                boxShadow:
                  canBuy && gameState !== "scratching"
                    ? "0 4px 20px hsl(280 70% 50% / 0.4), 0 0 40px hsl(200 100% 55% / 0.15)"
                    : "none",
              }}
            >
              {buyMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <RotateCcw size={16} />
                  {gameState === "scratching"
                    ? "Raspando..."
                    : gameState === "finished"
                      ? `Jogar Novamente (${cost} 💎)`
                      : `Comprar Raspadinha (${cost} 💎)`}
                </>
              )}
            </motion.button>

            {!canBuy && gameState !== "scratching" && (
              <p
                className="mt-2 text-center text-xs"
                style={{ color: "hsl(var(--destructive))" }}
              >
                Créditos insuficientes. Mínimo: {cost} 💎
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Streak ── */}
        {(streakData?.streak || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 rounded-xl p-3 text-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(30 50% 10%), hsl(15 50% 8%))",
              border: "1px solid hsl(30 50% 25% / 0.3)",
            }}
          >
            <p
              className="text-xs font-bold"
              style={{ color: "hsl(30 100% 55%)" }}
            >
              🔥 {streakData?.streak} dia(s) seguidos jogando!
              {(streakData?.streak || 0) >= 7 && " 🎁 Bônus de streak!"}
            </p>
          </motion.div>
        )}

        {/* Security badge */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <Shield size={10} style={{ color: "hsl(var(--muted-foreground) / 0.5)" }} />
          <p
            className="text-[9px]"
            style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}
          >
            Resultado gerado no servidor • Antifraude ativo
          </p>
        </div>

        <p
          className="mt-1 mb-4 text-center text-[9px]"
          style={{ color: "hsl(var(--muted-foreground) / 0.4)" }}
        >
          ⚠️ Créditos são moeda interna promocional. Não é investimento.
        </p>
      </div>

      {/* ── Recent Results ── */}
      {recentResults.length > 0 && (
        <div className="mx-auto mt-4 max-w-md">
          <h2
            className="mb-3 text-sm font-bold uppercase tracking-wider"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Últimas Raspadinhas
          </h2>
          <div className="space-y-1.5">
            {recentResults.slice(0, 8).map((r: any) => {
              const isBalanceWin =
                r.metadata?.reward_type === "balance" &&
                r.metadata?.balance_won > 0;
              const isCreditWin = r.credits_won > 0;
              const pKey = r.metadata?.prize_key;
              const pData = pKey ? PRIZE_DATA[pKey] : null;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{
                    background: "hsl(var(--card) / 0.4)",
                    border: "1px solid hsl(var(--border) / 0.5)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {pData?.emoji || (isBalanceWin || isCreditWin ? "🏆" : "🎫")}
                    </span>
                    <div>
                      <p
                        className="text-xs font-medium"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        {pData?.label || "Raspadinha"}
                      </p>
                      <p
                        className="text-[9px]"
                        style={{
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-[9px]"
                      style={{
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      -{r.credits_spent} 💎
                    </p>
                    {isBalanceWin ? (
                      <p
                        className="text-sm font-bold"
                        style={{ color: "hsl(145 70% 55%)" }}
                      >
                        +R$ {Number(r.metadata.balance_won).toFixed(2)} 💰
                      </p>
                    ) : (
                      <p
                        className="text-xs font-bold"
                        style={{
                          color: isCreditWin
                            ? "hsl(210 100% 65%)"
                            : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {isCreditWin
                          ? `+${r.credits_won} 💎`
                          : "Sem prêmio"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ScratchCardPage;
