import { AppLayout } from "@/components/AppLayout";
import { Settings, Loader2, Tv, Bell, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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
      if (ps.data) setSettings(ps.data);
      if (ss.data) {
        setSupportSettings(ss.data);
        setAssistProvider((ss.data as any).assist_plus_provider || "");
        setBlessedProvider((ss.data as any).blessed_player_provider || "");
      }
    });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from("platform_settings").update({
      min_withdrawal: parseFloat(settings.min_withdrawal),
      referral_value: parseFloat(settings.referral_value),
      monthly_limit: parseFloat(settings.monthly_limit),
    }).eq("id", settings.id);
    setSaving(false);
    toast({ title: "Configurações salvas!" });
  };

  const saveProvidersAndNotify = async () => {
    if (!supportSettings) return;
    setSavingProviders(true);
    try {
      // 1. Save providers to support_settings
      await supabase.from("support_settings").update({
        assist_plus_provider: assistProvider,
        blessed_player_provider: blessedProvider,
      } as any).eq("id", supportSettings.id);

      // 2. Update admin_notes for ALL users if observation provided
      if (globalObservation.trim()) {
        const { data: allProfiles } = await supabase.from("profiles").select("id");
        if (allProfiles && allProfiles.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < allProfiles.length; i += batchSize) {
            const batch = allProfiles.slice(i, i + batchSize);
            const ids = batch.map((p) => p.id);
            await supabase.from("profiles").update({ admin_notes: globalObservation.trim() }).in("id", ids);
          }
        }
      }

      // 3. Send push notification to ALL users
      setSendingNotification(true);
      const { data: notif } = await supabase.from("scheduled_notifications").insert({
        title_template: "⚠️ ATENÇÃO!",
        body_template: "O provedor de acesso do APP da TV foram alterados. Acesse o APP e atualize sua TV.",
        click_action: "/iptv-info",
        target_type: "all",
        status: "draft",
        created_by: user?.id,
      }).select("id").single();

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

  if (!settings) return <AppLayout><div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>;

  const inputCls = "w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Settings className="text-muted-foreground" /> Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurações gerais da plataforma</p>
      </div>

      {/* Platform Settings */}
      <div className="glass-card rounded-xl p-6">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Saque Mínimo (R$)</h3>
            <input value={settings.min_withdrawal} onChange={(e) => setSettings({ ...settings, min_withdrawal: e.target.value })} type="number" className={inputCls} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Valor por Indicação (R$)</h3>
            <input value={settings.referral_value} onChange={(e) => setSettings({ ...settings, referral_value: e.target.value })} type="number" className={inputCls} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Limite Mensal de Saque (R$)</h3>
            <input value={settings.monthly_limit} onChange={(e) => setSettings({ ...settings, monthly_limit: e.target.value })} type="number" className={inputCls} />
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50">
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
            <p className="text-xs text-muted-foreground">Altere os provedores e notifique todos os clientes automaticamente</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Provedor Assist Plus</h3>
            <input value={assistProvider} onChange={(e) => setAssistProvider(e.target.value)} placeholder="Ex: Server Premium, CDN Brasil..." className={inputCls + " max-w-full"} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Provedor Blessed Player</h3>
            <input value={blessedProvider} onChange={(e) => setBlessedProvider(e.target.value)} placeholder="Ex: Server Premium, CDN Brasil..." className={inputCls + " max-w-full"} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Observação Global (para TODOS os clientes)</h3>
            <p className="mb-1 text-[11px] text-muted-foreground">Este texto substituirá a observação de TODOS os clientes ao salvar.</p>
            <textarea value={globalObservation} onChange={(e) => setGlobalObservation(e.target.value)} placeholder="Deixe em branco para não alterar as observações dos clientes..." rows={5}
              className="w-full rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
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

          <button onClick={saveProvidersAndNotify} disabled={savingProviders || sendingNotification}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50">
            {savingProviders ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sendingNotification ? "Enviando notificação..." : savingProviders ? "Salvando..." : "Salvar e Notificar Todos"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminSettingsPage;