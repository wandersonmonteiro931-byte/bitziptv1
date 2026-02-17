import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, ShoppingCart, Sparkles, Copy, Check, Clock, Crown, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const levelColors: Record<string, string> = {
  bronze: "text-orange-400",
  prata: "text-gray-300",
  ouro: "text-yellow-400",
  diamante: "text-cyan-300",
};

const levelIcons: Record<string, string> = {
  bronze: "🥉",
  prata: "🥈",
  ouro: "🥇",
  diamante: "💎",
};

const CreditsStorePage = () => {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [copiedPix, setCopiedPix] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{ pix_code: string; total_credits: number; price: number } | null>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["credit-packages"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_packages").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ["credit-promotions"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("credit_promotions").select("*").eq("is_active", true).lte("starts_at", now).gte("ends_at", now);
      return data || [];
    },
  });

  const { data: myPurchases = [] } = useQuery({
    queryKey: ["my-credit-purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_purchases").select("*, credit_packages(name)").eq("user_id", user?.id).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "purchase_credits", data: { package_id: packageId } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setPurchaseResult(data);
      queryClient.invalidateQueries({ queryKey: ["my-credit-purchases"] });
      toast({ title: "Pedido criado!", description: "Copie o código PIX e efetue o pagamento" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const copyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPix(code);
    toast({ title: "PIX copiado!" });
    setTimeout(() => setCopiedPix(null), 2000);
  };

  const activePromo = promotions.length > 0 ? promotions[0] : null;
  const userLevel = (user as any)?.user_level || "bronze";
  const userCredits = (user as any)?.credits || 0;
  const isVip = (user as any)?.vip_badge || false;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Diamond className="text-primary" /> Loja de Créditos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Adquira créditos para participar de desafios e ganhar recompensas</p>
      </div>

      {/* Credit Balance + Level */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="stat-card rounded-xl p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Seus Créditos</p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">{userCredits}</p>
            </div>
            <div className="rounded-full bg-primary/15 p-3">
              <Diamond size={24} className="text-primary" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="stat-card rounded-xl p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Seu Nível</p>
              <p className={`mt-1 font-display text-2xl font-bold capitalize ${levelColors[userLevel]}`}>
                {levelIcons[userLevel]} {userLevel}
              </p>
            </div>
            {isVip && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <Crown size={12} className="mr-1" /> VIP
              </Badge>
            )}
          </div>
        </motion.div>
      </div>

      {/* Active Promotion Banner */}
      {activePromo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="text-yellow-400" size={20} />
            <span className="font-bold text-yellow-400">{activePromo.title}</span>
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">+{activePromo.bonus_percentage}% bônus</Badge>
          </div>
          <p className="mt-1 text-sm text-yellow-400/70">{activePromo.description}</p>
        </motion.div>
      )}

      {/* Disclaimer */}
      <div className="mb-6 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        ⚠️ Créditos são moeda interna da plataforma, não expiram. Não há promessa de lucro garantido. Recompensas são promocionais.
      </div>

      {/* Purchase Result Modal */}
      <AnimatePresence>
        {purchaseResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setPurchaseResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-lg font-bold text-foreground mb-4 text-center">Pagamento PIX</h3>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-primary">R$ {Number(purchaseResult.price).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">{purchaseResult.total_credits} créditos</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 mb-4">
                <p className="text-xs text-muted-foreground mb-1">PIX Copia e Cola:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-foreground break-all">{purchaseResult.pix_code}</code>
                  <button
                    onClick={() => copyPix(purchaseResult.pix_code)}
                    className="rounded-lg bg-primary/15 p-2 text-primary hover:bg-primary/25 transition-colors"
                  >
                    {copiedPix === purchaseResult.pix_code ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mb-4">
                Após o pagamento, o admin confirmará e seus créditos serão creditados automaticamente.
              </p>
              <button
                onClick={() => setPurchaseResult(null)}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 transition-all"
              >
                Entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Packages Grid */}
      <h2 className="mb-4 font-display text-lg font-bold text-foreground">Pacotes Disponíveis</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg: any, i: number) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="stat-card rounded-xl p-5 flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-foreground">{pkg.name}</h3>
                <p className="text-2xl font-display font-bold text-primary mt-1">{pkg.credits} <span className="text-sm">créditos</span></p>
              </div>
              <Star className="text-primary/40" size={24} />
            </div>
            {(pkg.bonus_credits > 0 || (activePromo && activePromo.bonus_percentage > 0)) && (
              <div className="mb-3 flex gap-2">
                {pkg.bonus_credits > 0 && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">+{pkg.bonus_credits} bônus</Badge>
                )}
                {activePromo && activePromo.bonus_percentage > 0 && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">+{Math.floor(pkg.credits * activePromo.bonus_percentage / 100)} promo</Badge>
                )}
              </div>
            )}
            <div className="mt-auto">
              <p className="text-xl font-bold text-foreground mb-3">R$ {Number(pkg.price).toFixed(2)}</p>
              <button
                onClick={() => purchaseMutation.mutate(pkg.id)}
                disabled={purchaseMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
              >
                <ShoppingCart size={16} /> Comprar
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Purchases */}
      {myPurchases.length > 0 && (
        <>
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">Compras Recentes</h2>
          <div className="space-y-2">
            {myPurchases.map((p: any) => (
              <div key={p.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{(p as any).credit_packages?.name || "Pacote"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{p.credits_amount + p.bonus_amount} 💎</span>
                  <Badge className={
                    p.status === "confirmed" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                    p.status === "cancelled" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  }>
                    {p.status === "confirmed" ? "Confirmado" : p.status === "cancelled" ? "Cancelado" : "Pendente"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default CreditsStorePage;
