import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Copy, CheckCircle, Clock, Share2 } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const referrals = [
  { name: "Maria Santos", status: "approved", date: "2025-01-15", reward: 5.0 },
  { name: "Carlos Oliveira", status: "approved", date: "2025-01-20", reward: 5.0 },
  { name: "Ana Costa", status: "pending", date: "2025-02-10", reward: 5.0 },
];

const ReferralsPage = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(user?.referralCode || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="text-accent" /> Indicações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Indique amigos e ganhe recompensas</p>
      </div>

      {/* Referral Code Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 glass-card glow-border rounded-xl p-6 text-center"
      >
        <Share2 size={32} className="mx-auto mb-3 text-primary" />
        <h2 className="mb-1 font-display text-sm tracking-wider text-muted-foreground">SEU CÓDIGO DE INDICAÇÃO</h2>
        <p className="mb-4 font-display text-3xl font-bold text-gradient-primary">{user?.referralCode}</p>
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
        >
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied ? "Copiado!" : "Copiar Código"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">Cada indicação aprovada = R$ 5,00</p>
      </motion.div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">3</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-success">2</p>
          <p className="text-xs text-muted-foreground">Aprovadas</p>
        </div>
        <div className="stat-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-warning">1</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
      </div>

      {/* List */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">SUAS INDICAÇÕES</h2>
        <div className="space-y-3">
          {referrals.map((ref, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                {ref.status === "approved" ? (
                  <CheckCircle size={18} className="text-success" />
                ) : (
                  <Clock size={18} className="text-warning" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{ref.name}</p>
                  <p className="text-xs text-muted-foreground">{ref.date}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${ref.status === "approved" ? "text-success" : "text-warning"}`}>
                {ref.status === "approved" ? `+R$ ${ref.reward.toFixed(2)}` : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default ReferralsPage;
