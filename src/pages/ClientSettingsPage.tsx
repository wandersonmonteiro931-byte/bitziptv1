import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, ChevronLeft, Info, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PUSH_DISABLED_STORAGE = "wmcplayer_push_disabled_by_user";
const PUSH_VAPID_KEY_STORAGE = "wmcflix_push_vapid_key";
const PUSH_ENDPOINT_STORAGE = "wmcflix_push_endpoint";

declare const __BUILD_TIMESTAMP__: number;

type VersionPayload = {
  buildId?: string;
  buildTimestamp?: number;
  version?: string;
  appName?: string;
  displayVersionSource?: string;
};

export default function ClientSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "indisponível");
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [versionData, setVersionData] = useState<VersionPayload>({});

  const buildLabel = useMemo(() => {
    const buildId = String(versionData.buildId || versionData.buildTimestamp || versionData.version || __BUILD_TIMESTAMP__ || "");
    return buildId || "não identificado";
  }, [versionData]);

  const appVersionLabel = useMemo(() => {
    return String(versionData.version || `build-${String(__BUILD_TIMESTAMP__ || "local")}`);
  }, [versionData]);

  const refreshNotificationState = async () => {
    const disabledByUser = typeof window !== "undefined" && localStorage.getItem(PUSH_DISABLED_STORAGE) === "1";
    const permission = typeof Notification !== "undefined" ? Notification.permission : "indisponível";
    setPermissionState(permission);

    if (disabledByUser || permission !== "granted" || !("serviceWorker" in navigator)) {
      setNotificationsEnabled(false);
      return;
    }

    const registration = (await navigator.serviceWorker.getRegistration("/app/")) || (await navigator.serviceWorker.getRegistration());
    const subscription = await registration?.pushManager.getSubscription();
    setNotificationsEnabled(Boolean(subscription));
  };

  useEffect(() => {
    void refreshNotificationState();
    void (async () => {
      try {
        const response = await fetch(`/app/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as VersionPayload;
          setVersionData(payload || {});
        }
      } catch {
        setVersionData({ buildTimestamp: __BUILD_TIMESTAMP__, buildId: String(__BUILD_TIMESTAMP__), version: String(__BUILD_TIMESTAMP__) });
      }
    })();
  }, []);

  const enableNotifications = async () => {
    setLoadingToggle(true);
    try {
      localStorage.removeItem(PUSH_DISABLED_STORAGE);
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        toast({
          title: "Notificações não permitidas",
          description: "Permita as notificações para continuar recebendo avisos do WMCPLAYER.",
        });
        await refreshNotificationState();
        return;
      }

      toast({
        title: "Notificações ativadas",
        description: "Atualizando o aplicativo para concluir a inscrição do push.",
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Não foi possível ativar",
        description: "Tente novamente em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setLoadingToggle(false);
    }
  };

  const disableNotifications = async () => {
    setLoadingToggle(true);
    try {
      localStorage.setItem(PUSH_DISABLED_STORAGE, "1");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const registration = (await navigator.serviceWorker.getRegistration("/app/")) || (await navigator.serviceWorker.getRegistration());
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint || localStorage.getItem(PUSH_ENDPOINT_STORAGE) || "";

      if (endpoint && session?.access_token) {
        await supabase.functions.invoke("push-notification", {
          body: { action: "unsubscribe", endpoint },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }

      if (subscription) {
        await subscription.unsubscribe().catch(() => undefined);
      }

      localStorage.removeItem(PUSH_VAPID_KEY_STORAGE);
      localStorage.removeItem(PUSH_ENDPOINT_STORAGE);
      setNotificationsEnabled(false);
      toast({
        title: "Notificações desativadas",
        description: "Você pode ativar novamente quando quiser na engrenagem de configurações.",
      });
      await refreshNotificationState();
    } catch {
      toast({
        title: "Não foi possível desativar",
        description: "Tente novamente em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setLoadingToggle(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 p-4 pb-24 md:p-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-black/80 text-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground">Gerencie notificações, versão do aplicativo e informações técnicas.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border/40 bg-black/90 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell size={18} /> Notificações
          </div>
          <div className="rounded-2xl bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {notificationsEnabled ? "Notificações ativas" : "Notificações desativadas"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permissão do navegador: <span className="font-medium text-foreground">{permissionState}</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ative para receber avisos do pagamento, liberação do suporte, atualizações e outros comunicados importantes.
                </p>
              </div>
              <div className={`mt-1 h-3 w-3 rounded-full ${notificationsEnabled ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={enableNotifications}
                disabled={loadingToggle}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
              >
                <Bell size={16} /> Ativar notificações
              </button>
              <button
                type="button"
                onClick={disableNotifications}
                disabled={loadingToggle}
                className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-black px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/10 disabled:opacity-60"
              >
                <BellOff size={16} /> Desativar notificações
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/40 bg-black/90 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Info size={18} /> Versão do aplicativo
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">Versão atual</span>
              <span className="text-sm font-semibold text-foreground">{appVersionLabel}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">Build do aplicativo</span>
              <span className="text-sm font-semibold text-foreground">{buildLabel}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">Origem da versão</span>
              <span className="text-sm font-semibold text-foreground">{versionData.displayVersionSource || "auto-build"}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/40 bg-black/90 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone size={18} /> Informações úteis
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-xl bg-muted/10 px-4 py-3">
              A engrenagem agora é exclusiva para configurações do aplicativo. A seção <strong className="text-foreground">Minha TV</strong> continua disponível no menu inferior.
            </div>
            <div className="rounded-xl bg-muted/10 px-4 py-3">
              No Android, se as notificações estiverem desativadas, você pode reativá-las nesta tela a qualquer momento.
            </div>
            <div className="rounded-xl bg-muted/10 px-4 py-3">
              Se precisar atualizar manualmente o aplicativo, use a opção de atualização obrigatória quando ela aparecer.
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
