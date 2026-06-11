import { AppLayout } from "@/components/AppLayout";
import {
  Image,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  GripVertical,
  Eye,
  Upload,
  Link,
  Calendar,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateBRT } from "@/lib/utils";

interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  banner_url: string;
  redirect_url: string;
  content_type: string;
  target_audience: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  click_count: number;
  created_at: string;
}

const AdminBannersPage = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BannerItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    body: "",
    banner_url: "",
    redirect_url: "",
    content_type: "banner",
    target_audience: "all",
    sort_order: 0,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("content")
      .select("*")
      .eq("content_type", "banner")
      .order("sort_order", { ascending: true });
    setBanners((data as any[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setPreview("");
    setForm({
      title: "",
      subtitle: "",
      body: "",
      banner_url: "",
      redirect_url: "",
      content_type: "banner",
      target_audience: "all",
      sort_order: banners.length,
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: "",
    });
    setShowForm(true);
  };

  const openEdit = (b: BannerItem) => {
    setEditing(b);
    setPreview(b.banner_url || "");
    setForm({
      title: b.title,
      subtitle: b.subtitle || "",
      body: b.body || "",
      banner_url: b.banner_url || "",
      redirect_url: b.redirect_url || "",
      content_type: "banner",
      target_audience: b.target_audience,
      sort_order: b.sort_order || 0,
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : "",
      ends_at: b.ends_at ? b.ends_at.slice(0, 16) : "",
    });
    setShowForm(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("banners").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
    setForm((f) => ({ ...f, banner_url: pub.publicUrl }));
    setPreview(pub.publicUrl);
    setUploading(false);
    toast({ title: "Imagem enviada!" });
  };

  const save = async () => {
    if (!form.title) {
      toast({ title: "Erro", description: "Título é obrigatório", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: form.title,
      subtitle: form.subtitle,
      body: form.body,
      banner_url: form.banner_url,
      redirect_url: form.redirect_url,
      content_type: "banner",
      target_audience: form.target_audience,
      sort_order: form.sort_order,
      starts_at: form.starts_at || new Date().toISOString(),
      ends_at: form.ends_at || null,
    };
    if (editing) {
      await supabase.from("content").update(payload).eq("id", editing.id);
      toast({ title: "Banner atualizado!" });
    } else {
      await supabase.from("content").insert(payload);
      toast({ title: "Banner criado!" });
    }
    setShowForm(false);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("content").update({ is_active: !active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este banner?")) return;
    await supabase.from("content").delete().eq("id", id);
    toast({ title: "Banner excluído" });
    load();
  };

  const moveOrder = async (id: string, direction: "up" | "down") => {
    const idx = banners.findIndex((b) => b.id === id);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= banners.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    await Promise.all([
      supabase.from("content").update({ sort_order: banners[swapIdx].sort_order }).eq("id", banners[idx].id),
      supabase.from("content").update({ sort_order: banners[idx].sort_order }).eq("id", banners[swapIdx].id),
    ]);
    load();
  };

  const audienceLabel: Record<string, string> = { all: "Todos", server: "Servidor", client: "Cliente" };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Image className="text-secondary" /> 🎞️ Gestão de Banners
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie banners, agendamento e segmentação</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110"
        >
          <Plus size={16} /> Novo Banner
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{banners.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-success">{banners.filter((b) => b.is_active).length}</p>
          <p className="text-[10px] text-muted-foreground">Ativos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-primary">{banners.reduce((s, b) => s + (b.click_count || 0), 0)}</p>
          <p className="text-[10px] text-muted-foreground">Cliques</p>
        </div>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">{editing ? "Editar" : "Novo"} Banner</h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Subtítulo</label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Imagem (qualquer tamanho, adapta sem cortar)
                  </label>
                  <input type="file" ref={fileRef} accept="image/*" onChange={handleUpload} className="hidden" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <Upload size={14} /> {uploading ? "Enviando..." : "Upload"}
                    </button>
                    <input
                      placeholder="Ou cole a URL da imagem"
                      value={form.banner_url}
                      onChange={(e) => {
                        setForm({ ...form, banner_url: e.target.value });
                        setPreview(e.target.value);
                      }}
                      className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  {preview && (
                    <div className="mt-2 flex max-h-[260px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-black/20 p-2">
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-auto max-h-[240px] w-auto max-w-full object-contain"
                        onError={() => setPreview("")}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Link (opcional)</label>
                  <div className="flex items-center gap-2">
                    <Link size={14} className="text-muted-foreground" />
                    <input
                      value={form.redirect_url}
                      onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Público-alvo</label>
                    <select
                      value={form.target_audience}
                      onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="all">Todos</option>
                      <option value="server">Servidor específico</option>
                      <option value="client">Cliente específico</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Ordem</label>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">📅 Data início</label>
                    <input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">📅 Data expiração</label>
                    <input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={save}
                  className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110"
                >
                  {editing ? "Salvar Alterações" : "Criar Banner"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner List */}
      <div className="space-y-3">
        {banners.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum banner criado.</p>}
        {banners.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex">
              {/* Thumbnail */}
              <div className="relative flex h-24 w-32 flex-shrink-0 items-center justify-center bg-muted/30 p-1">
                {b.banner_url ? (
                  <img
                    src={b.banner_url}
                    alt={b.title}
                    className="h-auto max-h-full w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground/30">
                    🖼️
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">{b.title}</h3>
                    {b.subtitle && <p className="truncate text-xs text-muted-foreground">{b.subtitle}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {b.is_active ? "Ativo" : "Inativo"}
                      </span>
                      <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {audienceLabel[b.target_audience] || b.target_audience}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Eye size={10} /> {b.click_count || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    onClick={() => moveOrder(b.id, "up")}
                    className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-foreground"
                    title="Subir"
                  >
                    <GripVertical size={12} />
                  </button>
                  <button
                    onClick={() => toggle(b.id, b.is_active)}
                    className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {b.is_active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(b)}
                    className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => remove(b.id)}
                    className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Schedule info */}
            {(b.starts_at || b.ends_at) && (
              <div className="flex items-center gap-3 border-t border-border/50 bg-muted/10 px-3 py-1.5 text-[10px] text-muted-foreground">
                <Calendar size={10} />
                {b.starts_at && <span>Início: {formatDateBRT(b.starts_at)}</span>}
                {b.ends_at && <span>Expira: {formatDateBRT(b.ends_at)}</span>}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
};

export default AdminBannersPage;
