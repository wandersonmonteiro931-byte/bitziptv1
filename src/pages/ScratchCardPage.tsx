import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, Ticket, RotateCcw, Trophy } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// ---- Scratch Canvas Component ----
function ScratchCard({
  width,
  height,
  prize,
  onComplete,
}: {
  width: number;
  height: number;
  prize: { won: number; label: string } | null;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const scratched = useRef(0);
  const revealed = useRef(false);
  const [revealedState, setRevealedState] = useState(false);

  const totalPixels = width * height;

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Silver scratch layer with subtle pattern
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#C0C0C0");
    gradient.addColorStop(0.3, "#D8D8D8");
    gradient.addColorStop(0.5, "#B0B0B0");
    gradient.addColorStop(0.7, "#D0D0D0");
    gradient.addColorStop(1, "#A8A8A8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add scratch texture dots
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillStyle = `rgba(${180 + Math.random() * 40}, ${180 + Math.random() * 40}, ${180 + Math.random() * 40}, 0.5)`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // "RASPE AQUI" text
    ctx.fillStyle = "#888";
    ctx.font = `bold ${Math.min(width / 8, 20)}px 'Orbitron', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RASPE AQUI", width / 2, height / 2);

    // Stars decoration
    ctx.font = "16px sans-serif";
    ctx.fillText("⭐", width * 0.15, height * 0.3);
    ctx.fillText("⭐", width * 0.85, height * 0.3);
    ctx.fillText("⭐", width * 0.15, height * 0.7);
    ctx.fillText("⭐", width * 0.85, height * 0.7);
  }, [width, height]);

  useEffect(() => {
    revealed.current = false;
    scratched.current = 0;
    setRevealedState(false);
    initCanvas();
  }, [prize, initCanvas]);

  const scratch = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas || revealed.current) return;
      const ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();

      // Check scratch percentage
      const imageData = ctx.getImageData(0, 0, width, height);
      let cleared = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] === 0) cleared++;
      }
      scratched.current = cleared / totalPixels;

      if (scratched.current > 0.45 && !revealed.current) {
        revealed.current = true;
        // Clear remaining
        ctx.clearRect(0, 0, width, height);
        setRevealedState(true);
        onComplete();
      }
    },
    [width, height, totalPixels, onComplete]
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
            ? "linear-gradient(135deg, hsl(45 100% 15%), hsl(35 100% 10%))"
            : "linear-gradient(135deg, hsl(220 18% 12%), hsl(220 18% 8%))",
          border: "1px solid hsl(220 15% 20%)",
        }}
      >
        {prize ? (
          <>
            <motion.span
              className="text-5xl mb-2"
              animate={revealedState ? { scale: [1, 1.4, 1], rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 0.6 }}
            >
              {prize.won > 0 ? "🏆" : "😢"}
            </motion.span>
            <p
              className={`font-display text-2xl font-bold ${
                prize.won > 0 ? "text-yellow-400" : "text-muted-foreground"
              }`}
            >
              {prize.won > 0 ? `+${prize.won}` : "Sem prêmio"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {prize.won > 0 ? "créditos!" : "Tente novamente!"}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Compre para jogar</p>
        )}
      </div>

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

// ---- Main Page ----
const ScratchCardPage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [currentPrize, setCurrentPrize] = useState<{ won: number; label: string } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cardKey, setCardKey] = useState(0);

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
      return (data || []).filter((a: any) => a.credit_challenges?.name === "Raspadinha" || (a as any).metadata?.challenge_type === "scratch_card");
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
      return {
        total: scratches.length,
        totalWon: scratches.reduce((s, a) => s + a.credits_won, 0),
        totalSpent: scratches.reduce((s, a) => s + a.credits_spent, 0),
        biggestWin: Math.max(0, ...scratches.map((a) => a.credits_won)),
      };
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
      setCurrentPrize({ won: data.credits_won, label: data.label });
      setCardKey((k) => k + 1);
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["scratch-results"] });
      queryClient.invalidateQueries({ queryKey: ["scratch-stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const handleReveal = useCallback(() => {
    setShowResult(true);
    if (currentPrize && currentPrize.won > 0) {
      toast({
        title: `🏆 Você ganhou ${currentPrize.won} créditos!`,
        description: currentPrize.label,
      });
    }
  }, [currentPrize]);

  const cost = scratchChallenge?.cost_credits || 3;
  const canBuy = userCredits >= cost;
  const probabilities = (scratchChallenge?.probabilities || []) as Array<{
    result: number;
    weight: number;
    label: string;
  }>;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Ticket className="text-primary" /> Raspadinha
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compre uma raspadinha e raspe para descobrir seu prêmio!
        </p>
      </div>

      {/* Balance + Stats */}
      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="stat-card rounded-xl p-4 text-center">
          <Diamond size={18} className="mx-auto text-primary" />
          <p className="text-xs text-muted-foreground mt-1">Créditos</p>
          <p className="font-display text-xl font-bold text-primary">{userCredits}</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <Ticket size={18} className="mx-auto text-accent" />
          <p className="text-xs text-muted-foreground mt-1">Raspadinhas</p>
          <p className="font-display text-xl font-bold text-foreground">{stats?.total || 0}</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <Trophy size={18} className="mx-auto text-yellow-400" />
          <p className="text-xs text-muted-foreground mt-1">Total Ganho</p>
          <p className="font-display text-xl font-bold text-green-400">{stats?.totalWon || 0}</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <span className="text-lg">🔥</span>
          <p className="text-xs text-muted-foreground mt-1">Maior Prêmio</p>
          <p className="font-display text-xl font-bold text-yellow-400">{stats?.biggestWin || 0}</p>
        </div>
      </div>

      {/* Main Card Area */}
      <div className="mx-auto max-w-md">
        <div className="glass-card rounded-2xl p-5">
          {/* Prize table */}
          <div className="mb-4">
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
              Tabela de prêmios
            </p>
            <div className="flex flex-wrap gap-1.5">
              {probabilities
                .filter((p) => p.result > 0)
                .map((p, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs border-primary/20 text-primary/80"
                  >
                    {p.label}
                  </Badge>
                ))}
            </div>
          </div>

          {/* Scratch Card */}
          <div className="flex justify-center mb-4">
            <ScratchCard
              key={cardKey}
              width={320}
              height={200}
              prize={currentPrize}
              onComplete={handleReveal}
            />
          </div>

          {/* Result Message */}
          <AnimatePresence>
            {showResult && currentPrize && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mb-4 rounded-xl p-4 text-center ${
                  currentPrize.won > 0
                    ? "bg-yellow-500/10 border border-yellow-500/30"
                    : "bg-muted/30 border border-border"
                }`}
              >
                <p
                  className={`font-display text-lg font-bold ${
                    currentPrize.won > 0 ? "text-yellow-400" : "text-muted-foreground"
                  }`}
                >
                  {currentPrize.won > 0
                    ? `🎉 Você ganhou ${currentPrize.won} créditos!`
                    : "Sem prêmio desta vez. Tente novamente!"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buy Button */}
          <button
            onClick={() => {
              setCurrentPrize(null);
              setShowResult(false);
              buyMutation.mutate();
            }}
            disabled={!canBuy || buyMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {buyMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                <RotateCcw size={16} />
                {showResult || currentPrize
                  ? `Nova Raspadinha (${cost} 💎)`
                  : `Comprar Raspadinha (${cost} 💎)`}
              </>
            )}
          </button>

          {!canBuy && (
            <p className="mt-2 text-center text-xs text-destructive">
              Créditos insuficientes. Mínimo: {cost} 💎
            </p>
          )}
        </div>

        {/* Disclaimer */}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          ⚠️ Créditos são moeda interna. Recompensas são promocionais. Não é investimento.
        </p>
      </div>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="mx-auto mt-8 max-w-md">
          <h2 className="mb-3 font-display text-lg font-bold text-foreground">Últimas Raspadinhas</h2>
          <div className="space-y-2">
            {recentResults.map((r: any) => (
              <div
                key={r.id}
                className="glass-card flex items-center justify-between rounded-lg p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">🎫 Raspadinha</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">-{r.credits_spent} 💎</p>
                  <p
                    className={`text-sm font-bold ${
                      r.credits_won > 0 ? "text-green-400" : "text-muted-foreground"
                    }`}
                  >
                    {r.credits_won > 0 ? `+${r.credits_won} 💎` : "Sem prêmio"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ScratchCardPage;
