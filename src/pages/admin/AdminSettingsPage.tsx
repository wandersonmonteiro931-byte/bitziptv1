import { AppLayout } from "@/components/AppLayout";
import {
  Settings,
  Loader2,
  Tv,
  Bell,
  Send,
  Upload,
  Image as ImageIcon,
  Smartphone,
  Percent,
  CalendarDays,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeAppBranding, previewAppBranding, saveStoredAppBranding } from "@/hooks/useAppBranding";

type RenewalPlanForm = {
  id?: string;
  title: string;
  description: string;
  badge_text: string;
  cta_text: string;
  months: string;
  discount_percent: string;
  sort_order: string;
  is_active: boolean;
};

const createEmptyRenewalPlan = (sortOrder = 1): RenewalPlanForm => ({
  title: "",
  description: "",
  badge_text: "",
  cta_text: "Assinar agora",
  months: "1",
  discount_percent: "0",
  sort_order: String(sortOrder),
  is_active: true,
});

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

  // Datas de vencimento/pagamento
  const [billingDueDates, setBillingDueDates] = useState<any[]>([]);
  const [newDueDay, setNewDueDay] = useState("10");
  const [newGraceDays, setNewGraceDays] = useState("5");
  const [savingBilling, setSavingBilling] = useState(false);
  const [renewalPlans, setRenewalPlans] = useState<RenewalPlanForm[]>([]);
  const [loadedRenewalPlanIds, setLoadedRenewalPlanIds] = useState<string[]>([]);
  const [savingRenewalPlans, setSavingRenewalPlans] = useState(false);

  const loadBillingDueDates = async () => {
    const { data } = await (supabase as any)
      .from("billing_due_dates")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("day_of_month", { ascending: true });

    setBillingDueDates(data || []);
  };


  const loadRenewalPlans = async () => {
    const { data, error } = await (supabase as any)
      .from("iptv_renewal_plans")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("months", { ascending: true });

    if (error) {
      console.warn("iptv_renewal_plans not available yet:", error.message);
      setRenewalPlans([]);
      setLoadedRenewalPlanIds([]);
      return;
    }

    const rows = (data || []).map((plan: any) => ({
      id: plan.id,
      title: plan.title || "",
      description: plan.description || "",
      badge_text: plan.badge_text || "",
      cta_text: plan.cta_text || "Assinar agora",
      months: String(plan.months ?? 1),
      discount_percent: String(plan.discount_percent ?? 0),
      sort_order: String(plan.sort_order ?? 0),
      is_active: Boolean(plan.is_active),
    }));

    setRenewalPlans(rows);
    setLoadedRenewalPlanIds(rows.map((plan: RenewalPlanForm) => plan.id).filter(Boolean) as string[]);
  };

  useEffect(() => {
    loadBillingDueDates();
    loadRenewalPlans();

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
      appName: appName.trim() || "WMCFLIX",
      appShortName: appShortName.trim() || appName.trim() || "WMCFLIX",
      appDescription: appDescription.trim() || `${appName.trim() || "WMCFLIX"} - Programa de Fidelidade`,
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
        renewal_discount_3m_percent: Math.max(0, Math.min(100, parseFloat(settings.renewal_discount_3m_percent || 0))),
        renewal_discount_6m_percent: Math.max(0, Math.min(100, parseFloat(settings.renewal_discount_6m_percent || 0))),
      } as any)
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
      const { error } = await supabase.storage
        .from("banners")
        .upload(path, file, { upsert: true, cacheControl: "31536000", contentType: file.type });
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

  const addBillingDueDate = async () => {
    const day = Math.max(1, Math.min(31, Number(newDueDay || 10)));
    const grace = Math.max(0, Math.min(31, Number(newGraceDays || 5)));

    setSavingBilling(true);
    try {
      const { error } = await (supabase as any).from("billing_due_dates").insert({
        label: `Dia ${day}`,
        day_of_month: day,
        grace_days: grace,
        is_active: true,
        sort_order: day,
      });

      if (error) throw error;

      setNewDueDay(String(day));
      setNewGraceDays(String(grace));
      await loadBillingDueDates();
      toast({ title: "Data de pagamento cadastrada!" });
    } catch (err: any) {
      toast({
        title: "Erro ao cadastrar data",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingBilling(false);
    }
  };

  const updateBillingDueDate = async (id: string, patch: any) => {
    setSavingBilling(true);
    try {
      const { error } = await (supabase as any).from("billing_due_dates").update(patch).eq("id", id);
      if (error) throw error;

      await loadBillingDueDates();
      await (supabase as any).rpc("auto_block_overdue_clients");
      toast({ title: "Data de pagamento atualizada!" });
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar data",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingBilling(false);
    }
  };

  const deactivateBillingDueDate = async (id: string) => {
    setSavingBilling(true);
    try {
      const { error } = await (supabase as any).from("billing_due_dates").update({ is_active: false }).eq("id", id);
      if (error) throw error;

      await loadBillingDueDates();
      toast({ title: "Data desativada!" });
    } catch (err: any) {
      toast({
        title: "Erro ao desativar data",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingBilling(false);
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
                <img src={appLogoUrl} alt={appName || "Logo"} className="h-full w-full object-contain bg-black" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Logo</div>
              )}
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">{appName || "Nome do App"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{appShortName || appName || "Nome curto"}</p>
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="h-7 w-7 overflow-hidden rounded-lg bg-muted">
                {appFaviconUrl ? (
                  <img src={appFaviconUrl} alt="Favicon" className="h-full w-full object-contain bg-black" />
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">Ícone de instalação</span>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Due Dates */}
      <div className="glass-card rounded-xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
            <CalendarDays size={16} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Datas de Pagamento dos Clientes</h2>
            <p className="text-xs text-muted-foreground">
              Cadastre um ou mais dias do mês. Cada cliente pode receber uma data. O 1º mês incompleto é cobrado
              proporcionalmente.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Dia do mês</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newDueDay}
                onChange={(e) => setNewDueDay(e.target.value)}
                className={inputCls + " max-w-full"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Bloquear após quantos dias de atraso</label>
              <input
                type="number"
                min="0"
                max="31"
                value={newGraceDays}
                onChange={(e) => setNewGraceDays(e.target.value)}
                className={inputCls + " max-w-full"}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addBillingDueDate}
                disabled={savingBilling}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {savingBilling ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {billingDueDates.length === 0 ? (
            <p className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Nenhuma data cadastrada. Aplique a migração SQL e cadastre o primeiro vencimento.
            </p>
          ) : (
            billingDueDates.map((item: any) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${item.is_active ? "border-border bg-black/70" : "border-muted/30 bg-muted/10 opacity-60"}`}
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Nome</label>
                    <input
                      value={item.label || `Dia ${item.day_of_month}`}
                      onChange={(e) => updateBillingDueDate(item.id, { label: e.target.value })}
                      className={inputCls + " max-w-full"}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Dia</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={item.day_of_month}
                      onChange={(e) =>
                        updateBillingDueDate(item.id, {
                          day_of_month: Number(e.target.value),
                          sort_order: Number(e.target.value),
                        })
                      }
                      className={inputCls + " max-w-full"}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Limite atraso</label>
                    <input
                      type="number"
                      min="0"
                      max="31"
                      value={item.grace_days}
                      onChange={(e) => updateBillingDueDate(item.id, { grace_days: Number(e.target.value) })}
                      className={inputCls + " max-w-full"}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => updateBillingDueDate(item.id, { is_active: !item.is_active })}
                      disabled={savingBilling}
                      className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
                    >
                      {item.is_active ? "Ativa" : "Inativa"}
                    </button>
                    <button
                      onClick={() => deactivateBillingDueDate(item.id)}
                      disabled={savingBilling}
                      className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-red-400 hover:bg-red-500/20"
                      title="Desativar data"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] text-muted-foreground">
          Regra: no 1º mês, se o cliente não completar 30 dias até o vencimento escolhido, o sistema calcula
          automaticamente somente o proporcional. Depois disso, os meses são cobrados normalmente pela mensalidade
          cheia.
        </div>
      </div>

      {/* Renewal Plans */}
      <div className="glass-card rounded-xl p-6 mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
              <Percent size={18} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Planos de Renovação do Cliente</h2>
              <p className="text-xs text-muted-foreground">
                O admin pode criar, editar, ativar, desativar e excluir planos. O cliente vê exatamente o que estiver cadastrado aqui.
              </p>
            </div>
          </div>
          <button
            onClick={addRenewalPlan}
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
          >
            <PlusCircle size={16} /> Novo plano
          </button>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-[11px] text-muted-foreground">
          Dica: se você ainda não criou a tabela de planos no Supabase, rode uma única vez o arquivo <strong>SQL_CRIAR_PLANOS_RENOVACAO.sql</strong> que está na raiz do ZIP.
        </div>

        <div className="mt-4 space-y-4">
          {renewalPlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum plano cadastrado. Clique em <strong>Novo plano</strong> para criar.
            </div>
          ) : (
            renewalPlans.map((plan, index) => (
              <div key={plan.id || `new-${index}`} className="rounded-2xl border border-border/60 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Plano #{index + 1}</p>
                    <p className="text-[11px] text-muted-foreground">Aparece para o cliente na vitrine de planos.</p>
                  </div>
                  <button
                    onClick={() => removeRenewalPlan(index)}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition-all hover:bg-red-500/15"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Título do plano</h4>
                    <input value={plan.title} onChange={(e) => updateRenewalPlan(index, "title", e.target.value)} className={inputCls} placeholder="Ex: Antecipar 3 meses" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Badge</h4>
                    <input value={plan.badge_text} onChange={(e) => updateRenewalPlan(index, "badge_text", e.target.value)} className={inputCls} placeholder="Ex: Plano recomendado" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Meses</h4>
                    <input value={plan.months} onChange={(e) => updateRenewalPlan(index, "months", e.target.value)} type="number" min="1" className={inputCls} />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Desconto (%)</h4>
                    <input value={plan.discount_percent} onChange={(e) => updateRenewalPlan(index, "discount_percent", e.target.value)} type="number" min="0" max="100" step="0.01" className={inputCls} />
                  </div>
                  <div className="md:col-span-2">
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Descrição</h4>
                    <input value={plan.description} onChange={(e) => updateRenewalPlan(index, "description", e.target.value)} className={inputCls} placeholder="Ex: 10% de desconto" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Texto do botão</h4>
                    <input value={plan.cta_text} onChange={(e) => updateRenewalPlan(index, "cta_text", e.target.value)} className={inputCls} placeholder="Ex: Assinar agora" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Ordem</h4>
                    <input value={plan.sort_order} onChange={(e) => updateRenewalPlan(index, "sort_order", e.target.value)} type="number" min="0" className={inputCls} />
                  </div>
                </div>

                <label className="mt-4 inline-flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={plan.is_active} onChange={(e) => updateRenewalPlan(index, "is_active", e.target.checked)} className="h-4 w-4 rounded border-border bg-transparent" />
                  Plano ativo
                </label>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={saveRenewalPlans}
            disabled={savingRenewalPlans}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {savingRenewalPlans && <Loader2 size={16} className="animate-spin" />}
            Salvar Planos
          </button>
          <p className="text-xs text-muted-foreground">Os clientes recebem os novos planos automaticamente após salvar.</p>
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

          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
                <Percent size={16} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Descontos de Renovação</h3>
                <p className="text-[11px] text-muted-foreground">
                  Esses percentuais funcionam como fallback quando não houver planos cadastrados na seção acima.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Fallback: desconto para 3 meses (%)</h4>
                <input
                  value={settings.renewal_discount_3m_percent ?? 5}
                  onChange={(e) => setSettings({ ...settings, renewal_discount_3m_percent: e.target.value })}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls + " max-w-full"}
                />
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Fallback: desconto para 6 meses (%)</h4>
                <input
                  value={settings.renewal_discount_6m_percent ?? 10}
                  onChange={(e) => setSettings({ ...settings, renewal_discount_6m_percent: e.target.value })}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls + " max-w-full"}
                />
              </div>
            </div>
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
