import { AppLayout } from "@/components/AppLayout";
import { Gift, CheckCircle, Clock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminReferralsPage = () => {
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("referrals")
      .select("*, referrer:profiles!referrals_referrer_id_fkey(name), referred:profiles!referrals_referred_id_fkey(name)")
      .order("created_at", { ascending: false });
    setReferrals(data || []);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("referrals").update({ status }).eq("id", id);
    toast({ title: `Indicação ${status === "approved" ? "aprovada" : "recusada"}` });
    load();
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Gift className="text-accent" /> Gerenciar Indicações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Controle total do programa de indicações</p>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="space-y-3">
          {referrals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma indicação registrada.</p>}
          {referrals.map((ref) => (
            <div key={ref.id} className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {ref.status === "approved" ? <CheckCircle size={18} className="text-success" /> : ref.status === "rejected" ? <XCircle size={18} className="text-destructive" /> : <Clock size={18} className="text-warning" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{ref.referrer?.name} → {ref.referred?.name}</p>
                  <p className="text-xs text-muted-foreground">R$ {Number(ref.reward_amount).toFixed(2)} · {new Date(ref.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              {ref.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(ref.id, "approved")} className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25">Aprovar</button>
                  <button onClick={() => updateStatus(ref.id, "rejected")} className="rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25">Recusar</button>
                </div>
              )}
              {ref.status !== "pending" && (
                <span className={`text-xs font-semibold ${ref.status === "approved" ? "text-success" : "text-destructive"}`}>
                  {ref.status === "approved" ? "Aprovada" : "Recusada"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminReferralsPage;
