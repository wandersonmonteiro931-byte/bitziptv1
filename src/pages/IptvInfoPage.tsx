import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tv, Server, Smartphone, Calendar, User } from "lucide-react";
import { motion } from "framer-motion";

const IptvInfoPage = () => {
  const { user } = useAuth();

  const info = [
    { label: "Usuário IPTV", value: user?.iptv_user || "-", icon: User },
    { label: "Servidor", value: user?.iptv_server || "-", icon: Server },
    { label: "Aplicativo", value: user?.iptv_app || "-", icon: Smartphone },
    { label: "Vencimento", value: user?.iptv_expiry ? (() => { const [y, m, d] = user.iptv_expiry.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR"); })() : "-", icon: Calendar },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Tv className="text-secondary" /> Meu IPTV
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Informações da sua assinatura</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card glow-border rounded-xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <Tv size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Bitz IPTV</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${user?.status === "active" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
              {user?.status === "active" ? "Ativo" : user?.status === "suspended" ? "Suspenso" : "Bloqueado"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {info.map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/30 p-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <item.icon size={14} />
                <span className="text-xs">{item.label}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default IptvInfoPage;
