import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Target, CheckCircle, Clock, Gift } from "lucide-react";
import { useState } from "react";

const missions = [
  { id: 1, name: "Assistir 1h de conteúdo", description: "Assista pelo menos 1 hora de qualquer canal hoje", reward: 1.5, type: "daily", status: "available" as const, progress: 60 },
  { id: 2, name: "Avaliar no Google Play", description: "Deixe uma avaliação 5 estrelas no Google Play", reward: 3.0, type: "once", status: "available" as const, progress: 0 },
  { id: 3, name: "Indicar um amigo", description: "Compartilhe seu código e tenha uma indicação aprovada", reward: 5.0, type: "recurring", status: "available" as const, progress: 0 },
  { id: 4, name: "Assistir 2h de conteúdo", description: "Assista pelo menos 2 horas de qualquer canal", reward: 2.0, type: "daily", status: "completed" as const, progress: 100 },
  { id: 5, name: "Seguir no Instagram", description: "Siga nosso perfil oficial no Instagram", reward: 2.0, type: "once", status: "completed" as const, progress: 100 },
  { id: 6, name: "Compartilhar no WhatsApp", description: "Compartilhe nosso link em 3 grupos", reward: 1.0, type: "daily", status: "available" as const, progress: 0 },
];

const MissionsPage = () => {
  const [filter, setFilter] = useState<"all" | "available" | "completed">("all");

  const filtered = missions.filter((m) => {
    if (filter === "available") return m.status === "available";
    if (filter === "completed") return m.status === "completed";
    return true;
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Target className="text-secondary" /> Missões
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete missões e ganhe recompensas</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {(["all", "available", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all" ? "Todas" : f === "available" ? "Disponíveis" : "Concluídas"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((mission, i) => (
          <motion.div
            key={mission.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl p-5"
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                {mission.status === "completed" ? (
                  <CheckCircle size={20} className="text-success" />
                ) : (
                  <Clock size={20} className="text-primary" />
                )}
                <h3 className="font-semibold text-foreground">{mission.name}</h3>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">
                <Gift size={12} />
                R$ {mission.reward.toFixed(2)}
              </span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{mission.description}</p>
            
            {mission.status === "available" && (
              <>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${mission.progress}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{mission.progress}% concluído</span>
                  <button className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/25">
                    Executar
                  </button>
                </div>
              </>
            )}
            {mission.status === "completed" && (
              <p className="text-xs font-medium text-success">✓ Missão concluída</p>
            )}
          </motion.div>
        ))}
      </div>
    </AppLayout>
  );
};

export default MissionsPage;
