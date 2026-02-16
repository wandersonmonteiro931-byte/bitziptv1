import { AppLayout } from "@/components/AppLayout";
import { Settings, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("*").limit(1).single()
      .then(({ data }) => { if (data) setSettings(data); });
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

  if (!settings) return <AppLayout><div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Settings className="text-muted-foreground" /> Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurações gerais da plataforma</p>
      </div>
      <div className="glass-card rounded-xl p-6">
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Saque Mínimo (R$)</h3>
            <input value={settings.min_withdrawal} onChange={(e) => setSettings({ ...settings, min_withdrawal: e.target.value })} type="number" className="w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Valor por Indicação (R$)</h3>
            <input value={settings.referral_value} onChange={(e) => setSettings({ ...settings, referral_value: e.target.value })} type="number" className="w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Limite Mensal de Saque (R$)</h3>
            <input value={settings.monthly_limit} onChange={(e) => setSettings({ ...settings, monthly_limit: e.target.value })} type="number" className="w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50">
            {saving && <Loader2 size={16} className="animate-spin" />}
            Salvar Configurações
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminSettingsPage;
