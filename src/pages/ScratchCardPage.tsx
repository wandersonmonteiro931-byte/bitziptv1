import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, Ticket, RotateCcw, Trophy, Flame, Star, TrendingUp, Zap, Crown, Gift } from "lucide-react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// ---- Confetti Particle System ----
function ConfettiEffect({ active }: { active: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      color: ['#FFD700', '#FF6B35', '#00D4FF', '#FF2D95', '#39FF14', '#FFE100'][Math.floor(Math.random() * 6)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    })), []
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: p.rotation + 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          className="absolute"
          style={{
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: '2px',
          }}
        />
      ))}
    </div>
  );
}

// ---- Scratch Particle Sparks ----
function ScratchParticles({ particles }: { particles: Array<{ id: number; x: number; y: number }> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
            animate={{
              x: p.x + (Math.random() - 0.5) * 60,
              y: p.y + (Math.random() - 0.5) * 60,
              scale: 0,
              opacity: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              background: ['#FFD700', '#00D4FF', '#FF6B35', '#39FF14'][Math.floor(Math.random() * 4)],
              boxShadow: '0 0 6px currentColor',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---- Scratch Canvas Component ----
function ScratchCard({
  width,
  height,
  prize,
  onComplete,
  onScratchProgress,
}: {
  width: number;
  height: number;
  prize: { won: number; label: string; rewardType?: string; balanceWon?: number } | null;
  onComplete: () => void;
  onScratchProgress?: (x: number, y: number, pct: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const scratched = useRef(0);
  const revealed = useRef(false);
  const [revealedState, setRevealedState] = useState(false);
  const [scratchPct, setScratchPct] = useState(0);
  const totalPixels = width * height;

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";

    // Create neon gradient scratch layer
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1a3e");
    gradient.addColorStop(0.3, "#2d1b69");
    gradient.addColorStop(0.5, "#1e3a5f");
    gradient.addColorStop(0.7, "#2d1b69");
    gradient.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Shimmer overlay
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const alpha = Math.random() * 0.3;
      ctx.fillStyle = `rgba(${150 + Math.random() * 100}, ${100 + Math.random() * 155}, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Diamond pattern
    ctx.strokeStyle = "rgba(100, 200, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < width + height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(0, i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width - i, 0);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // "RASPE AQUI" text with glow
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#00d4ff";
    ctx.font = `bold ${Math.min(width / 8, 22)}px 'Orbitron', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✨ RASPE AQUI ✨", width / 2, height / 2);
    ctx.shadowBlur = 0;

    // Decorative corners
    ctx.fillStyle = "rgba(255, 215, 0, 0.4)";
    ctx.font = "18px sans-serif";
    ctx.fillText("💎", width * 0.12, height * 0.2);
    ctx.fillText("💎", width * 0.88, height * 0.2);
    ctx.fillText("⭐", width * 0.12, height * 0.8);
    ctx.fillText("⭐", width * 0.88, height * 0.8);

    // Neon border
    ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 10;
    ctx.strokeRect(4, 4, width - 8, height - 8);
    ctx.shadowBlur = 0;
  }, [width, height]);

  useEffect(() => {
    revealed.current = false;
    scratched.current = 0;
    setRevealedState(false);
    setScratchPct(0);
    initCanvas();
  }, [prize, initCanvas]);

  const scratch = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas || revealed.current) return;
      const ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "destination-out";

      // Variable brush for more realistic scratch
      const radius = 18 + Math.random() * 8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Additional smaller circles for texture
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, 5 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Check scratch percentage (throttled)
      if (Math.random() > 0.7) {
        const imageData = ctx.getImageData(0, 0, width, height);
        let cleared = 0;
        for (let i = 3; i < imageData.data.length; i += 16) {
          if (imageData.data[i] === 0) cleared++;
        }
        const pct = cleared / (totalPixels / 4);
        scratched.current = pct;
        setScratchPct(Math.min(pct * 100, 100));
        onScratchProgress?.(x, y, pct);
      }

      if (scratched.current > 0.4 && !revealed.current) {
        revealed.current = true;
        ctx.clearRect(0, 0, width, height);
        setRevealedState(true);
        setScratchPct(100);
        onComplete();
      }
    },
    [width, height, totalPixels, onComplete, onScratchProgress]
  );

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    scratch(pos.x, pos.y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const pos = getPos(e);
    scratch(pos.x, pos.y);
  };

  const handleEnd = () => {
    isDrawing.current = false;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ width: "100%", maxWidth: width }}>
      {/* Prize layer underneath */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
        style={{
          background: prize && prize.won > 0
            ? "linear-gradient(135deg, hsl(45 100% 8%), hsl(30 100% 5%))"
            : "linear-gradient(135deg, hsl(220 30% 8%), hsl(220 20% 5%))",
          border: prize && prize.won > 0
            ? "2px solid hsl(45 100% 40% / 0.5)"
            : "1px solid hsl(220 15% 20%)",
        }}
      >
        {prize ? (
          <>
            <motion.span
              className="text-6xl mb-2"
              animate={revealedState ? {
                scale: [1, 1.6, 1.2],
                rotate: [0, 15, -15, 0],
                filter: ['brightness(1)', 'brightness(2)', 'brightness(1.3)']
              } : {}}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {prize.won > 0 ? "🏆" : "😢"}
            </motion.span>
            <motion.p
              className={`font-display text-3xl font-bold ${
                prize.won > 0 ? "text-yellow-400" : "text-muted-foreground"
              }`}
              animate={revealedState && prize.won > 0 ? {
                scale: [0.5, 1.2, 1],
                textShadow: ['0 0 0px transparent', '0 0 30px rgba(255,215,0,0.8)', '0 0 10px rgba(255,215,0,0.4)']
              } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {prize.won > 0
                ? prize.rewardType === "balance"
                  ? `+R$ ${Number(prize.balanceWon).toFixed(2)}`
                  : `+${prize.won} 💎`
                : "Sem prêmio"}
            </motion.p>
            <motion.p
              className="text-sm mt-1"
              style={{ color: prize.won > 0 ? 'hsl(45 80% 60%)' : 'hsl(220 15% 45%)' }}
              initial={{ opacity: 0 }}
              animate={revealedState ? { opacity: 1 } : {}}
              transition={{ delay: 0.4 }}
            >
              {prize.won > 0
                ? prize.rewardType === "balance" ? "💰 Saldo Real!" : "Créditos ganhos!"
                : "Tente novamente!"}
            </motion.p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm animate-pulse">Compre para jogar</p>
        )}
      </div>

      {/* Progress bar */}
      {!revealedState && prize && (
        <div className="absolute bottom-2 left-4 right-4 z-30">
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #00d4ff, #39ff14)' }}
              animate={{ width: `${scratchPct}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      )}

      {/* Scratch canvas on top */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="relative z-10 w-full cursor-pointer touch-none"
        style={{ aspectRatio: `${width}/${height}` }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}

// ---- Luck Indicator ----
function LuckIndicator({ gamesPlayed }: { gamesPlayed: number }) {
  const luckLevel = Math.min(gamesPlayed % 10, 9);
  const labels = ['Baixa', 'Baixa', 'Normal', 'Normal', 'Boa', 'Boa', 'Alta', 'Alta', 'Máxima!', 'SORTE!'];
  const colors = ['text-red-400', 'text-red-400', 'text-muted-foreground', 'text-muted-foreground', 'text-yellow-400', 'text-yellow-400', 'text-green-400', 'text-green-400', 'text-cyan-400', 'text-primary'];

  return (
    <div className="flex items-center gap-2">
      <Zap size={14} className={colors[luckLevel]} />
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-2 w-1.5 rounded-full transition-all duration-300"
            style={{
              background: i <= luckLevel
                ? `hsl(${120 + (i * 20)} 80% 50%)`
                : 'hsl(220 15% 20%)',
              boxShadow: i <= luckLevel ? `0 0 4px hsl(${120 + (i * 20)} 80% 50% / 0.5)` : 'none',
            }}
          />
        ))}
      </div>
      <span className={`text-xs font-bold ${colors[luckLevel]}`}>{labels[luckLevel]}</span>
    </div>
  );
}

// ---- Daily Free Card ----
function DailyFreeCard({ onClaim }: { onClaim: () => void }) {
  const [claimed, setClaimed] = useState(false);
  
  useEffect(() => {
    const lastClaim = localStorage.getItem('bitz_daily_scratch');
    const today = new Date().toDateString();
    setClaimed(lastClaim === today);
  }, []);

  const handleClaim = () => {
    localStorage.setItem('bitz_daily_scratch', new Date().toDateString());
    setClaimed(true);
    onClaim();
  };

  if (claimed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-4 rounded-xl p-3 text-center"
      style={{
        background: 'linear-gradient(135deg, hsl(270 60% 15%), hsl(210 60% 15%))',
        border: '1px solid hsl(270 60% 30% / 0.5)',
        boxShadow: '0 0 20px hsl(270 60% 30% / 0.2)',
      }}
    >
      <div className="flex items-center justify-center gap-2 mb-1">
        <Gift size={16} className="text-purple-400" />
        <span className="text-sm font-bold text-purple-300">Raspadinha Grátis Diária!</span>
      </div>
      <button
        onClick={handleClaim}
        className="mt-1 rounded-lg px-4 py-1.5 text-xs font-bold transition-all hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, hsl(270 60% 50%), hsl(210 60% 50%))',
          color: 'white',
          boxShadow: '0 0 15px hsl(270 60% 50% / 0.4)',
        }}
      >
        🎁 Resgatar Agora
      </button>
    </motion.div>
  );
}

// ---- Main Page ----
const ScratchCardPage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [currentPrize, setCurrentPrize] = useState<{ won: number; label: string; rewardType: string; balanceWon: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scratchParticles, setScratchParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const particleId = useRef(0);

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
        biggestWin: Math.max(0, ...scratches.map((a) => a.credits_won)),
        biggestBalanceWin: Math.max(0, ...scratches.map((a: any) => a.metadata?.balance_won || 0)),
      };
    },
    enabled: !!user?.id,
  });

  // Streak tracking
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
      const totalWon = data.reward_type === "balance" ? data.balance_won : data.credits_won;
      setCurrentPrize({
        won: totalWon,
        label: data.label,
        rewardType: data.reward_type,
        balanceWon: data.balance_won || 0,
      });
      setCardKey((k) => k + 1);
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["scratch-results"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-stats"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-streak"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const handleScratchProgress = useCallback((x: number, y: number, _pct: number) => {
    // Spawn scratch particles
    const newParticles = Array.from({ length: 3 }, () => ({
      id: particleId.current++,
      x: x * (320 / 340) + (Math.random() - 0.5) * 10,
      y: y * (220 / 240) + (Math.random() - 0.5) * 10,
    }));
    setScratchParticles((prev) => [...prev.slice(-20), ...newParticles]);

    // Vibrate on mobile
    if (navigator.vibrate && Math.random() > 0.8) {
      navigator.vibrate(5);
    }
  }, []);

  const handleReveal = useCallback(() => {
    setShowResult(true);

    // Vibrate on reveal
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 100]);
    }

    if (currentPrize && currentPrize.won > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      const prizeText =
        currentPrize.rewardType === "balance"
          ? `R$ ${Number(currentPrize.balanceWon).toFixed(2)} em saldo!`
          : `${currentPrize.won} créditos!`;
      toast({
        title: `🏆 Você ganhou ${prizeText}`,
        description: currentPrize.label,
      });
    }
  }, [currentPrize]);

  const handleDailyFree = () => {
    // Just play the challenge for free - using same mutation
    if (!scratchChallenge) return;
    buyMutation.mutate();
  };

  const cost = scratchChallenge?.cost_credits || 3;
  const canBuy = userCredits >= cost;
  const probabilities = (scratchChallenge?.probabilities || []) as Array<{
    result: number;
    weight: number;
    label: string;
    reward_type?: string;
  }>;

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
      <div className="mb-5">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-2xl font-bold"
          style={{ color: 'hsl(var(--foreground))' }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, hsl(270 60% 50%), hsl(210 100% 55%))',
              boxShadow: '0 0 15px hsl(270 60% 50% / 0.4)',
            }}
          >
            <Ticket size={20} className="text-white" />
          </div>
          Raspadinha
        </motion.h1>
        <p className="mt-1 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Raspe e descubra seu prêmio! 🎉
        </p>
      </div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { icon: Diamond, label: "Créditos", value: userCredits, color: "hsl(var(--primary))" },
          { icon: Flame, label: "Streak", value: `${streakData?.streak || 0}🔥`, color: "hsl(30 100% 55%)" },
          { icon: Trophy, label: "Ganhos 💎", value: stats?.totalWon || 0, color: "hsl(145 70% 45%)" },
          { icon: TrendingUp, label: "Ganhos 💰", value: `R$${(stats?.totalBalanceWon || 0).toFixed(0)}`, color: "hsl(45 100% 50%)" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="stat-card rounded-xl p-3 text-center"
          >
            <s.icon size={16} style={{ color: s.color }} className="mx-auto" />
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.label}</p>
            <p className="font-display text-lg font-bold" style={{ color: 'hsl(var(--foreground))' }}>{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Card Area */}
      <div className="mx-auto max-w-md">
        {/* Level + Luck Indicator */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 rounded-full bg-gradient-to-r ${levelColors[levelBadge] || levelColors.bronze} px-2.5 py-1`}
            >
              <Crown size={12} className="text-white" />
              <span className="text-xs font-bold text-white capitalize">{levelBadge}</span>
            </div>
            {(user as any)?.vip_badge && (
              <div className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: 'linear-gradient(135deg, hsl(45 100% 40%), hsl(30 100% 40%))' }}>
                <Star size={10} className="text-white" />
                <span className="text-[10px] font-bold text-white">VIP</span>
              </div>
            )}
          </div>
          <LuckIndicator gamesPlayed={stats?.total || 0} />
        </div>

        {/* Daily Free Card */}
        <DailyFreeCard onClaim={handleDailyFree} />

        {/* Main Scratch Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(145deg, hsl(220 18% 10% / 0.9), hsl(270 20% 8% / 0.9))',
            border: '1px solid hsl(270 30% 25% / 0.5)',
            boxShadow: '0 0 30px hsl(270 40% 20% / 0.3), inset 0 1px 0 hsl(270 30% 30% / 0.2)',
          }}
        >
          {/* Prize table */}
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Prêmios Possíveis
            </p>
            <div className="flex flex-wrap gap-1">
              {probabilities
                .filter((p) => p.result > 0)
                .sort((a, b) => b.result - a.result)
                .map((p, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background: p.reward_type === "balance"
                        ? 'hsl(145 40% 15%)'
                        : 'hsl(210 40% 15%)',
                      color: p.reward_type === "balance"
                        ? 'hsl(145 70% 55%)'
                        : 'hsl(210 100% 65%)',
                      border: `1px solid ${p.reward_type === "balance" ? 'hsl(145 40% 25%)' : 'hsl(210 40% 25%)'}`,
                    }}
                  >
                    {p.reward_type === "balance" ? "💰" : "💎"} {p.label}
                  </span>
                ))}
            </div>
          </div>

          {/* Scratch Card with particles */}
          <div className="relative flex justify-center mb-4">
            <ScratchParticles particles={scratchParticles} />
            <ScratchCard
              key={cardKey}
              width={340}
              height={220}
              prize={currentPrize}
              onComplete={handleReveal}
              onScratchProgress={handleScratchProgress}
            />
          </div>

          {/* Result Message */}
          <AnimatePresence>
            {showResult && currentPrize && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-4 rounded-xl p-4 text-center"
                style={{
                  background: currentPrize.won > 0
                    ? 'linear-gradient(135deg, hsl(45 60% 10%), hsl(30 60% 8%))'
                    : 'hsl(var(--muted) / 0.3)',
                  border: `1px solid ${currentPrize.won > 0 ? 'hsl(45 60% 30% / 0.5)' : 'hsl(var(--border))'}`,
                  boxShadow: currentPrize.won > 0 ? '0 0 20px hsl(45 60% 30% / 0.2)' : 'none',
                }}
              >
                <p className={`font-display text-lg font-bold ${currentPrize.won > 0 ? "text-yellow-400" : ""}`} style={{ color: currentPrize.won > 0 ? undefined : 'hsl(var(--muted-foreground))' }}>
                  {currentPrize.won > 0
                    ? currentPrize.rewardType === "balance"
                      ? `🎉 Você ganhou R$ ${Number(currentPrize.balanceWon).toFixed(2)}!`
                      : `🎉 Você ganhou ${currentPrize.won} créditos!`
                    : "😢 Sem prêmio desta vez"}
                </p>
                {currentPrize.rewardType === "balance" && currentPrize.won > 0 && (
                  <p className="text-sm mt-1" style={{ color: 'hsl(145 70% 55%)' }}>
                    💰 Adicionado ao seu saldo real!
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buy Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setCurrentPrize(null);
              setShowResult(false);
              setScratchParticles([]);
              buyMutation.mutate();
            }}
            disabled={!canBuy || buyMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canBuy
                ? 'linear-gradient(135deg, hsl(270 60% 50%), hsl(210 100% 55%))'
                : 'hsl(var(--muted))',
              color: 'white',
              boxShadow: canBuy ? '0 0 25px hsl(270 60% 50% / 0.4)' : 'none',
            }}
          >
            {buyMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <RotateCcw size={16} />
                {showResult || currentPrize
                  ? `Nova Raspadinha (${cost} 💎)`
                  : `Comprar Raspadinha (${cost} 💎)`}
              </>
            )}
          </motion.button>

          {!canBuy && (
            <p className="mt-2 text-center text-xs" style={{ color: 'hsl(var(--destructive))' }}>
              Créditos insuficientes. Mínimo: {cost} 💎
            </p>
          )}
        </motion.div>

        {/* Streak Indicator */}
        {(streakData?.streak || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 rounded-xl p-3 text-center"
            style={{
              background: 'linear-gradient(135deg, hsl(30 60% 10%), hsl(15 60% 8%))',
              border: '1px solid hsl(30 60% 25% / 0.3)',
            }}
          >
            <p className="text-xs font-bold" style={{ color: 'hsl(30 100% 55%)' }}>
              🔥 {streakData?.streak} dia(s) seguidos jogando!
              {(streakData?.streak || 0) >= 7 && " 🎁 Bônus de streak ativo!"}
            </p>
          </motion.div>
        )}

        {/* Disclaimer */}
        <p className="mt-3 text-center text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
          ⚠️ Créditos são moeda interna. Recompensas são promocionais. Não é investimento.
        </p>
      </div>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="mx-auto mt-6 max-w-md">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>
            Últimas Raspadinhas
          </h2>
          <div className="space-y-2">
            {recentResults.slice(0, 10).map((r: any) => {
              const isBalanceWin = r.metadata?.reward_type === "balance" && r.metadata?.balance_won > 0;
              const isCreditWin = r.credits_won > 0;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card flex items-center justify-between rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isBalanceWin || isCreditWin ? "🏆" : "🎫"}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                        Raspadinha
                      </p>
                      <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      -{r.credits_spent} 💎
                    </p>
                    {isBalanceWin ? (
                      <p className="text-sm font-bold" style={{ color: 'hsl(145 70% 55%)' }}>
                        +R$ {Number(r.metadata.balance_won).toFixed(2)} 💰
                      </p>
                    ) : (
                      <p
                        className="text-sm font-bold"
                        style={{ color: isCreditWin ? 'hsl(145 70% 55%)' : 'hsl(var(--muted-foreground))' }}
                      >
                        {isCreditWin ? `+${r.credits_won} 💎` : "Sem prêmio"}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ScratchCardPage;
