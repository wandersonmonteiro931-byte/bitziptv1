import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tv, Server, Smartphone, Calendar, User, Wifi, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { formatDateBRT } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFhdImageUrl } from "@/lib/imageQuality";
import { useAppBranding } from "@/hooks/useAppBranding";
import { forcePwaUpdateAndReload } from "@/lib/pwaForceUpdate";

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

const isOfficialWmcflixApp = (value: string | undefined, appTitle: string) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "wmcflix" || normalized === appTitle.toLowerCase();
};

const IptvInfoPage = () => {
  const { user } = useAuth();
  const { appName, logoUrl } = useAppBranding();
  const appTitle = (appName || "WMCPLAYER").trim().toUpperCase();
  const [providerInfo, setProviderInfo] = useState({ assist_plus_provider: "", blessed_player_provider: "" });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    supabase
      .from("support_settings")
      .select("assist_plus_provider, blessed_player_provider" as any)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setProviderInfo(data as any);
      });
  }, []);

  const appLogo = getAppLogo(user?.iptv_app);
  const tvAppIsWmcflix = isOfficialWmcflixApp(user?.iptv_tv_app, appTitle);
  const tvAppLogo = tvAppIsWmcflix ? logoUrl : getAppLogo(user?.iptv_tv_app);
  const displayedTvApp = tvAppIsWmcflix ? appTitle : user?.iptv_tv_app || "-";

  // Determine which provider to show based on user's TV app
  const getUserTvProvider = () => {
    const tvApp = (user?.iptv_tv_app || "").toLowerCase();
    if (tvApp.includes("assist")) return providerInfo.assist_plus_provider;
    if (tvApp.includes("blessed")) return providerInfo.blessed_player_provider;
    return "";
  };

  const tvProvider = getUserTvProvider();

  const info = [
    { label: "Usuário TV", value: user?.iptv_user || "-", icon: User },
    { label: "Servidor", value: user?.iptv_server || "-", icon: Server },
    { label: "Aplicativo", value: user?.iptv_app || "-", icon: Smartphone },
    { label: "App TV", value: displayedTvApp, icon: Tv },
    {
      label: "Validade",
      value: user?.iptv_expiry ? formatDateBRT(user.iptv_expiry + "T12:00:00") : "-",
      icon: Calendar,
    },
  ];

  const handleForceUpdate = async () => {
    if (checkingUpdate) return;

    setCheckingUpdate(true);
    setUpdateMessage("Verificando nova versão e limpando cache...");

    try {
      await forcePwaUpdateAndReload();
    } catch {
      setUpdateMessage("Cache limpo. Reabrindo app...");
      const url = new URL(window.location.href);
      url.searchParams.set("pwa_update", String(Date.now()));
      url.searchParams.set("force_update", "1");
      window.location.replace(url.toString());
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Tv className="text-red-500" /> Minha TV
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Informações da sua TV</p>

        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <button
            type="button"
            onClick={handleForceUpdate}
            disabled={checkingUpdate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/15 transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw size={16} className={checkingUpdate ? "animate-spin" : ""} />
            {checkingUpdate ? "Verificando atualização..." : "Verificar atualização do app"}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {checkingUpdate
              ? updateMessage || "Limpando cache e forçando nova versão..."
              : "Use este botão se o app não atualizar sozinho. Ele limpa o cache e reabre na versão nova se houver."}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card glow-border rounded-xl p-6"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
            {logoUrl ? (
              <img src={logoUrl} alt={appTitle} className="h-full w-full object-contain bg-black p-1" />
            ) : (
              <Tv size={24} className="text-red-500" />
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{appTitle}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${user?.status === "active" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
            >
              {user?.status === "active" ? "Ativo" : user?.status === "suspended" ? "Suspenso" : "Bloqueado"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {info.map((item) => (
            <div key={item.label} className="rounded-lg bg-black/80 p-4">
              <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                <item.icon size={14} />
                <span className="text-xs">{item.label}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Provider info */}
        {tvProvider && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Wifi size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-red-400">Provedor de Acesso</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{tvProvider}</p>
          </div>
        )}

        {(appLogo || tvAppLogo) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {appLogo && (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Aplicativo Mobile</p>
                <img
                  src={getFhdImageUrl(appLogo)}
                  alt={user?.iptv_app || "App"}
                  className="h-16 w-16 rounded-xl object-contain bg-black"
                />
                <p className="text-sm font-semibold text-foreground">{user?.iptv_app}</p>
              </div>
            )}
            {tvAppLogo && (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Aplicativo TV</p>
                <img
                  src={getFhdImageUrl(tvAppLogo)}
                  alt={displayedTvApp}
                  className="h-16 w-16 rounded-xl object-contain bg-black"
                />
                <p className="text-sm font-semibold text-foreground">{displayedTvApp}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default IptvInfoPage;
