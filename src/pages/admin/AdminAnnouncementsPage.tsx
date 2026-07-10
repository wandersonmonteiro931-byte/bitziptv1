import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Send,
  Loader2,
  Filter,
  Users,
  User,
  Eye,
  Copy,
  Image,
  FileText,
  Calendar,
  Clock,
  Upload,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TV_STATUSES } from "./iptv/types";
import { formatDateTimeBRT } from "@/lib/utils";
import { getFhdImageUrl } from "@/lib/imageQuality";

interface Announcement {
  id: string;
  title: string;
  body: string;
  banner_url: string;
  announcement_type: string;
  target_type: string;
  target_ids: string[];
  is_active: boolean;
  schedule_at: string | null;
  expires_at: string | null;
  display_frequency: "always" | "once";
  created_by: string;
  created_at: string;
  updated_at: string;
}

const AdminAnnouncementsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Users & filters
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterServer, setFilterServer] = useState("");
  const [filterApp, setFilterApp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterScreens, setFilterScreens] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [servers, setServers] = useState<any[]>([]);
  const [tvApps, setTvApps] = useState<any[]>([]);

  // Dismissal stats
  const [dismissalCounts, setDismissalCounts] = useState<Record<string, number>>({});

  const loadData = async () => {
    setLoading(true);
    const [announcementsRes, usersRes, serversRes, appsRes] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, name, username, iptv_server, iptv_tv_app, iptv_status, iptv_connections"),
      supabase.from("iptv_servers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
    ]);
    setAnnouncements((announcementsRes.data || []) as Announcement[]);
    setUsers(usersRes.data || []);
    setServers(serversRes.data || []);
    setTvApps(appsRes.data || []);

    // Load dismissal counts
    const ids = (announcementsRes.data || []).map((a: any) => a.id);
    if (ids.length > 0) {
      const counts: Record<string, number> = {};
      for (const id of ids) {
        const { count } = await supabase
          .from("announcement_dismissals")
          .select("*", { count: "exact", head: true })
          .eq("announcement_id", id);
        counts[id] = count || 0;
      }
      setDismissalCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (
      search &&
      !u.name?.toLowerCase().includes(search.toLowerCase()) &&
      !u.username?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (filterServer && u.iptv_server !== filterServer) return false;
    if (filterApp && !(u.iptv_tv_app || "").toLowerCase().includes(filterApp.toLowerCase())) return false;
    if (filterStatus && u.iptv_status !== filterStatus) return false;
    if (filterScreens && String(u.iptv_connections) !== filterScreens) return false;
    return true;
  });

  const startNew = () => {
    setEditing({
      title: "",
      body: "",
      banner_url: "",
      announcement_type: "text",
      target_type: "all",
      target_ids: [],
      is_active: true,
      schedule_at: null,
      expires_at: null,
      display_frequency: "always",
    });
  };

  const duplicate = (a: Announcement) => {
    setEditing({
      title: a.title,
      body: a.body,
      banner_url: a.banner_url,
      announcement_type: a.announcement_type,
      target_type: a.target_type,
      target_ids: [...(a.target_ids || [])],
      is_active: true,
      schedule_at: null,
      expires_at: null,
      display_frequency: a.display_frequency || "once",
    });
  };

  const save = async () => {
    if (!editing || !user?.id) return;
    // Title and body are optional now
    setSaving(true);
    try {
      const payload = {
        title: editing.title,
        body: editing.body || "",
        banner_url: editing.banner_url || "",
        announcement_type: editing.announcement_type || "text",
        target_type: editing.target_type || "all",
        target_ids: editing.target_ids || [],
        is_active: editing.is_active ?? true,
        schedule_at: editing.schedule_at || null,
        expires_at: editing.expires_at || null,
        display_frequency: editing.display_frequency || "once",
        created_by: user.id,
      };

      if (editing.id) {
        await supabase.from("announcements").update(payload).eq("id", editing.id);
      } else {
        await supabase.from("announcements").insert(payload);
      }
      toast({ title: "Aviso salvo!" });
      setEditing(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("announcements").update({ is_active: !current }).eq("id", id);
    loadData();
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("Excluir este aviso?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    loadData();
  };

  const resetDismissals = async (id: string) => {
    if (!confirm("Isso fará com que todos os usuários vejam o aviso novamente. Continuar?")) return;
    await supabase.from("announcement_dismissals").delete().eq("announcement_id", id);
    toast({ title: "Visualizações resetadas! O aviso será exibido novamente." });
    loadData();
  };

  const selectFiltered = () => {
    const ids = filteredUsers.map((u) => u.id);
    setEditing((prev) => (prev ? { ...prev, target_type: "specific", target_ids: ids } : prev));
    toast({ title: `${ids.length} usuário(s) selecionado(s)` });
  };

  const targetLabel = (a: Announcement) => {
    if (a.target_type === "all") return "Todos";
    return `${(a.target_ids || []).length} usuário(s)`;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Bell size={20} className="text-primary" /> Avisos do App
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Popup exibido ao abrir o app (obrigatório clicar "Entendi")
            </p>
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.97]"
          >
            <Plus size={16} /> Novo Aviso
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum aviso criado ainda</div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border/50 bg-card/80 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.announcement_type === "banner" ? (
                        <Image size={14} className="text-primary" />
                      ) : (
                        <FileText size={14} className="text-primary" />
                      )}
                      <span className="text-sm font-semibold text-foreground truncate">{a.title}</span>
                    </div>
                    {a.body && <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${a.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/20 text-muted-foreground"}`}
                      >
                        {a.is_active ? "Ativo" : "Inativo"}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {a.announcement_type === "banner" ? "Banner" : "Texto"}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground flex items-center gap-1">
                        <Users size={10} /> {targetLabel(a)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground flex items-center gap-1">
                        <Eye size={10} /> {dismissalCounts[a.id] || 0} viram
                      </span>
                    </div>
                    {a.schedule_at && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock size={10} /> Agendado: {formatDateTimeBRT(a.schedule_at)}
                      </p>
                    )}
                    {a.expires_at && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar size={10} /> Expira: {formatDateTimeBRT(a.expires_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => toggleActive(a.id, a.is_active)}
                      className="p-1.5 rounded-lg hover:bg-muted/20"
                    >
                      {a.is_active ? (
                        <ToggleRight size={18} className="text-emerald-400" />
                      ) : (
                        <ToggleLeft size={18} className="text-muted-foreground" />
                      )}
                    </button>
                    <button onClick={() => setEditing(a)} className="p-1.5 rounded-lg hover:bg-muted/20">
                      <Pencil size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => duplicate(a)}
                      className="p-1.5 rounded-lg hover:bg-muted/20"
                      title="Duplicar/Reenviar"
                    >
                      <Copy size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => resetDismissals(a.id)}
                      className="p-1.5 rounded-lg hover:bg-muted/20"
                      title="Resetar visualizações (reexibir)"
                    >
                      <Send size={14} className="text-primary" />
                    </button>
                    <button onClick={() => deleteAnnouncement(a.id)} className="p-1.5 rounded-lg hover:bg-muted/20">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Editor Modal */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-start justify-center bg-background/90 backdrop-blur-sm overflow-y-auto py-6 px-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-foreground">{editing.id ? "Editar Aviso" : "Novo Aviso"}</h3>
                  <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-muted/20">
                    <X size={18} />
                  </button>
                </div>

                {/* Type */}
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo do Aviso</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setEditing((prev) => (prev ? { ...prev, announcement_type: "text" } : prev))}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium border ${editing.announcement_type === "text" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    <FileText size={14} className="inline mr-1" /> Texto
                  </button>
                  <button
                    onClick={() => setEditing((prev) => (prev ? { ...prev, announcement_type: "banner" } : prev))}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium border ${editing.announcement_type === "banner" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    <Image size={14} className="inline mr-1" /> Banner
                  </button>
                </div>

                {/* Title */}
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
                <input
                  value={editing.title || ""}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground mb-3"
                  placeholder="Título do aviso"
                />

                {/* Body */}
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem</label>
                <textarea
                  value={editing.body || ""}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground mb-3 resize-none"
                  placeholder="Texto do aviso..."
                />

                {/* Banner URL */}
                {editing.announcement_type === "banner" && (
                  <>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Imagem do Banner</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const ext = file.name.split(".").pop() || "png";
                          const fileName = `announcement_${Date.now()}.${ext}`;
                          const { error: uploadError } = await supabase.storage
                            .from("banners")
                            .upload(fileName, file, { upsert: true, cacheControl: "31536000", contentType: file.type });
                          if (uploadError) throw uploadError;
                          const { data: urlData } = supabase.storage.from("banners").getPublicUrl(fileName);
                          setEditing((prev) => (prev ? { ...prev, banner_url: urlData.publicUrl } : prev));
                          toast({ title: "Imagem enviada!" });
                        } catch (err: any) {
                          toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
                        } finally {
                          setUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/10 px-4 py-6 text-sm text-muted-foreground flex flex-col items-center gap-2 transition-colors mb-2"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={20} className="animate-spin text-primary" /> Enviando...
                        </>
                      ) : (
                        <>
                          <Upload size={20} className="text-primary" /> Clique para enviar imagem (PNG, JPG, WebP)
                        </>
                      )}
                    </button>
                    {editing.banner_url && (
                      <div className="relative mb-3">
                        <img
                          src={getFhdImageUrl(editing.banner_url)}
                          alt="Preview"
                          className="w-full rounded-xl max-h-48 object-contain bg-muted/10"
                        />
                        <button
                          type="button"
                          onClick={() => setEditing((prev) => (prev ? { ...prev, banner_url: "" } : prev))}
                          className="absolute top-2 right-2 p-1 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Target */}
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinatários</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() =>
                      setEditing((prev) => (prev ? { ...prev, target_type: "all", target_ids: [] } : prev))
                    }
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium border ${editing.target_type === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    <Users size={14} className="inline mr-1" /> Todos
                  </button>
                  <button
                    onClick={() => setEditing((prev) => (prev ? { ...prev, target_type: "specific" } : prev))}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium border ${editing.target_type === "specific" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    <User size={14} className="inline mr-1" /> Selecionados
                  </button>
                </div>

                {editing.target_type === "specific" && (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {(editing.target_ids || []).length} selecionado(s)
                      </span>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="text-xs text-primary flex items-center gap-1"
                      >
                        <Filter size={12} /> Filtros
                      </button>
                    </div>

                    {showFilters && (
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/10 border border-border/30">
                        <select
                          value={filterServer}
                          onChange={(e) => setFilterServer(e.target.value)}
                          className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="">Servidor</option>
                          {servers.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filterApp}
                          onChange={(e) => setFilterApp(e.target.value)}
                          className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="">App TV</option>
                          {tvApps.map((a) => (
                            <option key={a.id} value={a.name}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="">Status</option>
                          {TV_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filterScreens}
                          onChange={(e) => setFilterScreens(e.target.value)}
                          className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="">Telas</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={selectFiltered}
                          className="col-span-2 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground"
                        >
                          Selecionar {filteredUsers.length} filtrados
                        </button>
                      </div>
                    )}

                    {/* Search users */}
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nome..."
                      className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-foreground"
                    />

                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border/30 p-2">
                      {filteredUsers.slice(0, 50).map((u) => {
                        const selected = (editing.target_ids || []).includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/10 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                setEditing((prev) => {
                                  if (!prev) return prev;
                                  const ids = prev.target_ids || [];
                                  return {
                                    ...prev,
                                    target_ids: selected ? ids.filter((i) => i !== u.id) : [...ids, u.id],
                                  };
                                });
                              }}
                              className="rounded border-border"
                            />
                            <span className="text-xs text-foreground truncate">{u.name || u.username}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Frequency */}
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Frequência de exibição</label>
                <select
                  value={editing.display_frequency || "always"}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, display_frequency: e.target.value as "always" | "once" } : prev,
                    )
                  }
                  className="mb-2 w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="always">Aparecer sempre que entrar no app</option>
                  <option value="once">Aparecer uma vez até o admin resetar</option>
                </select>
                <p className="mb-4 text-[10px] text-muted-foreground">
                  "Sempre" aparece imediatamente para clientes conectados e volta a aparecer a cada nova entrada/reload
                  do app.
                </p>

                {/* Schedule */}
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Agendar início (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={editing.schedule_at?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, schedule_at: e.target.value ? new Date(e.target.value).toISOString() : null }
                        : prev,
                    )
                  }
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground mb-3"
                />

                {/* Expires */}
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Expiração (opcional)</label>
                <input
                  type="datetime-local"
                  value={editing.expires_at?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }
                        : prev,
                    )
                  }
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground mb-4"
                />

                {/* Active toggle */}
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.is_active ?? true}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-foreground">Ativo imediatamente</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 rounded-xl bg-muted/20 py-3 text-sm text-muted-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {editing.id ? "Salvar" : "Criar Aviso"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default AdminAnnouncementsPage;
