import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Target, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";

const mockMissions = [
  { id: 1, name: "Assistir 1h de conteúdo", reward: 1.5, type: "Diária", active: true, completions: 89 },
  { id: 2, name: "Avaliar no Google Play", reward: 3.0, type: "Única", active: true, completions: 45 },
  { id: 3, name: "Indicar um amigo", reward: 5.0, type: "Recorrente", active: true, completions: 34 },
  { id: 4, name: "Assistir 2h de conteúdo", reward: 2.0, type: "Diária", active: true, completions: 67 },
  { id: 5, name: "Compartilhar no WhatsApp", reward: 1.0, type: "Diária", active: false, completions: 12 },
  { id: 6, name: "Seguir no Instagram", reward: 2.0, type: "Única", active: true, completions: 78 },
];

const AdminMissionsPage = () => {
  const [missions, setMissions] = useState(mockMissions);

  const toggleMission = (id: number) => {
    setMissions(missions.map((m) => (m.id === id ? { ...m, active: !m.active } : m)));
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Target className="text-secondary" /> Gerenciar Missões
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{missions.length} missões configuradas</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-all hover:brightness-110">
          <Plus size={16} /> Nova Missão
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {missions.map((mission, i) => (
          <motion.div
            key={mission.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl p-5"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{mission.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{mission.type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mission.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {mission.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>
              <span className="text-lg font-bold text-secondary">R$ {mission.reward.toFixed(2)}</span>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">{mission.completions} completações</p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleMission(mission.id)}
                className="flex items-center gap-1 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {mission.active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                {mission.active ? "Desativar" : "Ativar"}
              </button>
              <button className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Edit size={14} />
              </button>
              <button className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
};

export default AdminMissionsPage;
