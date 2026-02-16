import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Copy, CheckCircle, Clock, Share2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const ReferralsPage = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("referrals").select("*, referred:profiles!referrals_referred_id_fkey(name)").eq("referrer_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setReferrals(data || []));
  }, [user]);

  const copyCode = () => {
    navigator.clipboard.writeText(user?.referral_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const approved = referrals.filter((r) => r.status === "approved").length;
  const pending = referrals.filter((r) => r.status === "pending").length;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="text-accent" /> Indicações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Indique amigos e ganhe recompensas</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 glass-card glow-border rounded-xl p-6 text-center">
        <Share2 size={32} className="mx-auto mb-3 text-primary" />
        <h2 className="mb-1 font-display text-sm tracking-wider text-muted-foreground">SEU CÓDIGO DE INDICAÇÃO</h2>
        <p className="mb-4 font-display text-3xl font-bold text-gradient-primary">{user?.referral_code}</p>
        <button onClick={copyCode} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110">
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied ? "Copiado!" : "Copiar Código"}
        </button>
      </motion.div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-success">{approved}</p>
          <p className="text-xs text-muted-foreground">Aprovadas</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-warning">{pending}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">SUAS INDICAÇÕES</h2>
        <div className="space-y-3">
          {referrals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma indicação ainda.</p>}
          {referrals.map((ref) => (
            <div key={ref.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                {ref.status === "approved" ? <CheckCircle size={18} className="text-success" /> : <Clock size={18} className="text-warning" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{ref.referred?.name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ref.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${ref.status === "approved" ? "text-success" : "text-warning"}`}>
                {ref.status === "approved" ? `+R$ ${Number(ref.reward_amount).toFixed(2)}` : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ReferralsPage;
