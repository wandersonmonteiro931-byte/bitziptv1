import { AppLayout } from "@/components/AppLayout";
import { Gift } from "lucide-react";

const AdminReferralsPage = () => (
  <AppLayout>
    <div className="mb-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Gift className="text-accent" /> Gerenciar Indicações
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Controle total do programa de indicações</p>
    </div>
    <div className="glass-card rounded-xl p-8 text-center">
      <Gift size={48} className="mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">Módulo de gerenciamento de indicações em desenvolvimento.</p>
      <p className="mt-1 text-sm text-muted-foreground">Aqui você poderá aprovar, recusar e configurar regras de indicação.</p>
    </div>
  </AppLayout>
);

export default AdminReferralsPage;
