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

type GamePhase = "idle" | "spinning" | "slowing" | "result";

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
  "hsl(0, 75%, 55%)",
  "hsl(210, 75%, 55%)",
  "hsl(45, 85%, 55%)",
  "hsl(120, 60%, 45%)",
  "hsl(280, 70%, 55%)",
  "hsl(15, 80%, 55%)",
  "hsl(190, 70%, 50%)",
  "hsl(340, 75%, 55%)",
  "hsl(60, 80%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(240, 65%, 55%)",
  "hsl(30, 85%, 55%)",
];

const RoulettePage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [muted, setMuted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const cooldownRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
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

  // Draw roulette wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const segAngle = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, size, size);

    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.arc(center, center, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.restore();

    // Segments
    segments.forEach((seg, i) => {
      const startAngle = i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;
      const color = seg.color || SEGMENT_COLORS[i % SEGMENT_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(10, Math.min(14, 180 / segments.length))}px system-ui`;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 3;
      ctx.fillText(seg.label, radius - 16, 5);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(center, center, 5, center, center, 28);
    grad.addColorStop(0, "hsl(45, 90%, 65%)");
    grad.addColorStop(1, "hsl(45, 80%, 45%)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center text
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("🎰", center, center + 5);

    // Outer ring with "lights"
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * 2 * Math.PI;
      const lx = center + (radius + 4) * Math.cos(angle);
      const ly = center + (radius + 4) * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
      ctx.fillStyle = i % 2 === 0 ? "hsl(45, 90%, 70%)" : "hsl(0, 80%, 60%)";
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

      // Get result from server first
      const result = await playMutation.mutateAsync();
      setSpinResult(result);

      // Calculate target angle
      const segAngle = 360 / segments.length;
      const targetSegmentCenter = segAngle * result.winning_segment_index + segAngle / 2;
      // We want the pointer (at top) to point to this segment
      // Pointer is at 0° (top), segments start from top going clockwise
      // Need to rotate so targetSegmentCenter aligns with top
      const targetAngle = 360 - targetSegmentCenter;
      // Add multiple full rotations for dramatic effect
      const fullRotations = 5 + Math.floor(Math.random() * 3);
      const totalAngle = rotation + fullRotations * 360 + targetAngle + (Math.random() * segAngle * 0.6 - segAngle * 0.3);

      // Start spinning sound
      spinSoundRef.current = setInterval(() => {
        sfx.shuffle();
      }, 100);

      // Animate with CSS transition
      setRotation(totalAngle);
      setPhase("slowing");

      // Stop sound and show result after spin
      setTimeout(() => {
        if (spinSoundRef.current) clearInterval(spinSoundRef.current);
        sfx.cellReveal();
      }, 3500);

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
      }, 5000);
    } catch (err: any) {
      if (spinSoundRef.current) clearInterval(spinSoundRef.current);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPhase("idle");
      cooldownRef.current = false;
    }
  }, [challenge, phase, segments, rotation, refreshProfile, queryClient]);

  const resetGame = () => {
    setPhase("idle");
    setSpinResult(null);
  };

  const userCredits = (user as any)?.credits || 0;
  const cost = challenge?.cost_credits || 1;
  const canPlay = userCredits >= cost && phase === "idle";
  const isWin = spinResult && (spinResult.credits_won > 0 || spinResult.balance_won > 0);

  // Confetti particles for big wins
  const showConfetti = phase === "result" && isWin && (spinResult!.balance_won >= 10 || spinResult!.credits_won >= 5);

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
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
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/30 to-background p-4">
          {/* Particles background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-primary/15"
                style={{ left: `${10 + i * 12}%`, top: `${15 + (i % 4) * 20}%` }}
                animate={{ y: [0, -15, 0], opacity: [0.1, 0.4, 0.1] }}
                transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>

          {/* Pointer / Arrow at top */}
          <div className="relative z-20 mx-auto mb-[-16px] flex justify-center">
            <div className="h-0 w-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
          </div>

          {/* Wheel container */}
          <div className="relative mx-auto" style={{ width: 300, height: 300 }}>
            <motion.div
              className="absolute inset-0"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: phase === "slowing" || phase === "result"
                  ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                  : "none",
              }}
            >
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="h-full w-full"
              />
            </motion.div>

            {/* Blinking lights overlay */}
            {(phase === "spinning" || phase === "slowing") && (
              <div className="pointer-events-none absolute inset-0">
                {[...Array(12)].map((_, i) => {
                  const angle = (i / 12) * 2 * Math.PI;
                  const x = 150 + 146 * Math.cos(angle);
                  const y = 150 + 146 * Math.sin(angle);
                  return (
                    <motion.div
                      key={i}
                      className="absolute h-2.5 w-2.5 rounded-full"
                      style={{
                        left: x - 5,
                        top: y - 5,
                        backgroundColor: i % 2 === 0 ? "hsl(45, 90%, 70%)" : "hsl(0, 80%, 65%)",
                      }}
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Confetti */}
          <AnimatePresence>
            {showConfetti && (
              <>
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="pointer-events-none absolute h-2 w-2 rounded-sm"
                    style={{
                      left: `${20 + Math.random() * 60}%`,
                      top: "40%",
                      backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    }}
                    initial={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    animate={{
                      y: [0, -80 - Math.random() * 100, 200],
                      x: [-40 + Math.random() * 80],
                      opacity: [1, 1, 0],
                      rotate: Math.random() * 720,
                      scale: [1, 1.2, 0.5],
                    }}
                    transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Result overlay */}
          <AnimatePresence>
            {phase === "result" && spinResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 rounded-xl border border-border bg-card p-4 text-center"
              >
                {isWin ? (
                  <>
                    <p className="text-3xl mb-2">🎉</p>
                    <p className="text-lg font-bold text-primary">{spinResult.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {spinResult.reward_type === "balance"
                        ? `+R$ ${Number(spinResult.balance_won).toFixed(2)}`
                        : `+${spinResult.credits_won} créditos`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-2">😔</p>
                    <p className="text-lg font-bold text-foreground">{spinResult.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">Tente novamente!</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
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
          {(phase === "spinning" || phase === "slowing") && (
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

        {/* Segments info */}
        {segments.length > 0 && phase === "idle" && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Prêmios da Roleta</h3>
            <div className="grid grid-cols-2 gap-2">
              {segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
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
