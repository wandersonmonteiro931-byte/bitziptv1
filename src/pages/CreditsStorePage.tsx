import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Diamond, ShoppingCart, Sparkles, Copy, Check, Crown, Star, Loader2, Wallet } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBRT } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

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
  const { user, applyProfilePatch } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copiedPix, setCopiedPix] = useState<string | null>(null);

  // PIX modal state
  const [pixModal, setPixModal] = useState<{
    purchaseId: string;
    totalCredits: number;
    price: number;
  } | null>(null);
  const [pixData, setPixData] = useState<{
    qrcode: string;
    qrcode_image: string;
    txid: string;
  } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);

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

  // Create purchase record and generate PIX charge
  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const { data, error } = await supabase.functions.invoke("credit-system", {
        body: { action: "purchase_credits", data: { package_id: packageId } },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-credit-purchases"] });

      // Find the purchase we just created
      const { data: purchases } = await supabase
        .from("credit_purchases")
        .select("id")
        .eq("user_id", user?.id)
        .eq("pix_code", data.pix_code)
        .order("created_at", { ascending: false })
        .limit(1);

      const purchaseId = purchases?.[0]?.id;
      if (!purchaseId) {
        toast({ title: "Erro", description: "Compra criada mas não encontrada", variant: "destructive" });
        return;
      }

      // Open PIX modal and generate Efi charge
      setPixModal({ purchaseId, totalCredits: data.total_credits, price: data.price });
      setPixLoading(true);
      setPixError(null);
      setPixData(null);
      setPaymentConfirmed(false);
      setTimeLeft(3600);

      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const token = (await supabase.auth.getSession()).data.session?.access_token;

        const resp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/pix-efi/create-credit-charge`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              purchase_id: purchaseId,
              amount: data.price,
              descricao: `Compra de ${data.total_credits} créditos - Bitz TV`,
            }),
          }
        );

        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || "Falha ao gerar PIX");

        setPixData({
          qrcode: result.qrcode,
          qrcode_image: result.qrcode_image,
          txid: result.txid,
        });
      } catch (err: any) {
        setPixError(err.message);
      } finally {
        setPixLoading(false);
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Confirmação por ordem enviada pelo webhook/Edge Function.
  // Não consulta status em loop e não usa polling.
  useEffect(() => {
    if (!pixModal || !pixData || paymentConfirmed) return;

    let active = true;
    const purchaseId = pixModal.purchaseId;

    const applyConfirmationCommand = (payload: any) => {
      if (!active || !payload || payload.purchase_id !== purchaseId) return;
      if (payload.status !== "confirmed") return;

      setPaymentConfirmed(true);

      const patch = payload.profile_patch || {};
      if (payload.credits_after !== undefined) patch.credits = Number(payload.credits_after);
      if (payload.level_points_after !== undefined) patch.level_points = Number(payload.level_points_after);
      if (payload.user_level !== undefined) patch.user_level = payload.user_level;
      if (payload.vip_badge !== undefined) patch.vip_badge = Boolean(payload.vip_badge);
      if (Object.keys(patch).length > 0) applyProfilePatch(patch);

      if (payload.purchase) {
        queryClient.setQueryData<any[]>(["my-credit-purchases"], (current = []) => {
          const withoutCurrent = current.filter((item) => item.id !== payload.purchase.id);
          return [payload.purchase, ...withoutCurrent].slice(0, 10);
        });
      }
    };

    const onFinanceCommand = (event: Event) => applyConfirmationCommand((event as CustomEvent)?.detail);
    window.addEventListener("wmcplayer-finance-updated", onFinanceCommand);

    return () => {
      active = false;
      window.removeEventListener("wmcplayer-finance-updated", onFinanceCommand);
    };
  }, [pixModal?.purchaseId, pixData, paymentConfirmed, applyProfilePatch, queryClient]);

  // Timer countdown
  useEffect(() => {
    if (!pixModal || paymentConfirmed) return;
    const t = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(t);
  }, [pixModal, paymentConfirmed]);

  const closePixModal = useCallback(async () => {
    // Delete unpaid purchase
    if (pixModal && !paymentConfirmed) {
      await supabase.from("credit_purchases").delete().eq("id", pixModal.purchaseId).eq("status", "pending");
    }
    setPixModal(null);
    setPixData(null);
    setPixError(null);
    setPaymentConfirmed(false);
  }, [pixModal, paymentConfirmed]);

  const copyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPix(code);
    toast({ title: "PIX copiado!" });
    setTimeout(() => setCopiedPix(null), 2000);
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
              <p className="text-xs text-muted-foreground">Saldo Real</p>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-400">
                R$ {Number(user?.balance || 0).toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => navigate("/withdrawals")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/25 active:scale-95"
            >
              <Wallet size={14} /> Sacar
            </button>
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

      {/* PIX Payment Modal */}
      <AnimatePresence>
        {pixModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={closePixModal}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {paymentConfirmed ? (
                <div className="text-center py-4">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 2, duration: 0.5 }} className="text-6xl mb-4">🎉</motion.div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">Pagamento Confirmado!</h3>
                  <p className="text-3xl font-bold text-primary mb-2">{pixModal.totalCredits} 💎</p>
                  <p className="text-sm text-muted-foreground mb-4">Créditos adicionados à sua conta!</p>
                  <button onClick={closePixModal} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 transition-all">
                    Fechar
                  </button>
                </div>
              ) : pixLoading ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 size={32} className="animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
                </div>
              ) : pixError ? (
                <div className="text-center py-4">
                  <p className="text-destructive font-medium mb-3">{pixError}</p>
                  <button onClick={closePixModal} className="w-full rounded-lg bg-muted px-4 py-2.5 text-sm text-foreground">Fechar</button>
                </div>
              ) : pixData ? (
                <>
                  <h3 className="font-display text-lg font-bold text-foreground mb-4 text-center">Pagamento PIX</h3>
                  <div className="text-center mb-4">
                    <p className="text-3xl font-bold text-primary">R$ {Number(pixModal.price).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{pixModal.totalCredits} créditos 💎</p>
                    <p className="text-xs text-muted-foreground mt-1">Expira em {formatTime(timeLeft)}</p>
                  </div>

                  {/* QR Code image */}
                  {pixData.qrcode_image && (
                    <div className="flex justify-center mb-4">
                      <img src={pixData.qrcode_image} alt="QR Code PIX" className="w-48 h-48 rounded-lg" />
                    </div>
                  )}

                  {/* PIX Copia e Cola */}
                  <div className="rounded-lg bg-muted/50 p-3 mb-4">
                    <p className="text-xs text-muted-foreground mb-1">PIX Copia e Cola:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-foreground break-all line-clamp-3">{pixData.qrcode}</code>
                      <button
                        onClick={() => copyPix(pixData.qrcode)}
                        className="rounded-lg bg-primary/15 p-2 text-primary hover:bg-primary/25 transition-colors shrink-0"
                      >
                        {copiedPix === pixData.qrcode ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-center mb-4">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs text-muted-foreground">Aguardando pagamento...</p>
                  </div>

                  <button onClick={closePixModal} className="w-full rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/70 transition-all">
                    Cancelar
                  </button>
                </>
              ) : null}
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
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">+{pkg.bonus_credits} bônus</Badge>
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
                disabled={purchaseMutation.isPending || !!pixModal}
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
                  <p className="text-xs text-muted-foreground">{formatDateTimeBRT(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{p.credits_amount + p.bonus_amount} 💎</span>
                  <Badge className={
                    p.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
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
