import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Gamepad2, Save, Brain, Ticket, Package, CupSoda, CircleDot, Users, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

const AdminGamesPage = () => {
  const queryClient = useQueryClient();

  // Fetch all credit_challenges (scratch, prize_box, cup_game, roulette)
  const { data: challenges = [] } = useQuery({
    queryKey: ["admin-all-challenges"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_challenges").select("*")
        .in("challenge_type", ["scratch_card", "prize_box", "cup_game", "roulette"])
        .order("created_at");
      return data || [];
    },
  });

  // Fetch memory game settings
  const { data: memorySettings } = useQuery({
    queryKey: ["admin-memory-settings"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("memory-game", {
        body: { action: "check_daily" },
      });
      return data?.settings || null;
    },
  });

  // Stats for credit challenges
  const { data: challengeStats } = useQuery({
    queryKey: ["admin-challenge-stats"],
    queryFn: async () => {
      const { data: attempts } = await supabase.from("challenge_attempts")
        .select("challenge_id, credits_spent, credits_won, metadata");
      if (!attempts) return {};
      const stats: Record<string, { plays: number; spent: number; won: number; balancePaid: number }> = {};
      attempts.forEach((a: any) => {
        if (!stats[a.challenge_id]) stats[a.challenge_id] = { plays: 0, spent: 0, won: 0, balancePaid: 0 };
        stats[a.challenge_id].plays++;
        stats[a.challenge_id].spent += a.credits_spent;
        stats[a.challenge_id].won += a.credits_won;
        stats[a.challenge_id].balancePaid += Number(a.metadata?.balance_won || 0);
      });
      return stats;
    },
  });

  // Stats for memory game
  const { data: memoryStats } = useQuery({
    queryKey: ["admin-memory-stats"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("memory-game", {
        body: { action: "get_sessions" },
      });
      const sessions = data?.sessions || [];
      const totalPlays = sessions.length;
      const totalWins = sessions.filter((s: any) => s.won).length;
      const totalRewarded = sessions.reduce((s: number, ses: any) => s + Number(ses.reward_amount || 0), 0);
      return { totalPlays, totalWins, totalRewarded };
    },
  });

  // Toggle challenge active status
  const toggleChallenge = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("credit_challenges").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-challenges"] });
      toast({ title: "Atualizado!" });
    },
  });

  // Memory settings editing
  const [editingMemory, setEditingMemory] = useState(false);
  const [memForm, setMemForm] = useState<any>(null);

  const startEditMemory = () => {
    setMemForm({ ...memorySettings });
    setEditingMemory(true);
  };

  const saveMemory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("memory-game", {
        body: {
          action: "update_settings",
          data: {
            is_active: memForm.is_active,
            reward_amount: Number(memForm.reward_amount),
            cost_per_game: Number(memForm.cost_per_game),
            time_limit_seconds: Number(memForm.time_limit_seconds),
            memorize_seconds: Number(memForm.memorize_seconds),
            daily_limit: Number(memForm.daily_limit),
            min_time_seconds: Number(memForm.min_time_seconds),
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Jogo da Memória atualizado!" });
      setEditingMemory(false);
      queryClient.invalidateQueries({ queryKey: ["admin-memory-settings"] });
    },
  });

  const gameIcons: Record<string, any> = {
    scratch_card: Ticket,
    prize_box: Package,
    cup_game: CupSoda,
    roulette: CircleDot,
  };

  const gameLabels: Record<string, string> = {
    scratch_card: "Raspadinha",
    prize_box: "Caixa Premiada",
    cup_game: "Jogo dos Copos",
    roulette: "Roleta Premiada",
  };

  // Summary totals
  const totalPlays = Object.values(challengeStats || {}).reduce((s: number, v: any) => s + v.plays, 0) + (memoryStats?.totalPlays || 0);
  const totalBalancePaid = Object.values(challengeStats || {}).reduce((s: number, v: any) => s + v.balancePaid, 0) + (memoryStats?.totalRewarded || 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Gamepad2 className="text-primary" /> Gestão de Jogos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle centralizado de todos os jogos da plataforma</p>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{challenges.length + (memorySettings ? 1 : 0)}</p>
              <p className="text-xs text-muted-foreground">Jogos Configurados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{challenges.filter((c: any) => c.is_active).length + (memorySettings?.is_active ? 1 : 0)}</p>
              <p className="text-xs text-muted-foreground">Jogos Ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalPlays}</p>
              <p className="text-xs text-muted-foreground">Total de Partidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">R$ {totalBalancePaid.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Saldo Pago Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Challenge Games */}
        <h2 className="mb-3 text-lg font-bold text-foreground">Jogos de Crédito (💎)</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {challenges.map((ch: any, i: number) => {
            const Icon = gameIcons[ch.challenge_type] || Gamepad2;
            const stats = challengeStats?.[ch.id];
            return (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={!ch.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Icon size={18} className="text-primary" />
                        {ch.name}
                      </div>
                      <Switch
                        checked={ch.is_active}
                        onCheckedChange={(v) => toggleChallenge.mutate({ id: ch.id, is_active: v })}
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">{ch.description}</p>
                    <div className="flex gap-4 text-xs">
                      <span>Custo: <strong className="text-primary">{ch.cost_credits} 💎</strong></span>
                      <span>Limite: <strong>{ch.daily_limit || "∞"}</strong></span>
                    </div>
                    {stats && (
                      <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
                        <span className="flex items-center gap-1"><Users size={10} /> {stats.plays} jogadas</span>
                        <span className="flex items-center gap-1"><TrendingDown size={10} /> {stats.spent} 💎 gastos</span>
                        <span className="flex items-center gap-1"><TrendingUp size={10} /> R$ {stats.balancePaid.toFixed(2)} pagos</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Memory Game */}
        <h2 className="mb-3 text-lg font-bold text-foreground">Jogo da Memória (💰)</h2>
        {memorySettings && !editingMemory && (
          <Card className={!memorySettings.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-primary" />
                  Desafio da Memória
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${memorySettings.is_active ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                    {memorySettings.is_active ? "Ativo" : "Pausado"}
                  </span>
                  <Button size="sm" variant="outline" onClick={startEditMemory}>Editar</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg bg-muted/30 p-2 text-center">
                  <p className="font-bold text-foreground">R$ {Number(memorySettings.cost_per_game).toFixed(2)}</p>
                  <p className="text-muted-foreground">Custo</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2 text-center">
                  <p className="font-bold text-foreground">R$ {Number(memorySettings.reward_amount).toFixed(2)}</p>
                  <p className="text-muted-foreground">Recompensa</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2 text-center">
                  <p className="font-bold text-foreground">{memorySettings.time_limit_seconds}s</p>
                  <p className="text-muted-foreground">Tempo</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2 text-center">
                  <p className="font-bold text-foreground">{memorySettings.daily_limit}</p>
                  <p className="text-muted-foreground">Vitórias/dia</p>
                </div>
              </div>
              {memoryStats && (
                <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
                  <span className="flex items-center gap-1"><Users size={10} /> {memoryStats.totalPlays} partidas</span>
                  <span className="flex items-center gap-1"><TrendingUp size={10} /> {memoryStats.totalWins} vitórias</span>
                  <span className="flex items-center gap-1">💰 R$ {memoryStats.totalRewarded.toFixed(2)} pagos</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Memory Edit Form */}
        {editingMemory && memForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain size={18} className="text-primary" /> Editar Jogo da Memória
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={memForm.is_active} onCheckedChange={(v) => setMemForm({ ...memForm, is_active: v })} />
                <span className="text-sm">{memForm.is_active ? "Ativo" : "Pausado"}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Custo (R$)</label>
                  <Input type="number" step="0.01" min={0} value={memForm.cost_per_game} onChange={(e) => setMemForm({ ...memForm, cost_per_game: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Recompensa (R$)</label>
                  <Input type="number" step="0.01" min={0} value={memForm.reward_amount} onChange={(e) => setMemForm({ ...memForm, reward_amount: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tempo limite (s)</label>
                  <Input type="number" min={10} value={memForm.time_limit_seconds} onChange={(e) => setMemForm({ ...memForm, time_limit_seconds: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Memorização (s)</label>
                  <Input type="number" min={1} value={memForm.memorize_seconds} onChange={(e) => setMemForm({ ...memForm, memorize_seconds: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vitórias/dia</label>
                  <Input type="number" min={1} value={memForm.daily_limit} onChange={(e) => setMemForm({ ...memForm, daily_limit: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tempo mín. anti-fraude (s)</label>
                  <Input type="number" min={1} value={memForm.min_time_seconds} onChange={(e) => setMemForm({ ...memForm, min_time_seconds: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => saveMemory.mutate()} disabled={saveMemory.isPending} className="flex-1">
                  <Save size={16} className="mr-2" /> {saveMemory.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => setEditingMemory(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminGamesPage;
