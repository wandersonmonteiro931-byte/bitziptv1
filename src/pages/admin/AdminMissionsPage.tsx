import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Target, Plus, Edit, Trash2, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminMissionsPage = () => {
  const { toast } = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", reward_value: "", mission_type: "manual", frequency: "once", link: "" });

  const loadMissions = async () => {
    const { data } = await supabase.from("missions").select("*").order("created_at", { ascending: false });
    setMissions(data || []);
  };

  useEffect(() => { loadMissions(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", description: "", reward_value: "", mission_type: "manual", frequency: "once", link: "" });
    setShowForm(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({ title: m.title, description: m.description, reward_value: String(m.reward_value), mission_type: m.mission_type, frequency: m.frequency, link: m.link || "" });
    setShowForm(true);
  };

  const saveMission = async () => {
    if (!form.title || !form.reward_value) {
      toast({ title: "Erro", description: "Título e valor são obrigatórios", variant: "destructive" });
      return;
    }
    const payload = { ...form, reward_value: parseFloat(form.reward_value) };
    if (editing) {
      await supabase.from("missions").update(payload).eq("id", editing.id);
      toast({ title: "Missão atualizada!" });
    } else {
      await supabase.from("missions").insert(payload);
      toast({ title: "Missão criada!" });
    }
    setShowForm(false);
    loadMissions();
  };

  const toggleMission = async (id: string, active: boolean) => {
    await supabase.from("missions").update({ is_active: !active }).eq("id", id);
    loadMissions();
  };

  const deleteMission = async (id: string) => {
    if (!confirm("Excluir esta missão?")) return;
    await supabase.from("missions").delete().eq("id", id);
    toast({ title: "Missão excluída" });
    loadMissions();
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Target className="text-secondary" /> Gerenciar Missões</h1>
          <p className="mt-1 text-sm text-muted-foreground">{missions.length} missões configuradas</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-all hover:brightness-110">
          <Plus size={16} /> Nova Missão
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">{editing ? "Editar" : "Nova"} Missão</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" rows={3} />
              <input type="number" placeholder="Valor da recompensa" value={form.reward_value} onChange={(e) => setForm({ ...form, reward_value: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="once">Única</option>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
              <input placeholder="Link (opcional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <button onClick={saveMission} className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
                {editing ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {missions.map((mission, i) => (
          <motion.div key={mission.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{mission.title}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {mission.frequency === "once" ? "Única" : mission.frequency === "daily" ? "Diária" : mission.frequency === "weekly" ? "Semanal" : "Mensal"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mission.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {mission.is_active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>
              <span className="text-lg font-bold text-secondary">R$ {Number(mission.reward_value).toFixed(2)}</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{mission.description}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleMission(mission.id, mission.is_active)} className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                {mission.is_active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                {mission.is_active ? "Desativar" : "Ativar"}
              </button>
              <button onClick={() => openEdit(mission)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Edit size={14} /></button>
              <button onClick={() => deleteMission(mission.id)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
};

export default AdminMissionsPage;
