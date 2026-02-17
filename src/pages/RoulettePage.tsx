import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond, Volume2, VolumeX, Loader2 } from "lucide-react";
import { sfx, setMuted as setSfxMuted } from "@/lib/sounds";
import { Button } from "@/components/ui/button";

type GamePhase = "idle" | "spinning" | "result";

interface Segment {
  result: number;
  weight: number;
  label: string;
  reward_type: string;
  color: string;
}

interface SpinResult {
  winning_segment_index: number;
  segments_count: number;
  credits_won: number;
  balance_won: number;
  reward_type: string;
  reward_value: number;
  label: string;
  new_credits: number;
  new_balance: number;
}

const SEGMENT_COLORS = [
  "#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6",
  "#e67e22", "#1abc9c", "#e91e63", "#cddc39", "#00bcd4",
  "#ff5722", "#607d8b",
];

const EMOJI_MAP: Record<string, string> = {
  none: "❌",
  credits: "💎",
  balance: "💰",
  multiplier: "✖️",
};

const RoulettePage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [muted, setMuted] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const cooldownRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const currentAngleRef = useRef(0);
  const animRef = useRef<number>(0);
  const spinSoundRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: challenge } = useQuery({
    queryKey: ["roulette-challenge"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_challenges")
        .select("*").eq("challenge_type", "roulette").eq("is_active", true).limit(1).single();
      return data;
    },
  });

  const segments: Segment[] = (challenge?.probabilities as unknown as Segment[]) || [];

  // Draw static wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = 340;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const size = displaySize;
    const center = size / 2;
    const radius = center - 16;
    const segAngle = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, size, size);

    // Outer ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 10, 0, 2 * Math.PI);
    const ringGrad = ctx.createRadialGradient(center, center, radius + 2, center, center, radius + 12);
    ringGrad.addColorStop(0, "rgba(255,215,0,0.6)");
    ringGrad.addColorStop(1, "rgba(180,130,0,0.2)");
    ctx.fillStyle = ringGrad;
    ctx.fill();
    ctx.restore();

    // Segments
    segments.forEach((seg, i) => {
      const startAngle = i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;
      const color = seg.color || SEGMENT_COLORS[i % SEGMENT_COLORS.length];

      // Fill segment
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Depth gradient
      const grad = ctx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
      grad.addColorStop(0, "rgba(255,255,255,0.18)");
      grad.addColorStop(0.6, "rgba(255,255,255,0.05)");
      grad.addColorStop(1, "rgba(0,0,0,0.15)");
      ctx.fillStyle = grad;
      ctx.fill();

      // Segment border
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label - properly rotated to read from center outward
      ctx.save();
      ctx.translate(center, center);
      const midAngle = startAngle + segAngle / 2;
      ctx.rotate(midAngle);

      // Adaptive font size based on number of segments and available arc
      const arcLen = segAngle * radius * 0.5;
      const maxFontByArc = Math.floor(arcLen / 1.2);
      const fontSize = Math.max(10, Math.min(16, maxFontByArc, 180 / segments.length));

      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Draw label text at ~55% radius
      const textR = radius * 0.55;
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Truncate long labels
      let displayLabel = seg.label;
      if (ctx.measureText(displayLabel).width > radius * 0.5) {
        while (displayLabel.length > 3 && ctx.measureText(displayLabel + "…").width > radius * 0.5) {
          displayLabel = displayLabel.slice(0, -1);
        }
        displayLabel += "…";
      }
      ctx.fillText(displayLabel, textR, 0);

      // Emoji at ~80% radius
      const emoji = EMOJI_MAP[seg.reward_type] || "🎯";
      ctx.font = `${fontSize + 1}px system-ui`;
      ctx.fillText(emoji, radius * 0.82, 0);

      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, 2 * Math.PI);
    const hubGrad = ctx.createRadialGradient(center - 5, center - 5, 3, center, center, 28);
    hubGrad.addColorStop(0, "#ffe066");
    hubGrad.addColorStop(0.5, "#ffc107");
    hubGrad.addColorStop(1, "#8b6914");
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Hub inner
    ctx.beginPath();
    ctx.arc(center, center, 15, 0, 2 * Math.PI);
    ctx.fillStyle = "#a0781a";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Decorative lights on outer ring
    const lightCount = Math.max(segments.length * 2, 16);
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * 2 * Math.PI;
      const lx = center + (radius + 8) * Math.cos(angle);
      const ly = center + (radius + 8) * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
      ctx.fillStyle = i % 3 === 0 ? "#ff4444" : i % 3 === 1 ? "#ffcc00" : "#44ff44";
      ctx.fill();
    }
  }, [segments]);

  const playMutation = useMutation({
    mutationFn: async () => {
      if (!challenge) throw new Error("Roleta não encontrada");
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "play_roulette", data: { challenge_id: challenge.id } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as SpinResult;
    },
  });

  const startSpin = useCallback(async () => {
    if (cooldownRef.current || phase !== "idle" || !challenge || segments.length === 0) return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 8000);

    try {
      sfx.start();
      setSpinResult(null);
      setPhase("spinning");

      // Get result from server FIRST
      const result = await playMutation.mutateAsync();
      setSpinResult(result);

      // === FIXED: Calculate target angle correctly ===
      const segAngleDeg = 360 / segments.length;
      // The segment's center offset from 0° (top of wheel)
      const segmentCenterDeg = segAngleDeg * result.winning_segment_index + segAngleDeg / 2;
      // We need to rotate the wheel so that this segment sits under the pointer (top = 0°)
      // Wheel rotates clockwise, so to bring segment to top: 360 - segmentCenterDeg
      const desiredModAngle = (360 - segmentCenterDeg + 360) % 360;
      // Current position modulo 360
      const currentMod = ((currentAngleRef.current % 360) + 360) % 360;
      // How much additional rotation needed to land on desiredModAngle
      const extraNeeded = ((desiredModAngle - currentMod) + 360) % 360;
      // Add jitter within ~40% of segment so we don't always hit dead center
      const jitter = (Math.random() - 0.5) * segAngleDeg * 0.4;
      // Full rotations for visual effect (6-8 turns)
      const fullSpins = (6 + Math.floor(Math.random() * 3)) * 360;
      const targetAngle = currentAngleRef.current + fullSpins + extraNeeded + jitter;

      // Animate with requestAnimationFrame for silky-smooth 5s spin
      const startAngle = currentAngleRef.current;
      const totalDelta = targetAngle - startAngle;
      const duration = 5000;
      const startTime = performance.now();

      // Sound management
      let lastSoundTime = 0;
      const playSoundTick = (now: number, progress: number) => {
        // Tick interval increases as wheel slows (80ms → 500ms)
        const interval = 80 + progress * progress * 600;
        if (now - lastSoundTime > interval && progress < 0.92) {
          sfx.shuffle();
          lastSoundTime = now;
        }
      };

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Quintic ease-out for very smooth deceleration with dramatic slowdown at end
        const eased = 1 - Math.pow(1 - progress, 4);

        const currentAngle = startAngle + totalDelta * eased;

        if (wheelRef.current) {
          wheelRef.current.style.transform = `rotate(${currentAngle}deg)`;
        }

        playSoundTick(now, progress);

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          currentAngleRef.current = targetAngle;

          setTimeout(async () => {
            sfx.cellReveal();
            try { navigator.vibrate?.(30); } catch {}

            setTimeout(async () => {
              const isWin = result.credits_won > 0 || result.balance_won > 0;
              if (isWin) {
                if (result.balance_won >= 50 || result.credits_won >= 10) {
                  sfx.jackpot();
                } else {
                  sfx.win();
                }
                try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch {}
                toast({
                  title: "🎉 Você ganhou!",
                  description: result.reward_type === "balance"
                    ? `+R$ ${Number(result.balance_won).toFixed(2)} adicionados ao seu saldo!`
                    : result.reward_type === "multiplier"
                      ? `x${result.reward_value} = +${result.credits_won} créditos!`
                      : `+${result.credits_won} créditos!`,
                });
              } else {
                sfx.lose();
                try { navigator.vibrate?.(200); } catch {}
              }
              setPhase("result");
              await refreshProfile();
              queryClient.invalidateQueries({ queryKey: ["my-challenge-attempts"] });
            }, 400);
          }, 300);
        }
      };

      animRef.current = requestAnimationFrame(animate);
    } catch (err: any) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPhase("idle");
      cooldownRef.current = false;
    }
  }, [challenge, phase, segments, refreshProfile, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (spinSoundRef.current) clearInterval(spinSoundRef.current);
    };
  }, []);

  const resetGame = () => {
    setPhase("idle");
    setSpinResult(null);
  };

  const userCredits = (user as any)?.credits || 0;
  const cost = challenge?.cost_credits || 1;
  const canPlay = userCredits >= cost && phase === "idle";
  const isWin = spinResult && (spinResult.credits_won > 0 || spinResult.balance_won > 0);
  const showConfetti = phase === "result" && isWin && (spinResult!.balance_won >= 10 || spinResult!.credits_won >= 5);

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">🎰 Roleta Premiada</h1>
            <p className="text-sm text-muted-foreground">Gire e ganhe prêmios incríveis!</p>
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

        {/* Roulette Wheel */}
        <div className="relative mb-4 rounded-2xl border border-border bg-gradient-to-b from-muted/20 to-background p-4">
          {/* Particles background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-primary/20"
                style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
                animate={{ y: [0, -12, 0], opacity: [0.15, 0.4, 0.15] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>

          {/* Pointer at top */}
          <div className="relative z-20 mx-auto mb-[-22px] flex justify-center">
            <div
              className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              style={{
                width: 0,
                height: 0,
                borderLeft: "14px solid transparent",
                borderRight: "14px solid transparent",
                borderTop: "30px solid hsl(var(--primary))",
                filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
              }}
            />
          </div>

          {/* Wheel */}
          <div className="relative mx-auto" style={{ width: 340, height: 340 }}>
            <div
              ref={wheelRef}
              className="absolute inset-0 will-change-transform"
              style={{ transform: `rotate(${currentAngleRef.current}deg)` }}
            >
              <canvas
                ref={canvasRef}
                className="h-full w-full"
              />
            </div>

            {/* Blinking lights during spin */}
            {phase === "spinning" && (
              <div className="pointer-events-none absolute inset-0">
                {[...Array(16)].map((_, i) => {
                  const angle = (i / 16) * 2 * Math.PI;
                  const x = 170 + 162 * Math.cos(angle);
                  const y = 170 + 162 * Math.sin(angle);
                  return (
                    <motion.div
                      key={i}
                      className="absolute h-2.5 w-2.5 rounded-full"
                      style={{
                        left: x - 5,
                        top: y - 5,
                        backgroundColor: i % 3 === 0 ? "#ff4444" : i % 3 === 1 ? "#ffcc00" : "#44ff44",
                        boxShadow: `0 0 6px ${i % 3 === 0 ? "#ff4444" : i % 3 === 1 ? "#ffcc00" : "#44ff44"}`,
                      }}
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.35, repeat: Infinity, delay: i * 0.04 }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Glow effect on result */}
          <AnimatePresence>
            {phase === "result" && spinResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: isWin
                    ? "radial-gradient(circle at 50% 50%, rgba(255,200,0,0.15) 0%, transparent 70%)"
                    : "none",
                }}
              />
            )}
          </AnimatePresence>

          {/* Confetti */}
          <AnimatePresence>
            {showConfetti && (
              <>
                {[...Array(24)].map((_, i) => (
                  <motion.div
                    key={`confetti-${i}`}
                    className="pointer-events-none absolute h-2 w-2 rounded-sm"
                    style={{
                      left: `${15 + Math.random() * 70}%`,
                      top: "45%",
                      backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    }}
                    initial={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    animate={{
                      y: [0, -100 - Math.random() * 80, 250],
                      x: [-50 + Math.random() * 100],
                      opacity: [1, 1, 0],
                      rotate: Math.random() * 720,
                      scale: [1, 1.3, 0.4],
                    }}
                    transition={{ duration: 2.5 + Math.random(), ease: "easeOut" }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Result card */}
          <AnimatePresence>
            {phase === "result" && spinResult && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mt-3 rounded-xl border border-border bg-card p-4 text-center"
              >
                {isWin ? (
                  <>
                    <motion.p
                      className="text-4xl mb-2"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6, repeat: 2 }}
                    >
                      🎉
                    </motion.p>
                    <p className="text-lg font-bold text-primary">{spinResult.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {spinResult.reward_type === "balance"
                        ? `+R$ ${Number(spinResult.balance_won).toFixed(2)} ao saldo!`
                        : `+${spinResult.credits_won} créditos!`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-2">😔</p>
                    <p className="text-lg font-bold text-foreground">{spinResult.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">Tente novamente!</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action button */}
        <div className="flex gap-3">
          {phase === "idle" && (
            <Button
              onClick={startSpin}
              disabled={!canPlay}
              className="flex-1 h-14 text-lg font-bold rounded-xl"
              size="lg"
            >
              {!challenge ? (
                <Loader2 className="animate-spin mr-2" size={20} />
              ) : !canPlay ? (
                "Créditos insuficientes"
              ) : (
                "🎰 GIRAR"
              )}
            </Button>
          )}
          {phase === "spinning" && (
            <Button disabled className="flex-1 h-14 text-lg font-bold rounded-xl" size="lg">
              <Loader2 className="animate-spin mr-2" size={20} />
              Girando...
            </Button>
          )}
          {phase === "result" && (
            <Button onClick={resetGame} className="flex-1 h-14 text-lg font-bold rounded-xl" size="lg">
              🔄 Girar Novamente
            </Button>
          )}
        </div>

        {/* Segments legend */}
        {segments.length > 0 && phase === "idle" && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Prêmios da Roleta</h3>
            <div className="grid grid-cols-2 gap-2">
              {segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color || SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  />
                  <span className="text-xs text-foreground font-medium truncate">{seg.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RoulettePage;
