import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Target, CheckCircle, Clock, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const MissionsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "available" | "completed">("all");
  const [missions, setMissions] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [m, c] = await Promise.all([
        supabase.from("missions").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("mission_completions").select("*").eq("user_id", user.id),
      ]);
      setMissions(m.data || []);
      setCompletions(c.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const completedIds = new Set(completions.map((c) => c.mission_id));

  const filtered = missions.filter((m) => {
    const done = completedIds.has(m.id);
    if (filter === "available") return !done;
    if (filter === "completed") return done;
    return true;
  });

  const submitCompletion = async (missionId: string) => {
    const { error } = await supabase.from("mission_completions").insert({
      user_id: user!.id,
      mission_id: missionId,
      status: "pending",
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Missão enviada!", description: "Aguardando aprovação do admin." });
      setCompletions([...completions, { mission_id: missionId, status: "pending" }]);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Target className="text-secondary" /> Missões
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete missões e ganhe recompensas</p>
      </div>

      <div className="mb-6 flex gap-2">
        {(["all", "available", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all" ? "Todas" : f === "available" ? "Disponíveis" : "Concluídas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((mission, i) => {
            const done = completedIds.has(mission.id);
            const completion = completions.find((c) => c.mission_id === mission.id);
            return (
              <motion.div key={mission.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {done ? <CheckCircle size={20} className="text-success" /> : <Clock size={20} className="text-primary" />}
                    <h3 className="font-semibold text-foreground">{mission.title}</h3>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">
                    <Gift size={12} /> R$ {Number(mission.reward_value).toFixed(2)}
                  </span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{mission.description}</p>
                {mission.link && (
                  <a href={mission.link} target="_blank" rel="noopener noreferrer" className="mb-3 inline-block text-xs text-primary underline">
                    Abrir link da missão
                  </a>
                )}
                {done ? (
                  <p className="text-xs font-medium text-success">
                    {completion?.status === "pending" ? "⏳ Aguardando aprovação" : "✓ Missão concluída"}
                  </p>
                ) : (
                  <button
                    onClick={() => submitCompletion(mission.id)}
                    className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/25"
                  >
                    Concluir Missão
                  </button>
                )}
              </motion.div>
            );
          })}
          {filtered.length === 0 && <p className="col-span-full text-center text-muted-foreground">Nenhuma missão encontrada.</p>}
        </div>
      )}
    </AppLayout>
  );
};

export default MissionsPage;
