import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, Ticket, RotateCcw, Trophy, Flame, Star, TrendingUp, Zap, Crown, Gift } from "lucide-react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// ---- Prize definitions for display ----
const PRIZE_ICONS: Record<string, { emoji: string; color: string }> = {
  "nada": { emoji: "❌", color: "#666" },
  "r1": { emoji: "💰", color: "#4ade80" },
  "r5": { emoji: "💵", color: "#22c55e" },
  "c1": { emoji: "💎", color: "#60a5fa" },
  "c3": { emoji: "💎💎", color: "#3b82f6" },
  "r30": { emoji: "🤑", color: "#f59e0b" },
  "r50": { emoji: "💰🔥", color: "#f97316" },
  "r100": { emoji: "🏆", color: "#eab308" },
  "r500": { emoji: "👑", color: "#a855f7" },
  "r1000": { emoji: "🌟", color: "#ec4899" },
};

const ALL_PRIZE_KEYS = Object.keys(PRIZE_ICONS);

// Generate grid: if won, place 3 matching; if lost, no 3 matching
function generateGrid(wonPrizeKey: string | null): string[] {
  const grid: string[] = [];

  if (wonPrizeKey) {
    // Place 3 of the winning prize
    grid.push(wonPrizeKey, wonPrizeKey, wonPrizeKey);
    // Fill remaining 7 with random non-matching (no more than 2 of any)
    const others = ALL_PRIZE_KEYS.filter((k) => k !== wonPrizeKey);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      let pick: string;
      do {
        pick = others[Math.floor(Math.random() * others.length)];
      } while ((counts[pick] || 0) >= 2);
      counts[pick] = (counts[pick] || 0) + 1;
      grid.push(pick);
    }
  } else {
    // No 3 matching — max 2 of each
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      let pick: string;
      do {
        pick = ALL_PRIZE_KEYS[Math.floor(Math.random() * ALL_PRIZE_KEYS.length)];
      } while ((counts[pick] || 0) >= 2);
      counts[pick] = (counts[pick] || 0) + 1;
      grid.push(pick);
    }
  }

  // Shuffle
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

// Map backend result to prize key
function resultToPrizeKey(data: any): string | null {
  if (!data) return null;
  const totalWon = data.reward_type === "balance" ? data.balance_won : data.credits_won;
  if (totalWon <= 0) return null;

  if (data.reward_type === "balance") {
    const v = data.balance_won;
    if (v >= 1000) return "r1000";
    if (v >= 500) return "r500";
    if (v >= 100) return "r100";
    if (v >= 50) return "r50";
    if (v >= 30) return "r30";
    if (v >= 5) return "r5";
    return "r1";
  } else {
    const v = data.credits_won;
    if (v >= 3) return "c3";
    return "c1";
  }
}

// Prize label for display
function prizeLabel(key: string): string {
  const map: Record<string, string> = {
    nada: "Nada",
    r1: "R$ 1",
    r5: "R$ 5",
    c1: "1 💎",
    c3: "3 💎",
    r30: "R$ 30",
    r50: "R$ 50",
    r100: "R$ 100",
    r500: "R$ 500",
    r1000: "R$ 1.000",
  };
  return map[key] || key;
}

// ---- Confetti ----
function ConfettiEffect({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.5,
        color: ["#FFD700", "#FF6B35", "#00D4FF", "#FF2D95", "#39FF14", "#FFE100"][Math.floor(Math.random() * 6)],
        size: 4 + Math.random() * 6,
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

// ---- Scratch Cell ----
function ScratchCell({
  prizeKey,
  index,
  revealed,
  isMatched,
  onReveal,
}: {
  prizeKey: string;
  index: number;
  revealed: boolean;
  isMatched: boolean;
  onReveal: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const cellRevealed = useRef(false);
  const scratched = useRef(0);
  const SIZE = 200; // internal canvas resolution

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    gradient.addColorStop(0, "#1a1a3e");
    gradient.addColorStop(0.5, "#2d1b69");
    gradient.addColorStop(1, "#1e3a5f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Shimmer dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${150 + Math.random() * 100}, ${100 + Math.random() * 155}, 255, ${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * SIZE, Math.random() * SIZE, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // "?" text
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#00d4ff";
    ctx.font = `bold 40px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", SIZE / 2, SIZE / 2);
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    cellRevealed.current = false;
    scratched.current = 0;
    initCanvas();
  }, [initCanvas, prizeKey]);

  const scratch = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas || cellRevealed.current) return;
      const ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "destination-out";
      const radius = 22 + Math.random() * 8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, 6 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (Math.random() > 0.6) {
        const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
        let cleared = 0;
        for (let i = 3; i < imageData.data.length; i += 16) {
          if (imageData.data[i] === 0) cleared++;
        }
        scratched.current = cleared / (SIZE * SIZE / 4);
      }

      if (scratched.current > 0.35 && !cellRevealed.current) {
        cellRevealed.current = true;
        ctx.clearRect(0, 0, SIZE, SIZE);
        onReveal(index);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    },
    [index, onReveal]
  );

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    scratch(getPos(e).x, getPos(e).y);
  };
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    scratch(getPos(e).x, getPos(e).y);
  };
  const handleEnd = () => { isDrawing.current = false; };

  const icon = PRIZE_ICONS[prizeKey] || PRIZE_ICONS["nada"];

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl aspect-square"
      style={{
        border: isMatched
          ? "2px solid hsl(45 100% 50%)"
          : revealed
          ? "1px solid hsl(220 15% 25%)"
          : "1px solid hsl(270 30% 25% / 0.5)",
        boxShadow: isMatched ? "0 0 15px hsl(45 100% 50% / 0.4)" : "none",
      }}
      animate={isMatched ? { scale: [1, 1.08, 1], boxShadow: ["0 0 0px transparent", "0 0 20px rgba(255,215,0,0.6)", "0 0 10px rgba(255,215,0,0.3)"] } : {}}
      transition={{ duration: 0.6, repeat: isMatched ? 2 : 0 }}
    >
      {/* Prize underneath */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          background: isMatched
            ? "linear-gradient(135deg, hsl(45 60% 12%), hsl(30 60% 8%))"
            : "linear-gradient(135deg, hsl(220 20% 10%), hsl(220 15% 7%))",
        }}
      >
        <span className="text-2xl sm:text-3xl">{icon.emoji}</span>
        <span className="text-[9px] sm:text-[10px] font-bold mt-0.5" style={{ color: icon.color }}>
          {prizeLabel(prizeKey)}
        </span>
      </div>

      {/* Canvas on top */}
      {!revealed && (
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="relative z-10 w-full h-full cursor-pointer touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      )}
    </motion.div>
  );
}

// ---- Luck Indicator ----
function LuckIndicator({ gamesPlayed }: { gamesPlayed: number }) {
  const luckLevel = Math.min(gamesPlayed % 10, 9);
  const labels = ["Baixa", "Baixa", "Normal", "Normal", "Boa", "Boa", "Alta", "Alta", "Máxima!", "SORTE!"];
  const colors = ["text-red-400", "text-red-400", "text-muted-foreground", "text-muted-foreground", "text-yellow-400", "text-yellow-400", "text-green-400", "text-green-400", "text-cyan-400", "text-primary"];
  return (
    <div className="flex items-center gap-2">
      <Zap size={14} className={colors[luckLevel]} />
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-2 w-1.5 rounded-full transition-all duration-300"
            style={{
              background: i <= luckLevel ? `hsl(${120 + i * 20} 80% 50%)` : "hsl(220 15% 20%)",
              boxShadow: i <= luckLevel ? `0 0 4px hsl(${120 + i * 20} 80% 50% / 0.5)` : "none",
            }}
          />
        ))}
      </div>
      <span className={`text-xs font-bold ${colors[luckLevel]}`}>{labels[luckLevel]}</span>
    </div>
  );
}

// ---- Main Page ----
const ScratchCardPage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  // Game state
  const [gameState, setGameState] = useState<"idle" | "scratching" | "finished">("idle");
  const [grid, setGrid] = useState<string[]>([]);
  const [revealedCells, setRevealedCells] = useState<boolean[]>(Array(10).fill(false));
  const [matchedCells, setMatchedCells] = useState<number[]>([]);
  const [backendResult, setBackendResult] = useState<any>(null);
  const [wonPrizeKey, setWonPrizeKey] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const userCredits = (user as any)?.credits || 0;

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
        (a: any) => a.credit_challenges?.name === "Raspadinha" || a.metadata?.challenge_type === "scratch_card"
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
      const scratches = (data || []).filter((a: any) => a.metadata?.challenge_type === "scratch_card");
      const totalBalanceWon = scratches.reduce((s, a: any) => s + (a.metadata?.balance_won || 0), 0);
      return {
        total: scratches.length,
        totalWon: scratches.reduce((s, a) => s + a.credits_won, 0),
        totalBalanceWon,
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
        const hasPlay = data.some((a: any) => a.created_at.slice(0, 10) === dateStr);
        if (hasPlay) streak++;
        else if (i > 0) break;
      }
      return { streak };
    },
    enabled: !!user?.id,
  });

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!scratchChallenge) throw new Error("Raspadinha não disponível");
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "play_challenge", data: { challenge_id: scratchChallenge.id } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setBackendResult(data);
      const prizeKey = resultToPrizeKey(data);
      setWonPrizeKey(prizeKey);
      const newGrid = generateGrid(prizeKey);
      setGrid(newGrid);
      setRevealedCells(Array(10).fill(false));
      setMatchedCells([]);
      setShowResult(false);
      setGameState("scratching");

      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["scratch-results"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-streak"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Check for 3 matching when cells are revealed
  const handleCellReveal = useCallback(
    (index: number) => {
      setRevealedCells((prev) => {
        const next = [...prev];
        next[index] = true;

        // Check if all revealed or if 3 matching found
        const revealedCount = next.filter(Boolean).length;

        // Count revealed items
        const counts: Record<string, number[]> = {};
        next.forEach((r, i) => {
          if (r) {
            const key = grid[i];
            if (!counts[key]) counts[key] = [];
            counts[key].push(i);
          }
        });

        // Check for 3 matching
        let foundMatch = false;
        for (const [, indices] of Object.entries(counts)) {
          if (indices.length >= 3) {
            foundMatch = true;
            setMatchedCells(indices.slice(0, 3));
            break;
          }
        }

        if (foundMatch || revealedCount >= 10) {
          // End game after a short delay
          setTimeout(() => {
            // Reveal all remaining
            setRevealedCells(Array(10).fill(true));
            setGameState("finished");
            setShowResult(true);

            if (navigator.vibrate) navigator.vibrate([50, 30, 100]);

            if (wonPrizeKey && foundMatch) {
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
              const bData = backendResult;
              const prizeText =
                bData?.reward_type === "balance"
                  ? `R$ ${Number(bData.balance_won).toFixed(2)} em saldo!`
                  : `${bData?.credits_won} créditos!`;
              toast({ title: `🏆 Você ganhou ${prizeText}`, description: "3 iguais encontrados!" });
            }
          }, 600);
        }

        return next;
      });
    },
    [grid, wonPrizeKey, backendResult]
  );

  const cost = scratchChallenge?.cost_credits || 3;
  const canBuy = userCredits >= cost;

  const levelBadge = (user as any)?.user_level || "bronze";
  const levelColors: Record<string, string> = {
    bronze: "from-amber-800 to-amber-600",
    prata: "from-gray-400 to-gray-300",
    ouro: "from-yellow-500 to-yellow-300",
    diamante: "from-cyan-400 to-blue-400",
  };

  return (
    <AppLayout>
      <ConfettiEffect active={showConfetti} />

      {/* Header */}
      <div className="mb-4">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-2xl font-bold"
          style={{ color: "hsl(var(--foreground))" }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, hsl(270 60% 50%), hsl(210 100% 55%))",
              boxShadow: "0 0 15px hsl(270 60% 50% / 0.4)",
            }}
          >
            <Ticket size={20} className="text-white" />
          </div>
          Raspadinha
        </motion.h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          Encontre 3 iguais e ganhe o prêmio! 🎰
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { icon: Diamond, label: "Créditos", value: userCredits, color: "hsl(var(--primary))" },
          { icon: Flame, label: "Streak", value: `${streakData?.streak || 0}🔥`, color: "hsl(30 100% 55%)" },
          { icon: Trophy, label: "💎", value: stats?.totalWon || 0, color: "hsl(145 70% 45%)" },
          { icon: TrendingUp, label: "💰", value: `R$${(stats?.totalBalanceWon || 0).toFixed(0)}`, color: "hsl(45 100% 50%)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-2 text-center" style={{ background: "hsl(var(--muted) / 0.3)", border: "1px solid hsl(var(--border))" }}>
            <s.icon size={14} style={{ color: s.color }} className="mx-auto" />
            <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</p>
            <p className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-md">
        {/* Level + Luck */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 rounded-full bg-gradient-to-r ${levelColors[levelBadge] || levelColors.bronze} px-2.5 py-1`}>
              <Crown size={12} className="text-white" />
              <span className="text-xs font-bold text-white capitalize">{levelBadge}</span>
            </div>
            {(user as any)?.vip_badge && (
              <div className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: "linear-gradient(135deg, hsl(45 100% 40%), hsl(30 100% 40%))" }}>
                <Star size={10} className="text-white" />
                <span className="text-[10px] font-bold text-white">VIP</span>
              </div>
            )}
          </div>
          <LuckIndicator gamesPlayed={stats?.total || 0} />
        </div>

        {/* Main Card Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(145deg, hsl(220 18% 10% / 0.9), hsl(270 20% 8% / 0.9))",
            border: "1px solid hsl(270 30% 25% / 0.5)",
            boxShadow: "0 0 30px hsl(270 40% 20% / 0.3), inset 0 1px 0 hsl(270 30% 30% / 0.2)",
          }}
        >
          {/* Instructions / Prize Legend */}
          <div className="mb-3 text-center">
            <p className="text-xs font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>
              {gameState === "idle"
                ? "🎰 Compre e raspe para encontrar 3 iguais!"
                : gameState === "scratching"
                ? "✨ Raspe todos os campos!"
                : ""}
            </p>
          </div>

          {/* Prize Legend */}
          <div className="mb-3 flex flex-wrap justify-center gap-1">
            {["r1", "r5", "c1", "c3", "r30", "r100"].map((k) => (
              <span
                key={k}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  background: k.startsWith("c") ? "hsl(210 40% 15%)" : "hsl(145 40% 15%)",
                  color: PRIZE_ICONS[k].color,
                  border: `1px solid ${k.startsWith("c") ? "hsl(210 40% 25%)" : "hsl(145 40% 25%)"}`,
                }}
              >
                {PRIZE_ICONS[k].emoji} {prizeLabel(k)}
              </span>
            ))}
          </div>

          {/* Grid */}
          {gameState !== "idle" && grid.length === 10 ? (
            <div className="grid grid-cols-5 gap-2 mb-4">
              {grid.map((prizeKey, i) => (
                <ScratchCell
                  key={`${i}-${prizeKey}`}
                  prizeKey={prizeKey}
                  index={i}
                  revealed={revealedCells[i]}
                  isMatched={matchedCells.includes(i)}
                  onReveal={handleCellReveal}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <span className="text-5xl">🎰</span>
                <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Compre uma raspadinha para jogar
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          <AnimatePresence>
            {showResult && backendResult && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-4 rounded-xl p-4 text-center"
                style={{
                  background: wonPrizeKey
                    ? "linear-gradient(135deg, hsl(45 60% 10%), hsl(30 60% 8%))"
                    : "hsl(var(--muted) / 0.3)",
                  border: `1px solid ${wonPrizeKey ? "hsl(45 60% 30% / 0.5)" : "hsl(var(--border))"}`,
                  boxShadow: wonPrizeKey ? "0 0 20px hsl(45 60% 30% / 0.2)" : "none",
                }}
              >
                {wonPrizeKey ? (
                  <>
                    <p className="text-3xl mb-1">🎉</p>
                    <p className="font-bold text-lg text-yellow-400">
                      3 iguais! {PRIZE_ICONS[wonPrizeKey]?.emoji}
                    </p>
                    <p className="text-sm mt-1" style={{ color: "hsl(145 70% 55%)" }}>
                      {backendResult.reward_type === "balance"
                        ? `💰 +R$ ${Number(backendResult.balance_won).toFixed(2)} no saldo!`
                        : `💎 +${backendResult.credits_won} créditos!`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-1">😢</p>
                    <p className="font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Não foi dessa vez...
                    </p>
                    <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Tente novamente! A sorte pode mudar! 🍀
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buy Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setGameState("idle");
              setGrid([]);
              setShowResult(false);
              setMatchedCells([]);
              setShowConfetti(false);
              buyMutation.mutate();
            }}
            disabled={!canBuy || buyMutation.isPending || gameState === "scratching"}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                canBuy && gameState !== "scratching"
                  ? "linear-gradient(135deg, hsl(270 60% 50%), hsl(210 100% 55%))"
                  : "hsl(var(--muted))",
              color: "white",
              boxShadow: canBuy && gameState !== "scratching" ? "0 0 25px hsl(270 60% 50% / 0.4)" : "none",
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
                  ? `Nova Raspadinha (${cost} 💎)`
                  : `Comprar Raspadinha (${cost} 💎)`}
              </>
            )}
          </motion.button>

          {!canBuy && (
            <p className="mt-2 text-center text-xs" style={{ color: "hsl(var(--destructive))" }}>
              Créditos insuficientes. Mínimo: {cost} 💎
            </p>
          )}
        </motion.div>

        {/* Streak */}
        {(streakData?.streak || 0) > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-xl p-3 text-center" style={{ background: "linear-gradient(135deg, hsl(30 60% 10%), hsl(15 60% 8%))", border: "1px solid hsl(30 60% 25% / 0.3)" }}>
            <p className="text-xs font-bold" style={{ color: "hsl(30 100% 55%)" }}>
              🔥 {streakData?.streak} dia(s) seguidos jogando!
              {(streakData?.streak || 0) >= 7 && " 🎁 Bônus de streak ativo!"}
            </p>
          </motion.div>
        )}

        <p className="mt-3 text-center text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
          ⚠️ Créditos são moeda interna. Recompensas são promocionais. Não é investimento.
        </p>
      </div>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="mx-auto mt-6 max-w-md">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: "hsl(var(--foreground))" }}>
            Últimas Raspadinhas
          </h2>
          <div className="space-y-2">
            {recentResults.slice(0, 10).map((r: any) => {
              const isBalanceWin = r.metadata?.reward_type === "balance" && r.metadata?.balance_won > 0;
              const isCreditWin = r.credits_won > 0;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: "hsl(var(--muted) / 0.2)", border: "1px solid hsl(var(--border))" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isBalanceWin || isCreditWin ? "🏆" : "🎫"}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>Raspadinha</p>
                      <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>-{r.credits_spent} 💎</p>
                    {isBalanceWin ? (
                      <p className="text-sm font-bold" style={{ color: "hsl(145 70% 55%)" }}>+R$ {Number(r.metadata.balance_won).toFixed(2)} 💰</p>
                    ) : (
                      <p className="text-sm font-bold" style={{ color: isCreditWin ? "hsl(145 70% 55%)" : "hsl(var(--muted-foreground))" }}>
                        {isCreditWin ? `+${r.credits_won} 💎` : "Sem prêmio"}
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
