import { AppLayout } from "@/components/AppLayout";
import { Settings, Loader2, Tv, Bell, Send, Upload, Image as ImageIcon, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeAppBranding, previewAppBranding, saveStoredAppBranding } from "@/hooks/useAppBranding";

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // App identity / PWA branding
  const [appName, setAppName] = useState("");
  const [appShortName, setAppShortName] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appLogoUrl, setAppLogoUrl] = useState("");
  const [appFaviconUrl, setAppFaviconUrl] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingBranding, setUploadingBranding] = useState<"logo" | "favicon" | null>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  // Provider & observation
  const [supportSettings, setSupportSettings] = useState<any>(null);
  const [assistProvider, setAssistProvider] = useState("");
  const [blessedProvider, setBlessedProvider] = useState("");
  const [globalObservation, setGlobalObservation] = useState("");
  const [savingProviders, setSavingProviders] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("platform_settings").select("*").limit(1).single(),
      supabase.from("support_settings").select("*").limit(1).single(),
    ]).then(([ps, ss]) => {
      if (ps.data) {
        setSettings(ps.data);
        const branding = normalizeAppBranding(ps.data);
        setAppName(branding.appName);
        setAppShortName(branding.appShortName);
        setAppDescription(branding.appDescription);
        setAppLogoUrl(branding.logoUrl);
        setAppFaviconUrl(branding.faviconUrl);
        saveStoredAppBranding(branding);
        setBrandingLoaded(true);
      }
      if (ss.data) {
        setSupportSettings(ss.data);
        setAssistProvider((ss.data as any).assist_plus_provider || "");
        setBlessedProvider((ss.data as any).blessed_player_provider || "");
      }
    });
  }, []);

  useEffect(() => {
    if (!brandingLoaded) return;

    previewAppBranding({
      appName: appName.trim() || "Bitz IPTV",
      appShortName: appShortName.trim() || appName.trim() || "Bitz IPTV",
      appDescription: appDescription.trim() || `${appName.trim() || "Bitz IPTV"} - Programa de Fidelidade`,
      logoUrl: appLogoUrl.trim(),
      faviconUrl: appFaviconUrl.trim() || appLogoUrl.trim(),
    });
  }, [brandingLoaded, appName, appShortName, appDescription, appLogoUrl, appFaviconUrl]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase
      .from("platform_settings")
      .update({
        min_withdrawal: parseFloat(settings.min_withdrawal),
        referral_value: parseFloat(settings.referral_value),
        monthly_limit: parseFloat(settings.monthly_limit),
      })
      .eq("id", settings.id);
    setSaving(false);
    toast({ title: "Configurações salvas!" });
  };

  const uploadBrandingImage = async (file: File, type: "logo" | "favicon") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Envie uma imagem PNG, JPG, WEBP ou ICO.",
        variant: "destructive",
      });
      return;
    }

    setUploadingBranding(type);
    try {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `branding/${type}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      const url = data.publicUrl;
      if (type === "logo") setAppLogoUrl(url);
      if (type === "favicon") setAppFaviconUrl(url);

      toast({ title: type === "logo" ? "Logotipo enviado!" : "Favicon enviado!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar imagem", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingBranding(null);
    }
  };

  const saveBranding = async () => {
    if (!settings) return;

    const trimmedName = appName.trim();
    if (!trimmedName) {
      toast({ title: "Informe o nome do app", variant: "destructive" });
      return;
    }

    setSavingBranding(true);
    try {
      const payload = {
        app_name: trimmedName,
        app_short_name: appShortName.trim() || trimmedName,
        app_description: appDescription.trim() || `${trimmedName} - Programa de Fidelidade`,
        app_logo_url: appLogoUrl.trim(),
        app_favicon_url: appFaviconUrl.trim() || appLogoUrl.trim(),
      };

      const { error } = await supabase
        .from("platform_settings")
        .update(payload as any)
        .eq("id", settings.id);
      if (error) throw error;

      const branding = normalizeAppBranding(payload);
      saveStoredAppBranding(branding);
      setSettings({ ...settings, ...payload });
      toast({
        title: "Identidade do app salva!",
        description: "Nome, logotipo, favicon e dados de instalação foram atualizados.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar identidade",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingBranding(false);
    }
  };

  const saveProvidersAndNotify = async () => {
    if (!supportSettings) return;
    setSavingProviders(true);
    try {
      // 1. Save providers to support_settings
      await supabase
        .from("support_settings")
        .update({
          assist_plus_provider: assistProvider,
          blessed_player_provider: blessedProvider,
        } as any)
        .eq("id", supportSettings.id);

      // 2. Update admin_notes for ALL users if observation provided
      if (globalObservation.trim()) {
        const { data: allProfiles } = await supabase.from("profiles").select("id, iptv_user, iptv_password");
        if (allProfiles && allProfiles.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < allProfiles.length; i += batchSize) {
            const batch = allProfiles.slice(i, i + batchSize);
            const promises = batch.map((p) => {
              const note = globalObservation
                .trim()
                .replace(/\{\{USUARIO\}\}/gi, p.iptv_user || "")
                .replace(/\{\{SENHA\}\}/gi, p.iptv_password || "");
              return supabase.from("profiles").update({ admin_notes: note }).eq("id", p.id);
            });
            await Promise.all(promises);
          }
        }
      }

      // 3. Send push notification to ALL users
      setSendingNotification(true);
      const { data: notif } = await supabase
        .from("scheduled_notifications")
        .insert({
          title_template: "⚠️ ATENÇÃO!",
          body_template: "O provedor de acesso do APP da TV foram alterados. Acesse o APP e atualize sua TV.",
          click_action: "/iptv-info",
          target_type: "all",
          status: "draft",
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (notif) {
        const { data, error } = await supabase.functions.invoke("send-notification", {
          body: { notification_id: notif.id },
        });
        if (error) throw error;
        toast({
          title: "✅ Provedores atualizados e notificação enviada!",
          description: `${data?.sent || 0} notificação(ões) enviada(s)`,
        });
      } else {
        toast({ title: "✅ Provedores atualizados!" });
      }
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingProviders(false);
      setSendingNotification(false);
    }
  };

  if (!settings)
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );

  const inputCls =
    "w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Settings className="text-muted-foreground" /> Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurações gerais da plataforma</p>
      </div>

      {/* App Identity / Branding */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Smartphone size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Identidade do App</h2>
            <p className="text-xs text-muted-foreground">
              Altere nome, logotipo e favicon usados no navegador e na instalação do app.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Nome do App</h3>
              <input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Ex: BITZ IPTV"
                className={inputCls + " max-w-full"}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Esse nome aparece no topo, login, splash, navegador e instalação.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Nome curto para instalar</h3>
              <input
                value={appShortName}
                onChange={(e) => setAppShortName(e.target.value)}
                placeholder="Ex: BITZ"
                className={inputCls + " max-w-full"}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Descrição do App</h3>
              <input
                value={appDescription}
                onChange={(e) => setAppDescription(e.target.value)}
                placeholder="Descrição exibida em compartilhamentos e instalação"
                className={inputCls + " max-w-full"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ImageIcon size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Logotipo do App</h3>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                  onChange={(e) => e.target.files?.[0] && uploadBrandingImage(e.target.files[0], "logo")}
                  className="hidden"
                  id="app-logo-upload"
                />
                <label
                  htmlFor="app-logo-upload"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
                >
                  {uploadingBranding === "logo" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Enviar logotipo
                </label>
                <input
                  value={appLogoUrl}
                  onChange={(e) => setAppLogoUrl(e.target.value)}
                  placeholder="Ou cole a URL do logotipo"
                  className={inputCls + " mt-3 max-w-full text-xs"}
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ImageIcon size={16} className="text-secondary" />
                  <h3 className="text-sm font-semibold text-foreground">Favicon / Ícone ao Instalar</h3>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                  onChange={(e) => e.target.files?.[0] && uploadBrandingImage(e.target.files[0], "favicon")}
                  className="hidden"
                  id="app-favicon-upload"
                />
                <label
                  htmlFor="app-favicon-upload"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-all hover:brightness-110"
                >
                  {uploadingBranding === "favicon" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  Enviar favicon
                </label>
                <input
                  value={appFaviconUrl}
                  onChange={(e) => setAppFaviconUrl(e.target.value)}
                  placeholder="Ou cole a URL do favicon"
                  className={inputCls + " mt-3 max-w-full text-xs"}
                />
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
              <p className="text-[11px] text-muted-foreground">
                O navegador usa o favicon e o manifesto no momento da instalação. Se o app já estiver instalado no
                celular ou no computador, remova o app antigo e instale novamente para atualizar nome e ícone da tela
                inicial.
              </p>
            </div>

            <button
              onClick={saveBranding}
              disabled={savingBranding || !!uploadingBranding}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {savingBranding && <Loader2 size={16} className="animate-spin" />}
              Salvar Identidade do App
            </button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/40 p-5 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prévia</p>
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-3xl border border-primary/30 bg-muted shadow-lg shadow-primary/10">
              {appLogoUrl ? (
                <img src={appLogoUrl} alt={appName || "Logo"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Logo</div>
              )}
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">{appName || "Nome do App"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{appShortName || appName || "Nome curto"}</p>
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="h-7 w-7 overflow-hidden rounded-lg bg-muted">
                {appFaviconUrl ? (
                  <img src={appFaviconUrl} alt="Favicon" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">Ícone de instalação</span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Settings */}
      <div className="glass-card rounded-xl p-6">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Saque Mínimo (R$)</h3>
            <input
              value={settings.min_withdrawal}
              onChange={(e) => setSettings({ ...settings, min_withdrawal: e.target.value })}
              type="number"
              className={inputCls}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Valor por Indicação (R$)</h3>
            <input
              value={settings.referral_value}
              onChange={(e) => setSettings({ ...settings, referral_value: e.target.value })}
              type="number"
              className={inputCls}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Limite Mensal de Saque (R$)</h3>
            <input
              value={settings.monthly_limit}
              onChange={(e) => setSettings({ ...settings, monthly_limit: e.target.value })}
              type="number"
              className={inputCls}
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Providers & Global Observation */}
      <div className="glass-card rounded-xl p-6 mt-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Tv size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Provedores de Acesso dos Apps</h2>
            <p className="text-xs text-muted-foreground">
              Altere os provedores e notifique todos os clientes automaticamente
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Provedor Assist Plus</h3>
            <input
              value={assistProvider}
              onChange={(e) => setAssistProvider(e.target.value)}
              placeholder="Ex: Server Premium, CDN Brasil..."
              className={inputCls + " max-w-full"}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Provedor Blessed Player</h3>
            <input
              value={blessedProvider}
              onChange={(e) => setBlessedProvider(e.target.value)}
              placeholder="Ex: Server Premium, CDN Brasil..."
              className={inputCls + " max-w-full"}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Observação Global (para TODOS os clientes)</h3>
            <p className="mb-1 text-[11px] text-muted-foreground">
              Este texto substituirá a observação de TODOS os clientes ao salvar. Use{" "}
              <code className="bg-muted px-1 rounded text-[10px]">{"{{USUARIO}}"}</code> e{" "}
              <code className="bg-muted px-1 rounded text-[10px]">{"{{SENHA}}"}</code> para inserir os dados de cada
              cliente automaticamente.
            </p>
            <textarea
              value={globalObservation}
              onChange={(e) => setGlobalObservation(e.target.value)}
              placeholder={
                "SEUS DADOS DE ACESSO:\n\nASSIST PLUS E BLESSED PLAYER\n\nUSUÁRIO: {{USUARIO}}\nSENHA: {{SENHA}}"
              }
              rows={8}
              className="w-full rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Bell size={14} className="text-amber-400" />
              <p className="text-xs font-semibold text-amber-400">Notificação Automática</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ao salvar, uma notificação push será enviada a <strong>todos os clientes</strong>:
            </p>
            <p className="mt-1 text-[11px] text-foreground italic">
              "⚠️ ATENÇÃO! O provedor de acesso do APP da TV foram alterados. Acesse o APP e atualize sua TV."
            </p>
          </div>

          <button
            onClick={saveProvidersAndNotify}
            disabled={savingProviders || sendingNotification}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {savingProviders ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sendingNotification
              ? "Enviando notificação..."
              : savingProviders
                ? "Salvando..."
                : "Salvar e Notificar Todos"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminSettingsPage;
