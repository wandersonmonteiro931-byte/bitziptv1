import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, Package, Settings, Users, TrendingUp, Check, X, Plus, Trash2, Edit, ShieldCheck, Ban, Sparkles, Gamepad2, BarChart3 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

const AdminCreditsPage = () => {
  const queryClient = useQueryClient();
  const [editPkg, setEditPkg] = useState<any>(null);
  const [newPkg, setNewPkg] = useState({ name: "", credits: 0, price: 0, bonus_credits: 0, sort_order: 0 });
  const [showNewPkg, setShowNewPkg] = useState(false);
  const [editChallenge, setEditChallenge] = useState<any>(null);
  const [adjustUser, setAdjustUser] = useState<{ id: string; name: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [newPromo, setNewPromo] = useState({ title: "", description: "", bonus_percentage: 0, ends_at: "" });
  const [showNewPromo, setShowNewPromo] = useState(false);

  // Queries
  const { data: packages = [] } = useQuery({
    queryKey: ["admin-credit-packages"],
    queryFn: async () => { const { data } = await supabase.from("credit_packages").select("*").order("sort_order"); return data || []; },
  });

  const { data: pendingPurchases = [] } = useQuery({
    queryKey: ["admin-pending-purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_purchases").select("*, profiles(name, username), credit_packages(name)").eq("status", "pending").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin-credit-challenges"],
    queryFn: async () => { const { data } = await supabase.from("credit_challenges").select("*").order("created_at"); return data || []; },
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ["admin-credit-promotions"],
    queryFn: async () => { const { data } = await supabase.from("credit_promotions").select("*").order("created_at", { ascending: false }); return data || []; },
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-credit-settings"],
    queryFn: async () => { const { data } = await supabase.from("credit_settings").select("*").limit(1).single(); return data; },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-credit-stats"],
    queryFn: async () => {
      const { data: confirmed } = await supabase.from("credit_purchases").select("price, credits_amount").eq("status", "confirmed");
      const totalRevenue = confirmed?.reduce((s, p) => s + Number(p.price), 0) || 0;
      const totalSold = confirmed?.reduce((s, p) => s + p.credits_amount, 0) || 0;
      const { data: profiles } = await supabase.from("profiles").select("credits");
      const totalCirculating = profiles?.reduce((s, p: any) => s + (p.credits || 0), 0) || 0;
      return { totalRevenue, totalSold, totalCirculating, totalPurchases: confirmed?.length || 0 };
    },
  });

  // Mutations
  const confirmPurchase = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "confirm_purchase", data: { purchase_id: purchaseId } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Compra confirmada!" });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin-credit-stats"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelPurchase = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "cancel_purchase", data: { purchase_id: purchaseId } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Compra cancelada" });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-purchases"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const adjustCredits = useMutation({
    mutationFn: async () => {
      if (!adjustUser) return;
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "admin_adjust_credits", data: { user_id: adjustUser.id, amount: Number(adjustAmount), description: adjustDesc } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Créditos ajustados!" });
      setAdjustUser(null); setAdjustAmount(""); setAdjustDesc("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const savePkg = async (pkg: any) => {
    const { error } = await supabase.from("credit_packages").update({
      name: pkg.name, credits: pkg.credits, price: pkg.price, bonus_credits: pkg.bonus_credits, sort_order: pkg.sort_order, is_active: pkg.is_active,
    }).eq("id", pkg.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Pacote atualizado!" });
    setEditPkg(null);
    queryClient.invalidateQueries({ queryKey: ["admin-credit-packages"] });
  };

  const createPkg = async () => {
    const { error } = await supabase.from("credit_packages").insert(newPkg);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Pacote criado!" });
    setShowNewPkg(false); setNewPkg({ name: "", credits: 0, price: 0, bonus_credits: 0, sort_order: 0 });
    queryClient.invalidateQueries({ queryKey: ["admin-credit-packages"] });
  };

  const deletePkg = async (id: string) => {
    await supabase.from("credit_packages").delete().eq("id", id);
    toast({ title: "Pacote removido" });
    queryClient.invalidateQueries({ queryKey: ["admin-credit-packages"] });
  };

  const saveChallenge = async (ch: any) => {
    const { error } = await supabase.from("credit_challenges").update({
      name: ch.name, cost_credits: ch.cost_credits, is_active: ch.is_active, description: ch.description, icon: ch.icon,
      probabilities: ch.probabilities, min_level: ch.min_level, daily_limit: ch.daily_limit,
      turbo_multiplier: ch.turbo_multiplier, turbo_duration_minutes: ch.turbo_duration_minutes,
    }).eq("id", ch.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Desafio atualizado!" });
    setEditChallenge(null);
    queryClient.invalidateQueries({ queryKey: ["admin-credit-challenges"] });
  };

  const createPromo = async () => {
    const { error } = await supabase.from("credit_promotions").insert({
      ...newPromo, starts_at: new Date().toISOString(),
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Promoção criada!" });
    setShowNewPromo(false); setNewPromo({ title: "", description: "", bonus_percentage: 0, ends_at: "" });
    queryClient.invalidateQueries({ queryKey: ["admin-credit-promotions"] });
  };

  const togglePromo = async (id: string, active: boolean) => {
    await supabase.from("credit_promotions").update({ is_active: !active }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-credit-promotions"] });
  };

  // Users for adjust
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-credits"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("id, name, username, credits, user_level, vip_badge, credit_purchases_blocked"); return data || []; },
  });

  const toggleBlock = async (userId: string, blocked: boolean) => {
    const { data, error } = await supabase.functions.invoke("credit-system", {
      body: { action: "toggle_purchase_block", data: { user_id: userId, blocked: !blocked } },
    });
    if (error || data?.error) { toast({ title: "Erro", variant: "destructive" }); return; }
    toast({ title: blocked ? "Compra desbloqueada" : "Compra bloqueada" });
    queryClient.invalidateQueries({ queryKey: ["admin-users-credits"] });
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Diamond className="text-primary" /> Sistema de Créditos
        </h1>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Receita Total", value: `R$ ${(stats?.totalRevenue || 0).toFixed(2)}`, icon: TrendingUp, color: "text-green-400" },
          { label: "Créditos Vendidos", value: stats?.totalSold || 0, icon: Package, color: "text-primary" },
          { label: "Em Circulação", value: stats?.totalCirculating || 0, icon: Diamond, color: "text-yellow-400" },
          { label: "Compras", value: stats?.totalPurchases || 0, icon: BarChart3, color: "text-cyan-400" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card rounded-xl p-4">
            <s.icon size={18} className={s.color} />
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            <p className="font-display text-lg font-bold text-foreground">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Pending Purchases Alert */}
      {pendingPurchases.length > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <h3 className="font-bold text-yellow-400 mb-3">⏳ {pendingPurchases.length} compra(s) pendente(s)</h3>
          <div className="space-y-2">
            {pendingPurchases.map((p: any) => (
              <div key={p.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{(p as any).profiles?.name} (@{(p as any).profiles?.username})</p>
                  <p className="text-xs text-muted-foreground">{(p as any).credit_packages?.name} • R$ {Number(p.price).toFixed(2)} • {p.credits_amount + p.bonus_amount} créditos</p>
                  <p className="text-xs text-muted-foreground">PIX: {p.pix_code}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => confirmPurchase.mutate(p.id)} className="rounded-lg bg-green-500/20 p-2 text-green-400 hover:bg-green-500/30"><Check size={16} /></button>
                  <button onClick={() => cancelPurchase.mutate(p.id)} className="rounded-lg bg-red-500/20 p-2 text-red-400 hover:bg-red-500/30"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="packages">
        <TabsList className="mb-4 w-full grid grid-cols-5">
          <TabsTrigger value="packages"><Package size={14} className="mr-1" />Pacotes</TabsTrigger>
          <TabsTrigger value="challenges"><Gamepad2 size={14} className="mr-1" />Desafios</TabsTrigger>
          <TabsTrigger value="users"><Users size={14} className="mr-1" />Usuários</TabsTrigger>
          <TabsTrigger value="promotions"><Sparkles size={14} className="mr-1" />Promoções</TabsTrigger>
          <TabsTrigger value="settings"><Settings size={14} className="mr-1" />Config</TabsTrigger>
        </TabsList>

        {/* PACKAGES TAB */}
        <TabsContent value="packages">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground">Pacotes de Créditos</h2>
            <button onClick={() => setShowNewPkg(true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"><Plus size={14} /> Novo</button>
          </div>
          {showNewPkg && (
            <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
              <input className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Nome" value={newPkg.name} onChange={e => setNewPkg({...newPkg, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Créditos" value={newPkg.credits || ""} onChange={e => setNewPkg({...newPkg, credits: Number(e.target.value)})} />
                <input type="number" className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Preço R$" value={newPkg.price || ""} onChange={e => setNewPkg({...newPkg, price: Number(e.target.value)})} />
                <input type="number" className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Bônus" value={newPkg.bonus_credits || ""} onChange={e => setNewPkg({...newPkg, bonus_credits: Number(e.target.value)})} />
                <input type="number" className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Ordem" value={newPkg.sort_order || ""} onChange={e => setNewPkg({...newPkg, sort_order: Number(e.target.value)})} />
              </div>
              <div className="flex gap-2">
                <button onClick={createPkg} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Criar</button>
                <button onClick={() => setShowNewPkg(false)} className="rounded-lg bg-muted px-4 py-2 text-xs text-foreground">Cancelar</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {packages.map((pkg: any) => (
              <div key={pkg.id} className="glass-card rounded-lg p-3">
                {editPkg?.id === pkg.id ? (
                  <div className="space-y-2">
                    <input className="w-full rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" value={editPkg.name} onChange={e => setEditPkg({...editPkg, name: e.target.value})} />
                    <div className="grid grid-cols-4 gap-2">
                      <input type="number" className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" value={editPkg.credits} onChange={e => setEditPkg({...editPkg, credits: Number(e.target.value)})} />
                      <input type="number" className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" value={editPkg.price} onChange={e => setEditPkg({...editPkg, price: Number(e.target.value)})} />
                      <input type="number" className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" value={editPkg.bonus_credits} onChange={e => setEditPkg({...editPkg, bonus_credits: Number(e.target.value)})} />
                      <label className="flex items-center gap-1 text-xs text-foreground"><input type="checkbox" checked={editPkg.is_active} onChange={e => setEditPkg({...editPkg, is_active: e.target.checked})} /> Ativo</label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => savePkg(editPkg)} className="rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Salvar</button>
                      <button onClick={() => setEditPkg(null)} className="rounded bg-muted px-3 py-1 text-xs text-foreground">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{pkg.name} {!pkg.is_active && <Badge variant="outline" className="ml-1 text-xs">Inativo</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{pkg.credits} créditos + {pkg.bonus_credits} bônus • R$ {Number(pkg.price).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditPkg({...pkg})} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"><Edit size={14} /></button>
                      <button onClick={() => deletePkg(pkg.id)} className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* CHALLENGES TAB */}
        <TabsContent value="challenges">
          <h2 className="font-bold text-foreground mb-4">Desafios & Probabilidades</h2>
          <div className="space-y-3">
            {challenges.map((ch: any) => (
              <div key={ch.id} className="glass-card rounded-xl p-4">
                {editChallenge?.id === ch.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" placeholder="Nome" value={editChallenge.name} onChange={e => setEditChallenge({...editChallenge, name: e.target.value})} />
                      <input type="number" className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" placeholder="Custo" value={editChallenge.cost_credits} onChange={e => setEditChallenge({...editChallenge, cost_credits: Number(e.target.value)})} />
                    </div>
                    <textarea className="w-full rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" placeholder="Descrição" value={editChallenge.description} onChange={e => setEditChallenge({...editChallenge, description: e.target.value})} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" placeholder="Ícone" value={editChallenge.icon} onChange={e => setEditChallenge({...editChallenge, icon: e.target.value})} />
                      <select className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" value={editChallenge.min_level} onChange={e => setEditChallenge({...editChallenge, min_level: e.target.value})}>
                        <option value="bronze">Bronze</option><option value="prata">Prata</option><option value="ouro">Ouro</option><option value="diamante">Diamante</option>
                      </select>
                      <input type="number" className="rounded bg-muted/50 border border-border px-2 py-1 text-sm text-foreground" placeholder="Limite/dia (0=∞)" value={editChallenge.daily_limit} onChange={e => setEditChallenge({...editChallenge, daily_limit: Number(e.target.value)})} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Probabilidades (JSON):</p>
                      <textarea className="w-full rounded bg-muted/50 border border-border px-2 py-1 text-xs text-foreground font-mono h-24" value={JSON.stringify(editChallenge.probabilities, null, 2)}
                        onChange={e => { try { setEditChallenge({...editChallenge, probabilities: JSON.parse(e.target.value)}); } catch {} }} />
                    </div>
                    <label className="flex items-center gap-1 text-xs text-foreground"><input type="checkbox" checked={editChallenge.is_active} onChange={e => setEditChallenge({...editChallenge, is_active: e.target.checked})} /> Ativo</label>
                    <div className="flex gap-2">
                      <button onClick={() => saveChallenge(editChallenge)} className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Salvar</button>
                      <button onClick={() => setEditChallenge(null)} className="rounded bg-muted px-3 py-1.5 text-xs text-foreground">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ch.icon} {ch.name} {!ch.is_active && <Badge variant="outline" className="ml-1">Inativo</Badge>}</p>
                      <p className="text-xs text-muted-foreground">Custo: {ch.cost_credits} 💎 • Nível: {ch.min_level} • Limite: {ch.daily_limit || "∞"}/dia</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(ch.probabilities as any[]).map((p: any, j: number) => (
                          <Badge key={j} variant="outline" className="text-xs">{p.label}: {p.weight}%</Badge>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setEditChallenge({...ch})} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"><Edit size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <h2 className="font-bold text-foreground mb-4">Créditos por Usuário</h2>
          {adjustUser && (
            <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
              <p className="text-sm text-foreground">Ajustar créditos de <strong>{adjustUser.name}</strong></p>
              <input type="number" className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Quantidade (positivo ou negativo)" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
              <input className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Motivo" value={adjustDesc} onChange={e => setAdjustDesc(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => adjustCredits.mutate()} disabled={!adjustAmount} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Ajustar</button>
                <button onClick={() => setAdjustUser(null)} className="rounded-lg bg-muted px-4 py-2 text-xs text-foreground">Cancelar</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {users.map((u: any) => (
              <div key={u.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {u.name} {u.vip_badge && <span className="text-yellow-400">👑</span>}
                    <Badge variant="outline" className="ml-1 text-xs capitalize">{u.user_level}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">@{u.username} • {u.credits} 💎</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setAdjustUser({ id: u.id, name: u.name })} className="rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10" title="Ajustar créditos"><Edit size={14} /></button>
                  <button onClick={() => toggleBlock(u.id, u.credit_purchases_blocked)} className={`rounded p-1.5 ${u.credit_purchases_blocked ? "text-red-400" : "text-muted-foreground"} hover:bg-muted/50`} title={u.credit_purchases_blocked ? "Desbloquear compra" : "Bloquear compra"}>
                    {u.credit_purchases_blocked ? <Ban size={14} /> : <ShieldCheck size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* PROMOTIONS TAB */}
        <TabsContent value="promotions">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground">Promoções</h2>
            <button onClick={() => setShowNewPromo(true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"><Plus size={14} /> Nova</button>
          </div>
          {showNewPromo && (
            <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
              <input className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Título" value={newPromo.title} onChange={e => setNewPromo({...newPromo, title: e.target.value})} />
              <input className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="Descrição" value={newPromo.description} onChange={e => setNewPromo({...newPromo, description: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" placeholder="% Bônus" value={newPromo.bonus_percentage || ""} onChange={e => setNewPromo({...newPromo, bonus_percentage: Number(e.target.value)})} />
                <input type="datetime-local" className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground" value={newPromo.ends_at} onChange={e => setNewPromo({...newPromo, ends_at: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <button onClick={createPromo} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Criar</button>
                <button onClick={() => setShowNewPromo(false)} className="rounded-lg bg-muted px-4 py-2 text-xs text-foreground">Cancelar</button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {promotions.map((p: any) => (
              <div key={p.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">+{p.bonus_percentage}% • Até {new Date(p.ends_at).toLocaleString("pt-BR")}</p>
                </div>
                <button onClick={() => togglePromo(p.id, p.is_active)} className={`rounded-lg px-3 py-1 text-xs font-bold ${p.is_active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {p.is_active ? "Ativa" : "Inativa"}
                </button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <h2 className="font-bold text-foreground mb-4">Configurações do Sistema</h2>
          {settings && (
            <SettingsForm settings={settings} onSave={(s) => {
              supabase.from("credit_settings").update(s).eq("id", settings.id).then(() => {
                toast({ title: "Configurações salvas!" });
                queryClient.invalidateQueries({ queryKey: ["admin-credit-settings"] });
              });
            }} />
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

function SettingsForm({ settings, onSave }: { settings: any; onSave: (s: any) => void }) {
  const [form, setForm] = useState({
    daily_purchase_limit: settings.daily_purchase_limit,
    vip_threshold: settings.vip_threshold,
    level_thresholds: JSON.stringify(settings.level_thresholds, null, 2),
  });
  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Limite diário de compra (créditos)</label>
        <input type="number" className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground mt-1" value={form.daily_purchase_limit} onChange={e => setForm({...form, daily_purchase_limit: Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Créditos para VIP</label>
        <input type="number" className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground mt-1" value={form.vip_threshold} onChange={e => setForm({...form, vip_threshold: Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Thresholds de nível (JSON)</label>
        <textarea className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-foreground font-mono mt-1 h-24" value={form.level_thresholds} onChange={e => setForm({...form, level_thresholds: e.target.value})} />
      </div>
      <button onClick={() => {
        try {
          onSave({ daily_purchase_limit: form.daily_purchase_limit, vip_threshold: form.vip_threshold, level_thresholds: JSON.parse(form.level_thresholds) });
        } catch { }
      }} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Salvar</button>
    </div>
  );
}

export default AdminCreditsPage;
