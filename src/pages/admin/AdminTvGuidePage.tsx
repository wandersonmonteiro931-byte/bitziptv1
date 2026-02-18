import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Tv, Plus, Edit, Trash2, X, Upload, ToggleLeft, ToggleRight, Copy, Calendar, Clock, Star } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Channel {
  id: string;
  name: string;
  logo_url: string;
  is_active: boolean;
  sort_order: number;
}

interface Program {
  id: string;
  channel_id: string;
  program_date: string;
  start_time: string;
  end_time: string;
  name: string;
  category: string;
  description: string;
  is_highlight: boolean;
  is_active: boolean;
}

const categories = ["Jornal", "Novela", "Filme", "Esporte", "Série", "Infantil", "Variedades", "Religioso", "Geral"];

const AdminTvGuidePage = () => {
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeTab, setActiveTab] = useState<"channels" | "programs">("channels");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [channelForm, setChannelForm] = useState({ name: "", logo_url: "", sort_order: 0 });
  const [programForm, setProgramForm] = useState({
    channel_id: "", program_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "06:00", end_time: "07:00", name: "", category: "Geral",
    description: "", is_highlight: false,
  });

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { if (selectedChannel) loadPrograms(); }, [selectedChannel, selectedDate]);

  const loadChannels = async () => {
    const { data } = await supabase.from("tv_channels").select("*").order("sort_order");
    const ch = (data as any[]) || [];
    setChannels(ch);
    if (!selectedChannel && ch.length > 0) setSelectedChannel(ch[0].id);
  };

  const loadPrograms = async () => {
    const { data } = await supabase.from("tv_programs").select("*")
      .eq("channel_id", selectedChannel).eq("program_date", selectedDate)
      .order("start_time");
    setPrograms((data as any[]) || []);
  };

  // Channel CRUD
  const openCreateChannel = () => {
    setEditingChannel(null);
    setChannelForm({ name: "", logo_url: "", sort_order: channels.length });
    setShowChannelForm(true);
  };

  const openEditChannel = (ch: Channel) => {
    setEditingChannel(ch);
    setChannelForm({ name: ch.name, logo_url: ch.logo_url || "", sort_order: ch.sort_order });
    setShowChannelForm(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("tv-logos").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("tv-logos").getPublicUrl(path);
    setChannelForm(f => ({ ...f, logo_url: pub.publicUrl }));
    setUploading(false);
    toast({ title: "Logo enviado!" });
  };

  const saveChannel = async () => {
    if (!channelForm.name) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    const payload = { name: channelForm.name, logo_url: channelForm.logo_url, sort_order: channelForm.sort_order };
    if (editingChannel) {
      await supabase.from("tv_channels").update(payload).eq("id", editingChannel.id);
      toast({ title: "Canal atualizado!" });
    } else {
      await supabase.from("tv_channels").insert(payload);
      toast({ title: "Canal criado!" });
    }
    setShowChannelForm(false);
    loadChannels();
  };

  const toggleChannel = async (id: string, active: boolean) => {
    await supabase.from("tv_channels").update({ is_active: !active }).eq("id", id);
    loadChannels();
  };

  const deleteChannel = async (id: string) => {
    if (!confirm("Excluir canal e toda sua programação?")) return;
    await supabase.from("tv_channels").delete().eq("id", id);
    toast({ title: "Canal excluído" });
    loadChannels();
  };

  // Program CRUD
  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgramForm({
      channel_id: selectedChannel, program_date: selectedDate,
      start_time: "06:00", end_time: "07:00", name: "", category: "Geral",
      description: "", is_highlight: false,
    });
    setShowProgramForm(true);
  };

  const openEditProgram = (p: Program) => {
    setEditingProgram(p);
    setProgramForm({
      channel_id: p.channel_id, program_date: p.program_date,
      start_time: p.start_time.slice(0, 5), end_time: p.end_time.slice(0, 5),
      name: p.name, category: p.category, description: p.description || "",
      is_highlight: p.is_highlight,
    });
    setShowProgramForm(true);
  };

  const saveProgram = async () => {
    if (!programForm.name || !programForm.channel_id) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    // Overlap check
    const { data: existing } = await supabase.from("tv_programs").select("id, start_time, end_time, name")
      .eq("channel_id", programForm.channel_id).eq("program_date", programForm.program_date);
    const overlapping = (existing || []).filter(e => {
      if (editingProgram && e.id === editingProgram.id) return false;
      return programForm.start_time < e.end_time.slice(0, 5) && programForm.end_time > e.start_time.slice(0, 5);
    });
    if (overlapping.length > 0) {
      toast({ title: "Conflito de horário", description: `Sobrepõe: ${overlapping.map(o => o.name).join(", ")}`, variant: "destructive" });
      return;
    }

    const payload = {
      channel_id: programForm.channel_id,
      program_date: programForm.program_date,
      start_time: programForm.start_time,
      end_time: programForm.end_time,
      name: programForm.name,
      category: programForm.category,
      description: programForm.description,
      is_highlight: programForm.is_highlight,
    };
    if (editingProgram) {
      await supabase.from("tv_programs").update(payload).eq("id", editingProgram.id);
      toast({ title: "Programa atualizado!" });
    } else {
      await supabase.from("tv_programs").insert(payload);
      toast({ title: "Programa adicionado!" });
    }
    setShowProgramForm(false);
    loadPrograms();
  };

  const deleteProgram = async (id: string) => {
    if (!confirm("Excluir este programa?")) return;
    await supabase.from("tv_programs").delete().eq("id", id);
    toast({ title: "Programa excluído" });
    loadPrograms();
  };

  const toggleProgram = async (id: string, active: boolean) => {
    await supabase.from("tv_programs").update({ is_active: !active }).eq("id", id);
    loadPrograms();
  };

  // Copy day
  const copyDay = async (targetDate: string) => {
    if (!selectedChannel || programs.length === 0) return;
    const copies = programs.map(p => ({
      channel_id: p.channel_id,
      program_date: targetDate,
      start_time: p.start_time,
      end_time: p.end_time,
      name: p.name,
      category: p.category,
      description: p.description,
      is_highlight: p.is_highlight,
    }));
    const { error } = await supabase.from("tv_programs").insert(copies);
    if (error) {
      toast({ title: "Erro ao copiar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Programação copiada para ${format(new Date(targetDate + "T12:00:00"), "dd/MM/yyyy")}` });
    }
  };

  const deleteByDate = async () => {
    if (!confirm(`Excluir TODA a programação de ${selectedDate} para este canal?`)) return;
    await supabase.from("tv_programs").delete().eq("channel_id", selectedChannel).eq("program_date", selectedDate);
    toast({ title: "Programação do dia excluída" });
    loadPrograms();
  };

  return (
    <AppLayout>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Tv className="text-primary" size={22} /> 📺 Programação TV
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Gerencie canais e grade de programação</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button onClick={() => setActiveTab("channels")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "channels" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
          Canais
        </button>
        <button onClick={() => setActiveTab("programs")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "programs" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>
          Programação
        </button>
      </div>

      {/* ===== CHANNELS TAB ===== */}
      {activeTab === "channels" && (
        <>
          <button onClick={openCreateChannel} className="mb-4 flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
            <Plus size={16} /> Novo Canal
          </button>

          <div className="space-y-3">
            {channels.map((ch, i) => (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                {ch.logo_url ? (
                  <img src={ch.logo_url} alt={ch.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted"><Tv size={20} className="text-muted-foreground" /></div>
                )}
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{ch.name}</h3>
                  <span className={`text-[10px] font-semibold ${ch.is_active ? "text-success" : "text-muted-foreground"}`}>
                    {ch.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleChannel(ch.id, ch.is_active)} className="rounded-lg bg-muted/50 p-2 text-muted-foreground hover:text-foreground">
                    {ch.is_active ? <ToggleRight size={16} className="text-success" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => openEditChannel(ch)} className="rounded-lg bg-muted/50 p-2 text-muted-foreground hover:text-foreground">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => deleteChannel(ch.id)} className="rounded-lg bg-muted/50 p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
            {channels.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum canal cadastrado</p>}
          </div>
        </>
      )}

      {/* ===== PROGRAMS TAB ===== */}
      {activeTab === "programs" && (
        <>
          {/* Channel selector */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {channels.map(ch => (
              <button key={ch.id} onClick={() => setSelectedChannel(ch.id)}
                className={`flex flex-shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedChannel === ch.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                }`}>
                {ch.logo_url && <img src={ch.logo_url} alt="" className="h-4 w-4 rounded-full object-cover" />}
                {ch.name}
              </button>
            ))}
          </div>

          {/* Date + actions */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground" />
            <button onClick={openCreateProgram} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:brightness-110">
              <Plus size={14} /> Programa
            </button>
            <button onClick={() => {
              const target = prompt("Copiar para qual data? (AAAA-MM-DD)", format(addDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"));
              if (target) copyDay(target);
            }} className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
              <Copy size={14} /> Copiar dia
            </button>
            <button onClick={deleteByDate} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20">
              <Trash2 size={14} /> Limpar dia
            </button>
          </div>

          {/* Program list */}
          <div className="space-y-2">
            {programs.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 ${!p.is_active ? "opacity-50" : ""}`}>
                <div className="text-center">
                  <p className="text-xs font-bold text-primary">{p.start_time.slice(0, 5)}</p>
                  <p className="text-[10px] text-muted-foreground">{p.end_time.slice(0, 5)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                    {p.is_highlight && <Star size={12} className="text-warning flex-shrink-0" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{p.category}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleProgram(p.id, p.is_active)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-foreground">
                    {p.is_active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => openEditProgram(p)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-foreground">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => deleteProgram(p.id)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
            {programs.length === 0 && selectedChannel && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum programa para este dia</p>
            )}
          </div>
        </>
      )}

      {/* ===== CHANNEL FORM MODAL ===== */}
      <AnimatePresence>
        {showChannelForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">{editingChannel ? "Editar" : "Novo"} Canal</h2>
                <button onClick={() => setShowChannelForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label>
                  <input value={channelForm.name} onChange={e => setChannelForm({ ...channelForm, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Logo do Canal</label>
                  <input type="file" ref={fileRef} accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <div className="flex gap-2">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground hover:border-primary disabled:opacity-50">
                      <Upload size={14} /> {uploading ? "Enviando..." : "Upload"}
                    </button>
                    <input placeholder="Ou cole a URL" value={channelForm.logo_url}
                      onChange={e => setChannelForm({ ...channelForm, logo_url: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  {channelForm.logo_url && (
                    <div className="mt-2 flex justify-center">
                      <img src={channelForm.logo_url} alt="Preview" className="h-16 w-16 rounded-xl object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Ordem</label>
                  <input type="number" value={channelForm.sort_order} onChange={e => setChannelForm({ ...channelForm, sort_order: Number(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>

                <button onClick={saveChannel} className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
                  {editingChannel ? "Salvar" : "Criar Canal"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PROGRAM FORM MODAL ===== */}
      <AnimatePresence>
        {showProgramForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">{editingProgram ? "Editar" : "Novo"} Programa</h2>
                <button onClick={() => setShowProgramForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Canal</label>
                  <select value={programForm.channel_id} onChange={e => setProgramForm({ ...programForm, channel_id: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Data</label>
                  <input type="date" value={programForm.program_date} onChange={e => setProgramForm({ ...programForm, program_date: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Início</label>
                    <input type="time" value={programForm.start_time} onChange={e => setProgramForm({ ...programForm, start_time: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Fim</label>
                    <input type="time" value={programForm.end_time} onChange={e => setProgramForm({ ...programForm, end_time: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do Programa *</label>
                  <input value={programForm.name} onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</label>
                  <select value={programForm.category} onChange={e => setProgramForm({ ...programForm, category: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
                  <textarea value={programForm.description} onChange={e => setProgramForm({ ...programForm, description: e.target.value })} rows={2}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={programForm.is_highlight} onChange={e => setProgramForm({ ...programForm, is_highlight: e.target.checked })}
                    className="rounded border-border" />
                  <Star size={14} className="text-warning" /> Destaque
                </label>

                <button onClick={saveProgram} className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
                  {editingProgram ? "Salvar" : "Adicionar Programa"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default AdminTvGuidePage;
