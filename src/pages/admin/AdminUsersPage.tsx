import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Users, Search, Plus, Eye, Ban, Trash2, DollarSign, KeyRound, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const statusBadge: Record<string, string> = {
  active: "bg-success/15 text-success",
  suspended: "bg-warning/15 text-warning",
  blocked: "bg-destructive/15 text-destructive",
};

const AdminUsersPage = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState<any>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceDesc, setBalanceDesc] = useState("");
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "client", iptv_user: "", iptv_server: "", iptv_app: "", iptv_expiry: "" });
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  const createUser = async () => {
    if (!form.name || !form.username || !form.email || !form.password) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-create-user", {
      body: { ...form, referral_code: form.username.toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase() },
    });
    setCreating(false);
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário criado com sucesso!" });
      setShowCreate(false);
      setForm({ name: "", username: "", email: "", password: "", role: "client", iptv_user: "", iptv_server: "", iptv_app: "", iptv_expiry: "" });
      loadUsers();
    }
  };

  const updateStatus = async (userId: string, status: string) => {
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_status", user_id: userId, data: { status } },
    });
    toast({ title: `Status atualizado para ${status}` });
    loadUsers();
  };

  const adjustBalance = async () => {
    if (!showBalanceAdjust || !balanceAmount) return;
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "adjust_balance", user_id: showBalanceAdjust.id, data: { amount: parseFloat(balanceAmount), description: balanceDesc || "Ajuste manual" } },
    });
    toast({ title: "Saldo ajustado!" });
    setShowBalanceAdjust(null);
    setBalanceAmount("");
    setBalanceDesc("");
    loadUsers();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "delete_user", user_id: userId, data: {} },
    });
    toast({ title: "Usuário excluído" });
    loadUsers();
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Users className="text-primary" /> Gerenciar Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110">
          <Plus size={16} /> Criar Usuário
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">Criar Usuário</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: "name", label: "Nome completo", type: "text" },
                { key: "username", label: "Username IPTV", type: "text" },
                { key: "email", label: "E-mail", type: "email" },
                { key: "password", label: "Senha", type: "password" },
                { key: "iptv_user", label: "Usuário IPTV", type: "text" },
                { key: "iptv_server", label: "Servidor IPTV", type: "text" },
                { key: "iptv_app", label: "App IPTV", type: "text" },
                { key: "iptv_expiry", label: "Vencimento IPTV", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Função</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                  <option value="client">Cliente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button onClick={createUser} disabled={creating} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50">
                {creating ? "Criando..." : "Criar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Adjust Modal */}
      {showBalanceAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">Ajustar Saldo</h2>
              <button onClick={() => setShowBalanceAdjust(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">{showBalanceAdjust.name} · Saldo: R$ {Number(showBalanceAdjust.balance).toFixed(2)}</p>
            <div className="space-y-3">
              <input type="number" placeholder="Valor (+ ou -)" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <input placeholder="Descrição" value={balanceDesc} onChange={(e) => setBalanceDesc(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
              <button onClick={adjustBalance} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 py-3 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Buscar por nome ou usuário..." />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Saldo</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">R$ {Number(user.balance).toFixed(2)}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[user.status] || ""}`}>
                      {user.status === "active" ? "Ativo" : user.status === "suspended" ? "Suspenso" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowBalanceAdjust(user)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Ajustar saldo">
                        <DollarSign size={16} />
                      </button>
                      <button onClick={() => updateStatus(user.id, user.status === "active" ? "suspended" : "active")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={user.status === "active" ? "Suspender" : "Ativar"}>
                        <Ban size={16} />
                      </button>
                      <button onClick={() => deleteUser(user.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;
