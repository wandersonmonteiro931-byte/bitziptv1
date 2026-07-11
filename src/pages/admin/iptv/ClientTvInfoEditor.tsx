import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Image as ImageIcon, Loader2, Save, ShieldCheck, Upload, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeAuthenticatedFunction } from "@/lib/edgeFunctions";
import { ClientTvInfo, EMPTY_CLIENT_TV_INFO, normalizeClientTvInfo } from "@/lib/clientTvInfo";
import { useAppBranding } from "@/hooks/useAppBranding";

type Props = {
  user: any;
  tvApps: any[];
};

const inputCls =
  "w-full rounded-xl border border-border bg-black/70 px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-red-500/60";
const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";

export function ClientTvInfoEditor({ user, tvApps }: Props) {
  const { toast } = useToast();
  const { appName, faviconUrl } = useAppBranding();
  const [form, setForm] = useState<ClientTvInfo>(EMPTY_CLIENT_TV_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const appOptions = useMemo(() => {
    const officialName = String(appName || "WMCPLAYER").trim();
    const rows = [
      { id: "official", name: officialName, icon: faviconUrl || "" },
      ...(Array.isArray(tvApps) ? tvApps : []).map((item) => ({
        id: String(item.id || item.name),
        name: String(item.name || "").trim(),
        icon: String(item.logo_url || item.icon_url || "").trim(),
      })),
    ];

    const seen = new Set<string>();
    return rows.filter((item) => {
      const key = item.name.toLowerCase();
      if (!item.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [appName, faviconUrl, tvApps]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    invokeAuthenticatedFunction<any>("admin-manage-user", {
      action: "get_client_tv_info",
      user_id: user.id,
      data: {},
    })
      .then((result) => {
        if (!active) return;
        const loaded = normalizeClientTvInfo(result?.info);
        setForm({
          ...loaded,
          next_expiry: loaded.next_expiry || "",
          client_since: loaded.client_since || String(user?.created_at || "").slice(0, 10),
        });
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Erro ao carregar dados informativos",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        });
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [user.id, user?.created_at, toast]);

  const change = (field: keyof ClientTvInfo, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectKnownApp = (value: string) => {
    const selected = appOptions.find((item) => item.name === value);
    setForm((current) => ({
      ...current,
      tv_app_name: value,
      tv_app_logo_url: selected?.icon || current.tv_app_logo_url,
    }));
  };

  const uploadTutorialImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Envie uma imagem válida", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `tv-tutorials/${user.id}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      change("tutorial_image_url", data.publicUrl);
      toast({ title: "Imagem enviada" });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await invokeAuthenticatedFunction<any>("admin-manage-user", {
        action: "update_client_tv_info",
        user_id: user.id,
        data: form,
      });

      setForm(normalizeClientTvInfo(result?.info || form));
      toast({
        title: "Dados informativos salvos",
        description: "A tela Minha TV do cliente foi atualizada sem alterar login, pagamento ou serviço.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar dados informativos",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-border bg-muted/20">
        <Loader2 className="animate-spin text-red-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Informações exclusivas da tela Minha TV</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Estes dados são somente informativos. Não alteram o login do aplicativo, senha de acesso, servidor,
              pagamento, validade real, status ou qualquer outra tela do sistema.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados para conectar na TV</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Usuário da TV</label>
            <input value={form.tv_username} onChange={(e) => change("tv_username", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Senha da TV</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.tv_password}
                onChange={(e) => change("tv_password", e.target.value)}
                className={`${inputCls} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Código — opcional</label>
            <input value={form.tv_code} onChange={(e) => change("tv_code", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DNS — opcional</label>
            <input value={form.tv_dns} onChange={(e) => change("tv_dns", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Lista / URL — opcional</label>
            <input
              value={form.tv_list_url}
              onChange={(e) => change("tv_list_url", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aplicativo instalado na TV</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Escolher aplicativo cadastrado</label>
            <select value={form.tv_app_name} onChange={(e) => selectKnownApp(e.target.value)} className={inputCls}>
              <option value="">Selecione ou digite abaixo</option>
              {appOptions.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nome personalizado do aplicativo</label>
            <input value={form.tv_app_name} onChange={(e) => change("tv_app_name", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>URL do logotipo do aplicativo — opcional</label>
            <input
              value={form.tv_app_logo_url}
              onChange={(e) => change("tv_app_logo_url", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validade e suporte</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Próxima validade informada</label>
            <input type="date" value={form.next_expiry} onChange={(e) => change("next_expiry", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cliente desde</label>
            <input type="date" value={form.client_since} onChange={(e) => change("client_since", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nome do suporte</label>
            <input value={form.support_name} onChange={(e) => change("support_name", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp do suporte</label>
            <input
              value={form.support_whatsapp}
              onChange={(e) => change("support_whatsapp", e.target.value)}
              placeholder="(62) 99565-7915"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tutorial para o cliente</p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Imagem ensinando a conectar na TV</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={form.tutorial_image_url}
                onChange={(e) => change("tutorial_image_url", e.target.value)}
                placeholder="Cole a URL da imagem"
                className={inputCls}
              />
              <input
                id={`tv-tutorial-image-${user.id}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void uploadTutorialImage(e.target.files[0])}
              />
              <label
                htmlFor={`tv-tutorial-image-${user.id}`}
                className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Enviar imagem
              </label>
            </div>
            {form.tutorial_image_url && (
              <div className="mt-3 flex max-h-72 items-center justify-center overflow-hidden rounded-xl border border-border bg-black p-2">
                <img src={form.tutorial_image_url} alt="Prévia do tutorial" className="max-h-64 max-w-full object-contain" />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Link do vídeo no YouTube</label>
            <div className="relative">
              <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" size={17} />
              <input
                value={form.tutorial_youtube_url}
                onChange={(e) => change("tutorial_youtube_url", e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/15 hover:bg-red-500 disabled:opacity-50"
      >
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {saving ? "Salvando dados informativos..." : "Salvar dados da tela Minha TV"}
      </button>

      <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
        <ImageIcon size={15} className="shrink-0 text-blue-400" />
        A imagem e o vídeo aparecem somente em /iptv-info para este cliente.
      </div>
    </div>
  );
}
