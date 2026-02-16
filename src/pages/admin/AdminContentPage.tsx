import { AppLayout } from "@/components/AppLayout";
import { Megaphone } from "lucide-react";

const AdminContentPage = () => (
  <AppLayout>
    <div className="mb-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Megaphone className="text-secondary" /> Central de Conteúdo
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie banners, avisos e campanhas</p>
    </div>
    <div className="glass-card rounded-xl p-8 text-center">
      <Megaphone size={48} className="mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">Módulo de conteúdo e divulgação em desenvolvimento.</p>
      <p className="mt-1 text-sm text-muted-foreground">Crie banners, vídeos e avisos para seus clientes.</p>
    </div>
  </AppLayout>
);

export default AdminContentPage;
