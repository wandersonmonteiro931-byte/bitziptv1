import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Tv, Search, X, Users, Filter } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StatsCards } from "./iptv/StatsCards";
import { ClientEditPanel } from "./iptv/ClientEditPanel";
import { IPTV_STATUSES, QUICK_FILTERS, getStatusInfo } from "./iptv/types";

const BULK_FIELDS = [
  { value: "iptv_status", label: "Status" },
  { value: "iptv_server", label: "Servidor" },
  { value: "iptv_monthly_value", label: "Mensalidade" },
  { value: "iptv_due_day", label: "Dia Vencimento" },
  { value: "iptv_connections", label: "Conexões" },
  { value: "iptv_tv_app", label: "App TV" },
  { value: "admin_notes", label: "Observação" },
  { value: "admin_notes_urgent", label: "Urgência da Obs." },
];

const AdminIptvPage = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [tvApps, setTvApps] = useState<any[]>([]);
  const [editUser, setEditUser] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState("all");
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

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-iptv-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const today = new Date().getDate();
    let list = users;

    // Quick filter
    if (activeFilter === "active") list = list.filter((u) => u.iptv_status === "active");
    else if (activeFilter === "blocked") list = list.filter((u) => u.iptv_status === "blocked");
    else if (activeFilter === "expiring") list = list.filter((u) => u.iptv_due_day === today && u.iptv_status === "active");
    else if (activeFilter === "expired") list = list.filter((u) => {
      if (!u.iptv_expiry) return false;
      return new Date(u.iptv_expiry) < new Date();
    });
    else if (activeFilter === "unstable") list = list.filter((u) => u.iptv_status === "unstable");
    else if (activeFilter === "awaiting_payment") list = list.filter((u) => u.iptv_status === "awaiting_payment");

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.iptv_client_code?.toLowerCase().includes(q) ||
          u.iptv_server?.toLowerCase().includes(q) ||
          u.iptv_user?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, search, activeFilter]);

  const toggleSelect = (id: string) => {
    const s = new Set(selectedUsers);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedUsers(s);
  };

  const selectAll = () => {
    if (selectedUsers.size === filtered.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filtered.map((u) => u.id)));
  };

  const bulkUpdate = async () => {
    if (selectedUsers.size === 0 || !bulkValue) return;
    const data: Record<string, any> = {};
    if (["iptv_monthly_value", "iptv_due_day", "iptv_connections"].includes(bulkField)) {
      data[bulkField] = Number(bulkValue);
    } else if (bulkField === "admin_notes_urgent") {
      data[bulkField] = bulkValue === "true";
    } else {
      data[bulkField] = bulkValue;
    }
    const promises = Array.from(selectedUsers).map((uid) =>
      supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_profile", user_id: uid, data },
      })
    );
    await Promise.all(promises);
    toast({ title: `✅ Atualizado para ${selectedUsers.size} clientes!` });
    setShowBulk(false);
    setSelectedUsers(new Set());
    setBulkValue("");
    loadData();
  };

  const inputCls = "w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all";

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Tv size={16} className="text-primary" />
            </div>
            Gerenciar IPTV
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{users.length} clientes cadastrados</p>
        </div>
        {selectedUsers.size > 0 && (
          <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 rounded-xl bg-secondary/15 px-4 py-2.5 text-xs font-semibold text-secondary hover:bg-secondary/25 transition-colors">
            <Users size={14} /> Massa ({selectedUsers.size})
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <StatsCards users={users} />

      {/* Quick Filters */}
      <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all ${
              activeFilter === f.key
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mt-3 mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, usuário, código, servidor..."
          className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Select all */}
      <div className="mb-2 flex items-center justify-between">
        <button onClick={selectAll} className="text-[11px] font-medium text-primary hover:underline">
          {selectedUsers.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
        </button>
        <span className="text-[10px] text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filtered.map((u, i) => {
          const si = getStatusInfo(u.iptv_status || "active");
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
            >
              <input
                type="checkbox"
                checked={selectedUsers.has(u.id)}
                onChange={() => toggleSelect(u.id)}
                className="h-4 w-4 shrink-0 rounded border-border accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                  {u.admin_notes_urgent && <span className="text-[10px]">🔴</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${si.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${si.dot}`} />
                    {si.label}
                  </span>
                  {u.iptv_server && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{u.iptv_server}</span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    R$ {Number(u.iptv_monthly_value || 0).toFixed(2)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {u.iptv_connections || 1} tela{(u.iptv_connections || 1) > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditUser(u)}
                className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                Editar
              </button>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        )}
      </div>

      {/* Edit Panel (Slide-in) */}
      <AnimatePresence>
        {editUser && (
          <ClientEditPanel
            user={editUser}
            servers={servers}
            tvApps={tvApps}
            onClose={() => setEditUser(null)}
            onSaved={() => { setEditUser(null); loadData(); }}
          />
        )}
      </AnimatePresence>

      {/* Bulk Modal */}
      <AnimatePresence>
        {showBulk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setShowBulk(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">⚡ Atualização em Massa</h2>
                <button onClick={() => setShowBulk(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <p className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                {selectedUsers.size} cliente{selectedUsers.size > 1 ? "s" : ""} selecionado{selectedUsers.size > 1 ? "s" : ""}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Campo</label>
                  <select value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }} className={inputCls}>
                    {BULK_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Novo Valor</label>
                  {bulkField === "iptv_status" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={inputCls}>
                      <option value="">Selecione...</option>
                      {IPTV_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  ) : bulkField === "iptv_server" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={inputCls}>
                      <option value="">Selecione...</option>
                      {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : bulkField === "iptv_tv_app" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={inputCls}>
                      <option value="">Nenhum</option>
                      {tvApps.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                  ) : bulkField === "admin_notes_urgent" ? (
                    <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={inputCls}>
                      <option value="">Selecione...</option>
                      <option value="true">⚠️ Urgente</option>
                      <option value="false">Normal</option>
                    </select>
                  ) : bulkField === "admin_notes" ? (
                    <textarea value={bulkValue} onChange={(e) => setBulkValue(e.target.value.slice(0, 5000))} rows={3} placeholder="Observação..." className={`${inputCls} resize-none`} />
                  ) : (
                    <input type="number" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className={inputCls} />
                  )}
                </div>
                <button
                  onClick={bulkUpdate}
                  disabled={!bulkValue}
                  className="w-full rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground shadow-lg shadow-secondary/20 hover:brightness-110 disabled:opacity-50 transition-all"
                >
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
