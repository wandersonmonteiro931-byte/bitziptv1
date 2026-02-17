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
  const tickSoundRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const displaySize = 320;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const size = displaySize;
    const center = size / 2;
    const radius = center - 12;
    const segAngle = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, size, size);

    // Outer ring glow
    ctx.save();
    ctx.shadowColor = "rgba(255, 200, 0, 0.3)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,200,0,0.4)";
    ctx.lineWidth = 3;
    ctx.stroke();
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

      // Inner gradient for depth
      const grad = ctx.createRadialGradient(center, center, radius * 0.3, center, center, radius);
      grad.addColorStop(0, "rgba(255,255,255,0.15)");
      grad.addColorStop(1, "rgba(0,0,0,0.1)");
      ctx.fillStyle = grad;
      ctx.fill();

      // Border between segments
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label - draw text along the segment, reading outward from center
      ctx.save();
      ctx.translate(center, center);
      const midAngle = startAngle + segAngle / 2;
      ctx.rotate(midAngle);
      
      // Text settings
      const fontSize = Math.max(11, Math.min(15, 160 / segments.length));
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      // Emoji
      const emoji = EMOJI_MAP[seg.reward_type] || "🎯";
      const textRadius = radius * 0.65;
      ctx.font = `${fontSize + 2}px system-ui`;
      ctx.fillText(emoji, textRadius + 14, 0);
      
      // Label text
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(seg.label, textRadius - 12, 0);
      
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(center, center, 26, 0, 2 * Math.PI);
    const hubGrad = ctx.createRadialGradient(center - 4, center - 4, 3, center, center, 26);
    hubGrad.addColorStop(0, "#ffe066");
    hubGrad.addColorStop(0.5, "#ffc107");
    hubGrad.addColorStop(1, "#b8860b");
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Hub inner circle
    ctx.beginPath();
    ctx.arc(center, center, 14, 0, 2 * Math.PI);
    ctx.fillStyle = "#b8860b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outer decoration lights
    const lightCount = segments.length * 2;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * 2 * Math.PI;
      const lx = center + (radius + 6) * Math.cos(angle);
      const ly = center + (radius + 6) * Math.sin(angle);
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

      // Calculate target angle for the winning segment
      const segAngle = 360 / segments.length;
      // Segment center angle (from top, clockwise)
      const segmentCenterAngle = segAngle * result.winning_segment_index + segAngle / 2;
      // To align with pointer at top (0°), we rotate wheel so this segment is at top
      const targetOffset = 360 - segmentCenterAngle;
      // Add random jitter within segment (not too close to edges)
      const jitter = (Math.random() - 0.5) * segAngle * 0.5;
      // Multiple full rotations + final position
      const fullSpins = 6 + Math.floor(Math.random() * 3); // 6-8 full rotations
      const targetAngle = currentAngleRef.current + fullSpins * 360 + targetOffset + jitter;
      
      // Normalize: make sure we always spin forward
      const minAngle = currentAngleRef.current + 360 * 5;
      const finalTarget = targetAngle < minAngle ? targetAngle + 360 * Math.ceil((minAngle - targetAngle) / 360) : targetAngle;

      // Animate with requestAnimationFrame for smooth 5-second spin
      const startAngle = currentAngleRef.current;
      const totalDelta = finalTarget - startAngle;
      const duration = 5000; // exactly 5 seconds
      const startTime = performance.now();

      // Tick sound that slows down
      let lastTickAngle = startAngle;
      const tickInterval = segAngle; // tick every segment

      // Spinning sound - starts fast, gets slower
      let soundInterval = 80;
      const playTickSound = () => {
        sfx.shuffle();
      };
      spinSoundRef.current = setInterval(playTickSound, soundInterval);

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Custom easing: fast start, very gradual slowdown at end
        // Using cubic bezier approximation for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3.5);
        
        const currentAngle = startAngle + totalDelta * eased;
        
        if (wheelRef.current) {
          wheelRef.current.style.transform = `rotate(${currentAngle}deg)`;
        }

        // Adjust tick sound speed based on progress
        if (progress > 0.5 && spinSoundRef.current) {
          clearInterval(spinSoundRef.current);
          const newInterval = 80 + (progress - 0.5) * 600; // slow down sound
          spinSoundRef.current = setInterval(playTickSound, newInterval);
        }
        if (progress > 0.85 && spinSoundRef.current) {
          clearInterval(spinSoundRef.current);
          spinSoundRef.current = null;
        }

        // Tick sound when crossing segment boundaries
        const angleDiff = Math.abs(currentAngle - lastTickAngle);
        if (angleDiff >= tickInterval) {
          lastTickAngle = currentAngle;
          if (progress < 0.9) sfx.click();
        }

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          currentAngleRef.current = finalTarget;
          if (spinSoundRef.current) {
            clearInterval(spinSoundRef.current);
            spinSoundRef.current = null;
          }
          
          // Small delay then show result
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
      if (spinSoundRef.current) clearInterval(spinSoundRef.current);
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
        <div className="relative mb-4 rounded-2xl border border-border bg-gradient-to-b from-muted/20 to-background p-3">
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
          <div className="relative z-20 mx-auto mb-[-20px] flex justify-center">
            <div
              className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              style={{
                width: 0,
                height: 0,
                borderLeft: "16px solid transparent",
                borderRight: "16px solid transparent",
                borderTop: "28px solid hsl(var(--primary))",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
              }}
            />
          </div>

          {/* Wheel */}
          <div className="relative mx-auto" style={{ width: 320, height: 320 }}>
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
                  const x = 160 + 154 * Math.cos(angle);
                  const y = 160 + 154 * Math.sin(angle);
                  return (
                    <motion.div
                      key={i}
                      className="absolute h-2 w-2 rounded-full"
                      style={{
                        left: x - 4,
                        top: y - 4,
                        backgroundColor: i % 3 === 0 ? "#ff4444" : i % 3 === 1 ? "#ffcc00" : "#44ff44",
                      }}
                      animate={{ opacity: [1, 0.15, 1] }}
                      transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.04 }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Glow effect on winning segment */}
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
