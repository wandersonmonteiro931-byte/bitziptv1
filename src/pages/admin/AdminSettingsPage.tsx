import { AppLayout } from "@/components/AppLayout";
import { Settings } from "lucide-react";

const AdminSettingsPage = () => (
  <AppLayout>
    <div className="mb-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Settings className="text-muted-foreground" /> Configurações
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Configurações gerais da plataforma</p>
    </div>
    <div className="glass-card rounded-xl p-6">
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Saque Mínimo</h3>
          <input
            defaultValue="30.00"
            className="w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Valor por Indicação</h3>
          <input
            defaultValue="5.00"
            className="w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Limite Mensal de Saque</h3>
          <input
            defaultValue="200.00"
            className="w-full max-w-xs rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110">
          Salvar Configurações
        </button>
      </div>
    </div>
  </AppLayout>
);

export default AdminSettingsPage;
