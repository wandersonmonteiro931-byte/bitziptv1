import { AppLayout } from "@/components/AppLayout";
import { BarChart3 } from "lucide-react";

const AdminReportsPage = () => (
  <AppLayout>
    <div className="mb-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <BarChart3 className="text-primary" /> Relatórios
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Visualize métricas e analytics da plataforma</p>
    </div>
    <div className="glass-card rounded-xl p-8 text-center">
      <BarChart3 size={48} className="mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">Módulo de relatórios em desenvolvimento.</p>
      <p className="mt-1 text-sm text-muted-foreground">Gráficos, métricas de uso e exportação de dados.</p>
    </div>
  </AppLayout>
);

export default AdminReportsPage;
