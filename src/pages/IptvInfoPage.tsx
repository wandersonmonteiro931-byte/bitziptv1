import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tv, Server, Smartphone, Calendar, User } from "lucide-react";
import { motion } from "framer-motion";

import appAssistPlus from "@/assets/app-assist-plus.webp";
import appBlessedPlayer from "@/assets/app-blessed-player.png";
import appMaxPlayer from "@/assets/app-max-player.png";
import appSmarters from "@/assets/app-smarters-pro.png";

const APP_LOGOS: Record<string, string> = {
  "assist plus": appAssistPlus,
  "blessed player": appBlessedPlayer,
  "max player": appMaxPlayer,
  "smarters pro": appSmarters,
};

const getAppLogo = (appName: string | undefined) => {
  if (!appName) return null;
  const key = appName.toLowerCase().trim();
  for (const [k, v] of Object.entries(APP_LOGOS)) {
    if (key.includes(k)) return v;
  }
  return null;
};

const IptvInfoPage = () => {
  const { user } = useAuth();

  const appLogo = getAppLogo(user?.iptv_app || user?.iptv_tv_app);

  const info = [
    { label: "Usuário IPTV", value: user?.iptv_user || "-", icon: User },
    { label: "Servidor", value: user?.iptv_server || "-", icon: Server },
    { label: "Aplicativo", value: user?.iptv_app || "-", icon: Smartphone },
    { label: "Validade", value: user?.iptv_expiry ? (() => { const [y, m, d] = user.iptv_expiry.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR"); })() : "-", icon: Calendar },
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
          {appLogo ? (
            <img src={appLogo} alt={user?.iptv_app || "App"} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Tv size={24} className="text-primary" />
            </div>
          )}
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

        {appLogo && (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-lg bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Aplicativo parceiro</p>
            <img src={appLogo} alt={user?.iptv_app || "App"} className="h-16 w-16 rounded-xl object-cover" />
            <p className="text-sm font-semibold text-foreground">{user?.iptv_app || user?.iptv_tv_app}</p>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default IptvInfoPage;
