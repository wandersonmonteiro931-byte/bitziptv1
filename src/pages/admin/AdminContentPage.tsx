import { AppLayout } from "@/components/AppLayout";
import { Megaphone, Plus, Edit, Trash2, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const AdminContentPage = () => {
  const { toast } = useToast();
  const [contents, setContents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", body: "", banner_url: "", content_type: "banner", target_audience: "all" });

  const load = async () => {
    const { data } = await supabase.from("content").select("*").order("created_at", { ascending: false });
    setContents(data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ title: "", body: "", banner_url: "", content_type: "banner", target_audience: "all" }); setShowForm(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ title: c.title, body: c.body || "", banner_url: c.banner_url || "", content_type: c.content_type, target_audience: c.target_audience }); setShowForm(true); };

  const save = async () => {
    if (!form.title) { toast({ title: "Erro", description: "Título é obrigatório", variant: "destructive" }); return; }
    if (editing) {
      await supabase.from("content").update(form).eq("id", editing.id);
      toast({ title: "Conteúdo atualizado!" });
    } else {
      await supabase.from("content").insert(form);
      toast({ title: "Conteúdo criado!" });
    }
    setShowForm(false);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("content").update({ is_active: !active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este conteúdo?")) return;
    await supabase.from("content").delete().eq("id", id);
    toast({ title: "Conteúdo excluído" });
    load();
  };

  const typeLabel: Record<string, string> = { banner: "Banner", notice: "Aviso", video: "Vídeo", campaign: "Campanha" };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Megaphone className="text-secondary" /> Central de Conteúdo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie banners, avisos e campanhas</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
          <Plus size={16} /> Novo Conteúdo
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">{editing ? "Editar" : "Novo"} Conteúdo</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <textarea placeholder="Corpo / descrição" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" rows={3} />
              <input placeholder="URL do banner/imagem" value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="banner">Banner</option>
                <option value="notice">Aviso</option>
                <option value="video">Vídeo</option>
                <option value="campaign">Campanha</option>
              </select>
              <button onClick={save} className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">{editing ? "Salvar" : "Criar"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {contents.length === 0 && <p className="col-span-full text-center text-muted-foreground">Nenhum conteúdo criado.</p>}
        {contents.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{c.title}</h3>
                <span className="text-xs text-muted-foreground">{typeLabel[c.content_type] || c.content_type}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {c.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>
            {c.body && <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{c.body}</p>}
            <div className="flex items-center gap-2">
              <button onClick={() => toggle(c.id, c.is_active)} className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                {c.is_active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
              </button>
              <button onClick={() => openEdit(c)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Edit size={14} /></button>
              <button onClick={() => remove(c.id)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
};

export default AdminContentPage;
