import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Diamond, Trophy, Zap, Lock, Brain } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const levelOrder = ["bronze", "prata", "ouro", "diamante"];

const CreditsChallengesPage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [resultAnim, setResultAnim] = useState<{ won: number; balanceWon: number; rewardType: string; label: string; credits: number } | null>(null);

  const userLevel = (user as any)?.user_level || "bronze";
  const userCredits = (user as any)?.credits || 0;

  const { data: challenges = [] } = useQuery({
    queryKey: ["credit-challenges"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_challenges").select("*").eq("is_active", true)
        .in("challenge_type", ["scratch_card", "prize_box", "cup_game", "roulette"]);
      return data || [];
    },
  });

  const { data: recentAttempts = [] } = useQuery({
    queryKey: ["my-challenge-attempts"],
    queryFn: async () => {
      const { data } = await supabase.from("challenge_attempts")
        .select("*, credit_challenges(name, icon)")
        .eq("user_id", user?.id).order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: rankings = [] } = useQuery({
    queryKey: ["credit-rankings"],
    queryFn: async () => {
      const monthYear = new Date().toISOString().slice(0, 7);
      const { data } = await supabase.from("credit_rankings")
        .select("*, profiles(name, username, vip_badge, user_level)")
        .eq("month_year", monthYear)
        .order("total_credits_used", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const playMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      setPlayingId(challengeId);
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "play_challenge", data: { challenge_id: challengeId } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const totalWon = data.reward_type === "balance" ? data.balance_won : data.credits_won;
      setResultAnim({ won: totalWon, balanceWon: data.balance_won || 0, rewardType: data.reward_type, label: data.label, credits: data.new_credits });
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["my-challenge-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["credit-rankings"] });
      setTimeout(() => { setResultAnim(null); setPlayingId(null); }, 3500);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setPlayingId(null);
    },
  });

  const canPlay = (challenge: any) => {
    return levelOrder.indexOf(userLevel) >= levelOrder.indexOf(challenge.min_level) && userCredits >= challenge.cost_credits;
  };

  const isLocked = (challenge: any) => levelOrder.indexOf(userLevel) < levelOrder.indexOf(challenge.min_level);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Gamepad2 className="text-primary" /> Jogos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Use seus créditos nos jogos e ganhe recompensas</p>
      </div>

      {/* Balance bar */}
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-muted/30 border border-border p-3">
        <Diamond className="text-primary" size={20} />
        <span className="text-sm text-muted-foreground">Seus créditos:</span>
        <span className="font-display text-xl font-bold text-primary">{userCredits}</span>
      </div>

      {/* Result Animation */}
      <AnimatePresence>
        {resultAnim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50 }} animate={{ y: 0 }}
              className="glass-card rounded-2xl p-8 text-center max-w-xs"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="text-6xl mb-4"
              >
                {resultAnim.won > 0 ? "🎉" : "😔"}
              </motion.div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">{resultAnim.label}</h3>
              <p className={`text-3xl font-bold ${resultAnim.won > 0 ? "text-green-400" : "text-destructive"}`}>
                {resultAnim.won > 0
                  ? resultAnim.rewardType === "balance"
                    ? `+R$ ${Number(resultAnim.balanceWon).toFixed(2)}`
                    : `+${resultAnim.won} créditos`
                  : "Sem prêmio"}
              </p>
              {resultAnim.rewardType === "balance" && resultAnim.won > 0 && (
                <p className="mt-1 text-sm text-green-400/70">💰 Adicionado ao seu saldo real!</p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">Créditos: {resultAnim.credits} 💎</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Challenges Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {challenges.map((ch: any, i: number) => {
          const locked = isLocked(ch);
          const canDo = canPlay(ch);
          const probs = ch.probabilities as Array<{ result: number; weight: number; label: string; reward_type?: string }>;

          return (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`stat-card rounded-xl p-5 flex flex-col ${locked ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-2xl">{ch.icon}</span>
                  <h3 className="font-bold text-foreground mt-1">{ch.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{ch.description}</p>
                </div>
                {locked && <Lock className="text-muted-foreground" size={18} />}
              </div>

              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1">Possíveis resultados:</p>
                <div className="flex flex-wrap gap-1">
                  {probs.filter(p => p.result > 0).map((p, j) => (
                    <Badge key={j} variant="outline" className={`text-xs ${p.reward_type === "balance" ? "border-green-500/30 text-green-400" : ""}`}>
                      {p.reward_type === "balance" ? "💰" : "💎"} {p.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {locked && (
                <p className="text-xs text-yellow-400 mb-3">🔒 Requer nível: {ch.min_level}</p>
              )}

              <div className="mt-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Custo:</span>
                  <span className="font-bold text-primary">{ch.cost_credits} 💎</span>
                </div>
                <button
                  onClick={() => {
                    if (ch.challenge_type === "scratch_card") {
                      navigate("/scratch");
                    } else if (ch.challenge_type === "prize_box") {
                      navigate("/prize-box");
                    } else if (ch.challenge_type === "cup_game") {
                      navigate("/cup-game");
                    } else if (ch.challenge_type === "roulette") {
                      navigate("/roulette");
                    } else {
                      playMutation.mutate(ch.id);
                    }
                  }}
                  disabled={!canDo || (playMutation.isPending && !["scratch_card", "prize_box", "cup_game", "roulette"].includes(ch.challenge_type))}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {playingId === ch.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <><Zap size={16} /> {ch.challenge_type === "scratch_card" ? "Abrir Raspadinha" : ch.challenge_type === "prize_box" ? "Abrir Caixa" : ch.challenge_type === "cup_game" ? "Jogar Copos" : ch.challenge_type === "roulette" ? "Girar Roleta" : "Jogar"}</>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Memory Game Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: challenges.length * 0.1 }}
          className="stat-card rounded-xl p-5 flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-2xl">🧠</span>
              <h3 className="font-bold text-foreground mt-1">Jogo da Memória</h3>
              <p className="text-xs text-muted-foreground mt-1">Encontre os pares e ganhe saldo real!</p>
            </div>
            <Brain size={18} className="text-primary" />
          </div>
          <div className="mb-3 space-y-1">
            <p className="text-xs text-muted-foreground">Regras:</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                🏆 R$ 1,50
              </Badge>
              <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                🎯 1 vitória/dia
              </Badge>
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                💎 2 créditos
              </Badge>
            </div>
          </div>
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Custo:</span>
              <span className="font-bold text-primary">2 💎</span>
            </div>
            <button
              onClick={() => navigate("/memory-game")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 transition-all"
            >
              <Brain size={16} /> Jogar Memória
            </button>
          </div>
        </motion.div>
      </div>

      {/* Ranking */}
      {rankings.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Trophy className="text-yellow-400" size={20} /> Ranking Mensal
          </h2>
          <div className="glass-card rounded-xl overflow-hidden">
            {rankings.map((r: any, i: number) => (
              <div key={r.id} className={`flex items-center justify-between p-3 ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`font-display text-lg font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.profiles?.name || "Usuário"}
                      {r.profiles?.vip_badge && <span className="ml-1 text-yellow-400">👑</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">@{r.profiles?.username}</p>
                  </div>
                </div>
                <span className="font-bold text-primary">{r.total_credits_used} 💎</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Attempts */}
      {recentAttempts.length > 0 && (
        <>
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">Últimas Jogadas</h2>
          <div className="space-y-2">
            {recentAttempts.map((a: any) => (
              <div key={a.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{(a as any).credit_challenges?.icon || "🎯"}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{(a as any).credit_challenges?.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">-{a.credits_spent} 💎</p>
                  {a.metadata?.reward_type === "balance" && a.metadata?.balance_won > 0 ? (
                    <p className="text-sm font-bold text-green-400">+R$ {Number(a.metadata.balance_won).toFixed(2)} 💰</p>
                  ) : (
                    <p className={`text-sm font-bold ${a.credits_won > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                      {a.credits_won > 0 ? `+${a.credits_won} 💎` : a.result_label}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default CreditsChallengesPage;
