import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Save, BarChart3 } from "lucide-react";

interface Segment {
  result: number;
  weight: number;
  label: string;
  reward_type: string;
  color: string;
}

const COLORS = [
  "#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6",
  "#e67e22", "#1abc9c", "#e91e63", "#cddc39", "#00bcd4",
  "#ff5722", "#607d8b",
];

const AdminRoulettePage = () => {
  const queryClient = useQueryClient();
  const [editingSegments, setEditingSegments] = useState<Segment[] | null>(null);
  const [editCost, setEditCost] = useState(1);
  const [editDailyLimit, setEditDailyLimit] = useState(0);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);

  const { data: challenge, isLoading } = useQuery({
    queryKey: ["admin-roulette-challenge"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_challenges")
        .select("*").eq("challenge_type", "roulette").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-roulette-stats"],
    queryFn: async () => {
      if (!challenge) return null;
      const { data: attempts } = await supabase.from("challenge_attempts")
        .select("credits_spent, credits_won, metadata")
        .eq("challenge_id", challenge.id);
      if (!attempts) return { totalPlays: 0, totalSpent: 0, totalWon: 0, totalBalancePaid: 0 };
      const totalPlays = attempts.length;
      const totalSpent = attempts.reduce((s, a) => s + a.credits_spent, 0);
      const totalWon = attempts.reduce((s, a) => s + a.credits_won, 0);
      const totalBalancePaid = attempts.reduce((s, a) => s + Number((a.metadata as any)?.balance_won || 0), 0);
      return { totalPlays, totalSpent, totalWon, totalBalancePaid };
    },
    enabled: !!challenge,
  });

  const startEditing = () => {
    if (challenge) {
      setEditingSegments((challenge.probabilities as unknown as Segment[]) || []);
      setEditCost(challenge.cost_credits);
      setEditDailyLimit(challenge.daily_limit);
      setEditName(challenge.name);
      setEditDescription(challenge.description);
      setEditActive(challenge.is_active);
    } else {
      // Create new
      setEditingSegments([
        { result: 0, weight: 40, label: "❌ Nada", reward_type: "none", color: COLORS[0] },
        { result: 1, weight: 25, label: "💎 1 crédito", reward_type: "credits", color: COLORS[1] },
        { result: 5, weight: 15, label: "💎 5 créditos", reward_type: "credits", color: COLORS[2] },
        { result: 1, weight: 10, label: "💰 R$1", reward_type: "balance", color: COLORS[3] },
        { result: 5, weight: 5, label: "💰 R$5", reward_type: "balance", color: COLORS[4] },
        { result: 10, weight: 3, label: "💰 R$10", reward_type: "balance", color: COLORS[5] },
        { result: 50, weight: 1.5, label: "💰 R$50", reward_type: "balance", color: COLORS[6] },
        { result: 100, weight: 0.5, label: "💰 R$100", reward_type: "balance", color: COLORS[7] },
      ]);
      setEditCost(1);
      setEditDailyLimit(0);
      setEditName("Roleta Premiada");
      setEditDescription("Gire a roleta e ganhe prêmios!");
      setEditActive(true);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingSegments) return;
      const payload: any = {
        name: editName,
        description: editDescription,
        challenge_type: "roulette",
        cost_credits: editCost,
        daily_limit: editDailyLimit,
        is_active: editActive,
        icon: "🎰",
        probabilities: editingSegments as unknown,
      };
      if (challenge) {
        const { error } = await supabase.from("credit_challenges").update(payload).eq("id", challenge.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credit_challenges").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Salvo!", description: "Roleta atualizada com sucesso." });
      setEditingSegments(null);
      queryClient.invalidateQueries({ queryKey: ["admin-roulette-challenge"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const addSegment = () => {
    if (!editingSegments) return;
    setEditingSegments([...editingSegments, {
      result: 0, weight: 10, label: "Novo Prêmio", reward_type: "none",
      color: COLORS[editingSegments.length % COLORS.length],
    }]);
  };

  const removeSegment = (i: number) => {
    if (!editingSegments || editingSegments.length <= 2) return;
    setEditingSegments(editingSegments.filter((_, idx) => idx !== i));
  };

  const updateSegment = (i: number, field: keyof Segment, value: any) => {
    if (!editingSegments) return;
    const updated = [...editingSegments];
    (updated[i] as any)[field] = value;
    setEditingSegments(updated);
  };

  const totalWeight = editingSegments?.reduce((s, seg) => s + seg.weight, 0) || 0;
  const rtp = editingSegments && editCost > 0
    ? editingSegments.reduce((s, seg) => s + (seg.reward_type === "credits" || seg.reward_type === "multiplier" ? seg.result : 0) * seg.weight, 0) / totalWeight / editCost * 100
    : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">🎰 Gerenciar Roleta</h1>
          {!editingSegments && (
            <Button onClick={startEditing}>
              {challenge ? "Editar Roleta" : "Criar Roleta"}
            </Button>
          )}
        </div>

        {/* Stats */}
        {stats && challenge && !editingSegments && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.totalPlays}</p>
                <p className="text-xs text-muted-foreground">Total de Giros</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{stats.totalSpent}</p>
                <p className="text-xs text-muted-foreground">Créditos Apostados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.totalWon}</p>
                <p className="text-xs text-muted-foreground">Créditos Pagos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">R$ {stats.totalBalancePaid.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Saldo Pago</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Current config display */}
        {challenge && !editingSegments && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{challenge.icon}</span> {challenge.name}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${challenge.is_active ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {challenge.is_active ? "Ativo" : "Pausado"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{challenge.description}</p>
              <div className="flex gap-4 text-sm">
                <span>Custo: <strong>{challenge.cost_credits} 💎</strong></span>
                <span>Limite diário: <strong>{challenge.daily_limit || "Ilimitado"}</strong></span>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {(challenge.probabilities as unknown as Segment[]).map((seg, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: seg.color || COLORS[i % COLORS.length] }} />
                    <span className="text-xs truncate">{seg.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{((seg.weight / ((challenge.probabilities as unknown as Segment[]).reduce((s: number, s2: Segment) => s + s2.weight, 0))) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit form */}
        {editingSegments && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Configurações Gerais</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Custo (créditos)</label>
                    <Input type="number" min={1} value={editCost} onChange={e => setEditCost(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Descrição</label>
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Limite diário (0 = ilimitado)</label>
                    <Input type="number" min={0} value={editDailyLimit} onChange={e => setEditDailyLimit(Number(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <Switch checked={editActive} onCheckedChange={setEditActive} />
                    <span className="text-sm">{editActive ? "Ativo" : "Pausado"}</span>
                  </div>
                </div>
                {rtp > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                    <BarChart3 size={14} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">RTP estimado (créditos): <strong>{rtp.toFixed(1)}%</strong></span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Segmentos ({editingSegments.length})
                  <Button size="sm" variant="outline" onClick={addSegment}>
                    <Plus size={14} className="mr-1" /> Adicionar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingSegments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <input
                      type="color"
                      value={seg.color}
                      onChange={e => updateSegment(i, "color", e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-0"
                    />
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Input
                        placeholder="Label"
                        value={seg.label}
                        onChange={e => updateSegment(i, "label", e.target.value)}
                        className="text-xs"
                      />
                      <Select value={seg.reward_type} onValueChange={v => updateSegment(i, "reward_type", v)}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nada</SelectItem>
                          <SelectItem value="credits">Créditos</SelectItem>
                          <SelectItem value="balance">Saldo (R$)</SelectItem>
                          <SelectItem value="multiplier">Multiplicador</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Valor"
                        value={seg.result}
                        onChange={e => updateSegment(i, "result", Number(e.target.value))}
                        className="text-xs"
                        min={0}
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="Peso"
                          value={seg.weight}
                          onChange={e => updateSegment(i, "weight", Number(e.target.value))}
                          className="text-xs"
                          min={0.1}
                          step={0.1}
                        />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {totalWeight > 0 ? ((seg.weight / totalWeight) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSegment(i)}
                      className="text-destructive hover:text-destructive/70 p-1"
                      disabled={editingSegments.length <= 2}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1">
                <Save size={16} className="mr-2" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Roleta"}
              </Button>
              <Button variant="outline" onClick={() => setEditingSegments(null)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* No roulette yet */}
        {!challenge && !editingSegments && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-4xl mb-3">🎰</p>
              <p className="text-lg font-bold text-foreground mb-2">Nenhuma roleta configurada</p>
              <p className="text-sm text-muted-foreground mb-4">Crie sua primeira roleta para os usuários jogarem.</p>
              <Button onClick={startEditing}>Criar Roleta</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminRoulettePage;
