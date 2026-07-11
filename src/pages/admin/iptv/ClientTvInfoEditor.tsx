import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeAuthenticatedFunction } from "@/lib/edgeFunctions";
import {
  ClientTvInfo,
  DEFAULT_SUPPORT_NAME,
  DEFAULT_SUPPORT_WHATSAPP,
  EMPTY_CLIENT_TV_INFO,
  formatDateOnlyBr,
  normalizeClientTvInfo,
} from "@/lib/clientTvInfo";
import { useAppBranding } from "@/hooks/useAppBranding";

type Props = {
  user: any;
  tvApps: any[];
};

const inputCls =
  "w-full rounded-xl border border-border bg-black/70 px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-red-500/60";
const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";
type ClientTvInfoTextField = Exclude<
  keyof ClientTvInfo,
  "tv_connections" | "tutorial_image_urls" | "tutorial_youtube_urls"
>;

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
      { id: "official", name: officialName, icon: String(faviconUrl || "").trim() },
      ...(Array.isArray(tvApps) ? tvApps : []).map((item) => ({
        id: String(item.id || item.name),
        name: String(item.name || "").trim(),
        icon: String(item.icon || item.logo_url || item.icon_url || "").trim(),
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
          support_name: loaded.support_name || DEFAULT_SUPPORT_NAME,
          support_whatsapp: loaded.support_whatsapp || DEFAULT_SUPPORT_WHATSAPP,
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

  const changeText = (field: ClientTvInfoTextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectKnownApp = (value: string) => {
    const selected = appOptions.find((item) => item.name === value);
    setForm((current) => ({
      ...current,
      tv_app_name: value,
      tv_app_logo_url: selected?.icon || "",
    }));
  };

  const updateListItem = (
    field: "tutorial_image_urls" | "tutorial_youtube_urls",
    index: number,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const addListItem = (field: "tutorial_image_urls" | "tutorial_youtube_urls") => {
    setForm((current) => ({ ...current, [field]: [...current[field], ""] }));
  };

  const removeListItem = (field: "tutorial_image_urls" | "tutorial_youtube_urls", index: number) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const uploadTutorialImages = async (files: File[]) => {
    const validFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!validFiles.length) {
      toast({ title: "Envie uma ou mais imagens válidas", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of validFiles) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `tv-tutorials/${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
        const { error } = await supabase.storage.from("banners").upload(path, file, {
          upsert: false,
          cacheControl: "3600",
          contentType: file.type,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("banners").getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }

      setForm((current) => ({
        ...current,
        tutorial_image_urls: [...current.tutorial_image_urls.filter(Boolean), ...uploadedUrls],
      }));
      toast({ title: `${uploadedUrls.length} imagem(ns) enviada(s)` });
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
      const payload = {
        ...form,
        support_name: form.support_name.trim() || DEFAULT_SUPPORT_NAME,
        support_whatsapp: form.support_whatsapp.trim() || DEFAULT_SUPPORT_WHATSAPP,
        tutorial_image_urls: form.tutorial_image_urls.map((item) => item.trim()).filter(Boolean),
        tutorial_youtube_urls: form.tutorial_youtube_urls.map((item) => item.trim()).filter(Boolean),
      };

      const result = await invokeAuthenticatedFunction<any>("admin-manage-user", {
        action: "update_client_tv_info",
        user_id: user.id,
        data: payload,
      });

      setForm(normalizeClientTvInfo(result?.info || payload));
      toast({
        title: "Dados informativos salvos",
        description: "A tela Minha TV foi atualizada sem alterar login, pagamento, servidor ou validade operacional.",
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

  const selectedApp = appOptions.find((item) => item.name === form.tv_app_name);
  const selectedAppLogo = selectedApp?.icon || form.tv_app_logo_url;

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
              Estes dados são somente informativos. Não alteram autenticação, servidor, pagamento, status, validade
              operacional ou qualquer outra tela do sistema.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados para conectar na TV</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Usuário da TV</label>
            <input value={form.tv_username} onChange={(e) => changeText("tv_username", e.target.value)} className={inputCls} />
            <p className="mt-1 text-[10px] text-muted-foreground">Usa o usuário cadastrado como padrão, mas pode ser alterado aqui.</p>
          </div>
          <div>
            <label className={labelCls}>Senha da TV</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.tv_password}
                onChange={(e) => changeText("tv_password", e.target.value)}
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
            <p className="mt-1 text-[10px] text-muted-foreground">Usa a senha cadastrada como padrão, mas pode ser alterada aqui.</p>
          </div>
          <div>
            <label className={labelCls}>Telas contratadas</label>
            <input value={String(form.tv_connections)} readOnly className={`${inputCls} cursor-not-allowed opacity-70`} />
            <p className="mt-1 text-[10px] text-muted-foreground">Puxado automaticamente do cadastro do cliente.</p>
          </div>
          <div>
            <label className={labelCls}>Próxima validade</label>
            <input value={formatDateOnlyBr(form.next_expiry)} readOnly className={`${inputCls} cursor-not-allowed opacity-70`} />
            <p className="mt-1 text-[10px] text-muted-foreground">Puxada automaticamente do cadastro do cliente.</p>
          </div>
          <div>
            <label className={labelCls}>Código — opcional</label>
            <input value={form.tv_code} onChange={(e) => changeText("tv_code", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DNS — opcional</label>
            <input value={form.tv_dns} onChange={(e) => changeText("tv_dns", e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Lista / URL — opcional</label>
            <input
              value={form.tv_list_url}
              onChange={(e) => changeText("tv_list_url", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aplicativo instalado na TV</p>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className={labelCls}>Aplicativo cadastrado no painel</label>
            <select value={form.tv_app_name} onChange={(e) => selectKnownApp(e.target.value)} className={inputCls}>
              <option value="">Selecione o aplicativo</option>
              {appOptions.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="flex min-h-20 min-w-32 items-center justify-center rounded-xl border border-border bg-black p-3">
            {selectedAppLogo ? (
              <img src={selectedAppLogo} alt={form.tv_app_name || "Aplicativo"} className="h-14 w-14 rounded-xl object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Sem logotipo</span>
            )}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          O logotipo é puxado do aplicativo cadastrado no painel e não pode ser substituído por uma imagem externa nesta tela.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente e suporte</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Cliente desde</label>
            <input type="date" value={form.client_since} onChange={(e) => changeText("client_since", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nome do suporte</label>
            <input value={form.support_name} onChange={(e) => changeText("support_name", e.target.value)} className={inputCls} />
            <p className="mt-1 text-[10px] text-muted-foreground">Padrão: {DEFAULT_SUPPORT_NAME}</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>WhatsApp do suporte</label>
            <input
              value={form.support_whatsapp}
              onChange={(e) => changeText("support_whatsapp", e.target.value)}
              placeholder={DEFAULT_SUPPORT_WHATSAPP}
              className={inputCls}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Padrão: {DEFAULT_SUPPORT_WHATSAPP}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imagens ensinando a conectar</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addListItem("tutorial_image_urls")}
              className="flex items-center gap-1 rounded-lg border border-border bg-black/50 px-3 py-2 text-xs text-foreground hover:border-red-500/40"
            >
              <Plus size={14} /> Adicionar URL
            </button>
            <input
              id={`tv-tutorial-images-${user.id}`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && void uploadTutorialImages(Array.from(e.target.files))}
            />
            <label
              htmlFor={`tv-tutorial-images-${user.id}`}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Enviar imagens
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {form.tutorial_image_urls.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhuma imagem cadastrada.
            </p>
          )}
          {form.tutorial_image_urls.map((url, index) => (
            <div key={`image-${index}`} className="rounded-xl border border-border bg-black/35 p-3">
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => updateListItem("tutorial_image_urls", index, e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeListItem("tutorial_image_urls", index)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  title="Remover imagem"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {url && (
                <div className="mt-3 flex max-h-72 items-center justify-center overflow-hidden rounded-xl border border-border bg-black p-2">
                  <img src={url} alt={`Prévia ${index + 1}`} className="max-h-64 max-w-full object-contain" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vídeos do YouTube</p>
          <button
            type="button"
            onClick={() => addListItem("tutorial_youtube_urls")}
            className="flex items-center gap-1 rounded-lg border border-border bg-black/50 px-3 py-2 text-xs text-foreground hover:border-red-500/40"
          >
            <Plus size={14} /> Adicionar vídeo
          </button>
        </div>

        <div className="space-y-3">
          {form.tutorial_youtube_urls.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhum vídeo cadastrado.
            </p>
          )}
          {form.tutorial_youtube_urls.map((url, index) => (
            <div key={`video-${index}`} className="flex gap-2">
              <div className="relative flex-1">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" size={17} />
                <input
                  value={url}
                  onChange={(e) => updateListItem("tutorial_youtube_urls", index, e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className={`${inputCls} pl-10`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeListItem("tutorial_youtube_urls", index)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                title="Remover vídeo"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
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
        As imagens e os vídeos aparecem somente em /iptv-info para este cliente.
      </div>
    </div>
  );
}
