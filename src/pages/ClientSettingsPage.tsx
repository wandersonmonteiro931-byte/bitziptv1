import { AppLayout } from "@/components/AppLayout";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
  type PushNotificationState,
} from "@/lib/pushNotifications";
import {
  APP_UPDATE_CHECK_EVENT,
  checkForAppUpdate,
  fetchPublishedAppVersion,
  getLocalBuildId,
  type PublishedAppVersion,
} from "@/lib/appVersion";

type UpdateStatus = "idle" | "checking" | "current" | "available" | "error";

const permissionLabels: Record<string, string> = {
  granted: "Permitida",
  denied: "Bloqueada",
  default: "Não solicitada",
  unsupported: "Indisponível",
};

export default function ClientSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [pushState, setPushState] = useState<PushNotificationState>({
    supported: false,
    permission: "unsupported",
    disabledByUser: false,
    subscribed: false,
    enabled: false,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [versionData, setVersionData] = useState<PublishedAppVersion>({});
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateMessage, setUpdateMessage] = useState("");

  const buildLabel = useMemo(() => {
    const buildId = String(
      versionData.buildId ||
        versionData.buildTimestamp ||
        versionData.version ||
        getLocalBuildId(),
    );
    return buildId || "não identificado";
  }, [versionData]);

  const appVersionLabel = useMemo(
    () => String(versionData.version || getLocalBuildId()),
    [versionData],
  );

  const refreshNotificationState = async () => {
    try {
      setPushState(await getPushNotificationState());
    } catch {
      setPushState((current) => ({ ...current, enabled: false, subscribed: false }));
    }
  };

  useEffect(() => {
    void refreshNotificationState();
    void (async () => {
      try {
        setVersionData(await fetchPublishedAppVersion());
      } catch {
        setVersionData({
          buildId: getLocalBuildId(),
          version: getLocalBuildId(),
          appName: "WMCPLAYER",
          displayVersionSource: "build-local",
        });
      }
    })();
  }, []);

  const enableNotifications = async () => {
    setLoadingNotifications(true);

    try {
      const state = await enablePushNotifications({
        userId: user?.id,
        requestPermission: true,
        forceServerSync: true,
      });
      setPushState(state);

      if (!state.enabled) {
        throw new Error("A inscrição não foi concluída.");
      }

      toast({
        title: "Notificações ativadas",
        description: "O WMCPLAYER já está inscrito para receber os avisos.",
      });
    } catch (error) {
      await refreshNotificationState();
      toast({
        title: "Não foi possível ativar",
        description:
          error instanceof Error
            ? error.message
            : "Verifique a permissão do aparelho e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingNotifications(false);
    }
  };

  const disableNotifications = async () => {
    setLoadingNotifications(true);

    try {
      const state = await disablePushNotifications();
      setPushState(state);
      toast({
        title: "Notificações desativadas",
        description:
          "No Android, o acesso ao aplicativo será bloqueado até que elas sejam ativadas novamente.",
      });
    } catch {
      toast({
        title: "Não foi possível desativar",
        description: "Tente novamente em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setLoadingNotifications(false);
    }
  };

  const verifyAppUpdates = async () => {
    setUpdateStatus("checking");
    setUpdateMessage("Consultando a versão publicada...");

    try {
      const result = await checkForAppUpdate();
      setVersionData(result.published);

      if (result.updateAvailable) {
        setUpdateStatus("available");
        setUpdateMessage("Existe uma atualização disponível. Abrindo a atualização obrigatória...");
        window.dispatchEvent(
          new CustomEvent(APP_UPDATE_CHECK_EVENT, { detail: result }),
        );
        toast({
          title: "Atualização disponível",
          description: "Atualize agora para usar a versão mais recente.",
        });
        return;
      }

      setUpdateStatus("current");
      setUpdateMessage("O aplicativo já está na versão mais recente.");
      toast({
        title: "Aplicativo atualizado",
        description: "Nenhuma atualização nova foi encontrada.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível verificar atualizações agora.";
      setUpdateStatus("error");
      setUpdateMessage(message);
      toast({
        title: "Falha ao verificar atualização",
        description: message,
        variant: "destructive",
      });
    }
  };

  const permissionLabel = permissionLabels[String(pushState.permission)] || String(pushState.permission);

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
            <p className="text-sm text-muted-foreground">
              Gerencie notificações, versão do aplicativo e informações técnicas.
            </p>
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
                  {pushState.enabled ? "Notificações ativas" : "Notificações desativadas"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permissão do aparelho:{" "}
                  <span className="font-medium text-foreground">{permissionLabel}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inscrição Push:{" "}
                  <span className="font-medium text-foreground">
                    {pushState.subscribed ? "Ativa" : "Inativa"}
                  </span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  No Android, as notificações são obrigatórias para avisos de pagamento,
                  liberação, vencimento e atualizações importantes.
                </p>
              </div>
              <div
                className={`mt-1 h-3 w-3 rounded-full ${
                  pushState.enabled ? "bg-emerald-400" : "bg-muted-foreground/40"
                }`}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={enableNotifications}
                disabled={loadingNotifications || pushState.enabled}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {loadingNotifications ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Bell size={16} />
                )}
                {pushState.enabled ? "Notificações ativas" : "Ativar notificações"}
              </button>

              <button
                type="button"
                onClick={disableNotifications}
                disabled={loadingNotifications || !pushState.enabled}
                className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-black px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/10 disabled:opacity-50"
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
              <span className="text-sm text-muted-foreground">Versão publicada</span>
              <span className="text-sm font-semibold text-foreground">{appVersionLabel}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">Build instalado</span>
              <span className="text-sm font-semibold text-foreground">{getLocalBuildId()}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">Build publicado</span>
              <span className="text-sm font-semibold text-foreground">{buildLabel}</span>
            </div>

            <button
              type="button"
              onClick={verifyAppUpdates}
              disabled={updateStatus === "checking"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {updateStatus === "checking" ? (
                <Loader2 size={17} className="animate-spin" />
              ) : updateStatus === "current" ? (
                <CheckCircle2 size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              {updateStatus === "checking" ? "Verificando..." : "Verificar atualizações"}
            </button>

            {updateMessage && (
              <p
                className={`rounded-xl border px-4 py-3 text-xs ${
                  updateStatus === "current"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : updateStatus === "error"
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-border/40 bg-muted/10 text-muted-foreground"
                }`}
              >
                {updateMessage}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/40 bg-black/90 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone size={18} /> Informações úteis
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-xl bg-muted/10 px-4 py-3">
              A engrenagem é exclusiva para configurações. A seção{" "}
              <strong className="text-foreground">Minha TV</strong> continua disponível no menu inferior.
            </div>
            <div className="rounded-xl bg-muted/10 px-4 py-3">
              A verificação de atualização acontece uma vez ao abrir o app e também quando você toca em{" "}
              <strong className="text-foreground">Verificar atualizações</strong>.
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
