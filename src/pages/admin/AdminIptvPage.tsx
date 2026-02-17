import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Tv, Search, X, Save, Users, RefreshCw, Satellite, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const IPTV_STATUSES = [
  { value: "active", label: "🟢 Ativo" },
  { value: "blocked", label: "🔴 Bloqueado" },
  { value: "maintenance", label: "🟡 Em Manutenção" },
  { value: "unstable", label: "🟠 Com Instabilidade" },
  { value: "disabled", label: "⚫ Desativado" },
  { value: "awaiting_activation", label: "🔵 Aguardando Ativação" },
  { value: "awaiting_payment", label: "🟣 Aguardando Pagamento" },
];

const AdminIptvPage = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [tvApps, setTvApps] = useState<any[]>([]);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkField, setBulkField] = useState("iptv_status");
  const [bulkValue, setBulkValue] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const loadData = async () => {
    const [u, s, a] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("iptv_servers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
    ]);
    setUsers(u.data || []);
    setServers(s.data || []);
    setTvApps(a.data || []);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({
      iptv_server: u.iptv_server || "",
      iptv_status: u.iptv_status || "active",
      iptv_monthly_value: u.iptv_monthly_value || 0,
      iptv_due_day: u.iptv_due_day || 10,
      iptv_connections: u.iptv_connections || 1,
      iptv_tv_app: u.iptv_tv_app || "",
    });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_profile", user_id: editUser.id, data: editForm },
    });
    toast({ title: "IPTV atualizado para " + editUser.name });
    setSaving(false);
    setEditUser(null);
    loadData();
  };

  const bulkUpdate = async () => {
    if (selectedUsers.size === 0 || !bulkValue) return;
    const data: Record<string, any> = {};
    if (bulkField === "iptv_monthly_value" || bulkField === "iptv_due_day" || bulkField === "iptv_connections") {
      data[bulkField] = Number(bulkValue);
    } else {
      data[bulkField] = bulkValue;
    }
    const promises = Array.from(selectedUsers).map((uid) =>
      supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_profile", user_id: uid, data },
      })
    );
    await Promise.all(promises);
    toast({ title: `Atualizado para ${selectedUsers.size} clientes!` });
    setShowBulk(false);
    setSelectedUsers(new Set());
    setBulkValue("");
    loadData();
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selectedUsers);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedUsers(s);
  };

  const selectAll = () => {
    if (selectedUsers.size === filtered.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filtered.map((u) => u.id)));
  };

  const statusLabel = (s: string) => IPTV_STATUSES.find((x) => x.value === s)?.label || s;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Tv className="text-primary" /> Gerenciar IPTV
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} clientes</p>
        </div>
        <div className="flex gap-2">
          {selectedUsers.size > 0 && (
            <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
              <Users size={16} /> Massa ({selectedUsers.size})
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full rounded-lg border border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none" />
      </div>

      {/* Select all */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={selectAll} className="text-xs text-primary hover:underline">
          {selectedUsers.size === filtered.length ? "Desmarcar todos" : "Selecionar todos"}
        </button>
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filtered.map((u) => (
          <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30">
            <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelect(u.id)} className="h-4 w-4 rounded border-border accent-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                <span className="text-[10px] text-muted-foreground">@{u.username}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{u.iptv_server || "Sem servidor"}</span>
                <span className={`rounded px-1.5 py-0.5 ${u.iptv_status === "active" ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {statusLabel(u.iptv_status || "active")}
                </span>
                <span className="rounded bg-secondary/10 px-1.5 py-0.5 text-secondary">R$ {Number(u.iptv_monthly_value || 0).toFixed(2)}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{u.iptv_connections || 1} tela(s)</span>
              </div>
            </div>
            <button onClick={() => openEdit(u)} className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20">
              Editar
            </button>
          </motion.div>
        ))}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">IPTV · {editUser.name}</h2>
                <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                {/* Server */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Servidor</label>
                  <select value={editForm.iptv_server} onChange={(e) => setEditForm({ ...editForm, iptv_server: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                    <option value="">Selecione...</option>
                    {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                {/* Status */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                  <select value={editForm.iptv_status} onChange={(e) => setEditForm({ ...editForm, iptv_status: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                    {IPTV_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {/* Monthly value */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Valor Mensalidade (R$)</label>
                  <input type="number" step="0.01" value={editForm.iptv_monthly_value} onChange={(e) => setEditForm({ ...editForm, iptv_monthly_value: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
                {/* Due day */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Dia de Vencimento</label>
                  <input type="number" min="1" max="28" value={editForm.iptv_due_day} onChange={(e) => setEditForm({ ...editForm, iptv_due_day: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
                {/* Connections */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Conexões (Telas)</label>
                  <input type="number" min="1" value={editForm.iptv_connections} onChange={(e) => setEditForm({ ...editForm, iptv_connections: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
                {/* TV App */}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">App para TV</label>
                  <select value={editForm.iptv_tv_app} onChange={(e) => setEditForm({ ...editForm, iptv_tv_app: e.target.value })} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                    <option value="">Nenhum</option>
                    {tvApps.map((a) => <option key={a.id} value={a.name}>{a.icon} {a.name}</option>)}
                  </select>
                </div>
                <button onClick={saveEdit} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50">
                  <Save size={16} /> {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Modal */}
      <AnimatePresence>
        {showBulk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card w-full max-w-md rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Atualização em Massa</h2>
                <button onClick={() => setShowBulk(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{selectedUsers.size} clientes selecionados</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Campo</label>
                  <select value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                    <option value="iptv_status">Status</option>
                    <option value="iptv_server">Servidor</option>
                    <option value="iptv_monthly_value">Mensalidade</option>
                    <option value="iptv_due_day">Dia Vencimento</option>
                    <option value="iptv_connections">Conexões</option>
                    <option value="iptv_tv_app">App TV</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Novo Valor</label>
                  {bulkField === "iptv_status" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option value="">Selecione...</option>
                      {IPTV_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  ) : bulkField === "iptv_server" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option value="">Selecione...</option>
                      {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : bulkField === "iptv_tv_app" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option value="">Nenhum</option>
                      {tvApps.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                  ) : (
                    <input type="number" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  )}
                </div>
                <button onClick={bulkUpdate} className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110">
                  Aplicar para {selectedUsers.size} clientes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default AdminIptvPage;
