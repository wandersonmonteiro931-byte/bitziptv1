import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Plus,
  Ban,
  Trash2,
  DollarSign,
  X,
  Snowflake,
  Eye,
  UsersRound,
  History,
  Filter,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Save,
  Archive,
  RotateCcw,
  Gift,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateBRT } from "@/lib/utils";

const statusBadge: Record<string, string> = {
  active: "bg-success/15 text-success",
  suspended: "bg-warning/15 text-warning",
  blocked: "bg-destructive/15 text-destructive",
};

// Parser for IPTV credential text blocks
const parseIptvText = (text: string) => {
  const result: Record<string, string> = {};

  // Username - multiple formats: 👤 Usuário, ✅ Usuário, 👥 USUÁRIO
  const userMatch = text.match(/(?:👤|✅|👥)\s*\*?Usuário:?\*?\s*(\S+)/i);
  if (userMatch) result.username = userMatch[1].trim();

  // Password - multiple formats: 🔑 Senha, ✅ Senha, 🔐 SENHA
  const passMatch = text.match(/(?:🔑|✅|🔐)\s*\*?Senha:?\*?\s*(\S+)/i);
  if (passMatch) result.password = passMatch[1].trim();

  // Price
  const priceMatch = text.match(/💵\s*\*?Preço[^:]*:?\*?\s*R\$\s*([\d.,]+)/i);
  if (priceMatch) result.monthly_value = priceMatch[1].replace(",", ".").trim();

  // Expiry - supports dd/mm/yyyy and dd/mm/yyyy hh:mm:ss
  const expiryMatch = text.match(/(?:🗓️|⏳)\s*\*?Vencimento:?\*?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (expiryMatch) {
    const [d, m, y] = expiryMatch[1].split("/");
    result.expiry = `${y}-${m}-${d}`;
  }

  // Connections
  const connMatch = text.match(/📶\s*\*?Conexões:?\*?\s*(\d+)/i);
  if (connMatch) result.connections = connMatch[1].trim();

  // Server/DNS
  const dnsMatch =
    text.match(/🌀\s*\*?DNS[^:]*:?\*?\s*https?:\/?\/?([^\s/]+)/i) ||
    text.match(/✅\s*\*?DNS\*?\s*https?:\/?\/?([^\s/]+)/i);
  if (dnsMatch) result.server = dnsMatch[1].trim();

  // Plan
  const planMatch = text.match(/📦\s*\*?Plano:?\*?\s*(.+)/i);
  if (planMatch) result.plan = planMatch[1].replace(/\*/g, "").trim();

  // Detect server from plan name (e.g. "BLESSED DYNAMIX" → DYNAMIX)
  if (!result.server && result.plan) {
    const planUpper = result.plan.toUpperCase();
    const knownServers = ["DYNAMIX", "SPACE", "7PLAY", "TECK", "LIVE"];
    for (const srv of knownServers) {
      if (planUpper.includes(srv)) {
        result.server = srv;
        break;
      }
    }
  }

  return result;
};

const AdminUsersPage = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showAutoRegister, setShowAutoRegister] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [parsedData, setParsedData] = useState<Record<string, string> | null>(null);
  const [autoName, setAutoName] = useState("");
  const [autoEmail, setAutoEmail] = useState("");
  const [autoReferredByCode, setAutoReferredByCode] = useState("");
  const [autoCreating, setAutoCreating] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState<any>(null);
  const [showBulkAdjust, setShowBulkAdjust] = useState(false);
  const [showUserHistory, setShowUserHistory] = useState<any>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceDesc, setBalanceDesc] = useState("");
  const [balanceMode, setBalanceMode] = useState<"adjust" | "set">("adjust");
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkDesc, setBulkDesc] = useState("");
  const [bulkMode, setBulkMode] = useState<"add" | "remove" | "set">("add");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "client",
    iptv_user: "",
    iptv_server: "",
    iptv_app: "",
    iptv_expiry: "",
    referred_by_code: "",
  });
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("iptv_client_code", { ascending: true });
    setUsers(data || []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase());
    if (showArchived) return matchSearch && u.status === "archived";
    return matchSearch && u.status !== "archived";
  });

  const handlePasteAnalyze = () => {
    if (!pastedText.trim()) return;
    const parsed = parseIptvText(pastedText);
    setParsedData(parsed);
  };

  const buildDefaultNotes = (username: string, password: string) => {
    return `SEUS DADOS DE ACESSO:\n\nASSIST PLUS E BLESSED PLAYER\n\nUSUÁRIO: ${username}\nSENHA: ${password}`;
  };

  const handleAutoRegister = async () => {
    if (!parsedData?.username || !autoName.trim()) {
      toast({ title: "Erro", description: "Nome e dados IPTV são obrigatórios", variant: "destructive" });
      return;
    }
    setAutoCreating(true);
    const iptvUser = parsedData.username;
    const iptvPass = parsedData.password || parsedData.username;
    const res = await supabase.functions.invoke("admin-create-user", {
      body: {
        name: autoName.trim(),
        username: iptvUser,
        email: autoEmail.trim() || undefined,
        iptv_user: iptvUser,
        iptv_password: iptvPass,
        iptv_server: parsedData.server || "",
        iptv_expiry: parsedData.expiry || null,
        iptv_connections: parsedData.connections ? parseInt(parsedData.connections) : 1,
        iptv_monthly_value: parsedData.monthly_value ? parseFloat(parsedData.monthly_value) : 0,
        iptv_status: "active",
        referred_by_code: autoReferredByCode.trim().toUpperCase() || undefined,
        admin_notes: buildDefaultNotes(iptvUser, iptvPass),
      },
    });
    setAutoCreating(false);
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Cliente cadastrado com sucesso!", description: `Login: ${iptvUser} · Senha: ${iptvPass}` });
      setShowAutoRegister(false);
      setPastedText("");
      setParsedData(null);
      setAutoName("");
      setAutoEmail("");
      setAutoReferredByCode("");
      loadUsers();
    }
  };

  const createUser = async () => {
    if (!form.name || !form.username || !form.password) {
      toast({ title: "Erro", description: "Preencha nome, usuário e senha", variant: "destructive" });
      return;
    }
    setCreating(true);
    const res = await supabase.functions.invoke("admin-create-user", {
      body: { ...form, referred_by_code: form.referred_by_code.trim().toUpperCase() || undefined },
    });
    setCreating(false);
    if (res.error || res.data?.error) {
      toast({ title: "Erro", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({
        title: "Usuário criado com sucesso!",
        description: "Login liberado pelo Usuário IPTV/Username e senha informada.",
      });
      setShowCreate(false);
      setForm({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "client",
        iptv_user: "",
        iptv_server: "",
        iptv_app: "",
        iptv_expiry: "",
        referred_by_code: "",
      });
      loadUsers();
    }
  };

  const openEditUser = (u: any) => {
    setEditUser(u);
    setEditForm({
      name: u.name || "",
      username: u.username || "",
      iptv_user: u.iptv_user || "",
      iptv_password: u.iptv_password || "",
      iptv_server: u.iptv_server || "",
      iptv_app: u.iptv_app || "",
      iptv_tv_app: u.iptv_tv_app || "",
      iptv_expiry: u.iptv_expiry || "",
      iptv_status: u.iptv_status || "active",
      iptv_connections: u.iptv_connections || 1,
      iptv_monthly_value: u.iptv_monthly_value || 0,
      iptv_due_day: u.iptv_due_day || 10,
      iptv_client_code: u.iptv_client_code || "",
      referral_code: u.referral_code || "",
      referred_by: u.referred_by || "",
      referred_by_code_input: "",
      pix_key: u.pix_key || "",
      status: u.status || "active",
    });
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    setEditSaving(true);

    // Update profile fields
    const profileData = { ...editForm };
    delete profileData.username; // username handled separately
    delete profileData.referral_code; // código de indicação é sequencial e controlado pelo banco
    delete profileData.referred_by; // vínculo de indicação é tratado em ação separada
    delete profileData.referred_by_code_input; // campo auxiliar da tela

    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_profile", user_id: editUser.id, data: profileData },
    });

    // If password changed, also update auth password
    if (editForm.iptv_password && editForm.iptv_password !== editUser.iptv_password) {
      await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reset_password", user_id: editUser.id, data: { password: editForm.iptv_password } },
      });
    }

    toast({ title: "✅ Dados atualizados com sucesso!" });
    setEditUser(null);
    setEditSaving(false);
    loadUsers();
  };

  const linkReferralForEditUser = async () => {
    if (!editUser) return;

    const code = String(editForm.referred_by_code_input || "")
      .trim()
      .toUpperCase();
    if (!code) {
      toast({ title: "Informe o código de indicação", description: "Exemplo: WMC001A", variant: "destructive" });
      return;
    }

    setEditSaving(true);
    type AdminSetReferrerResult = {
      error?: string;
      already_linked?: boolean;
      referrer_id?: string;
    };
    const res = (await (supabase.rpc as unknown as (
      fn: "admin_set_referrer_by_code",
      args: { p_user_id: string; p_referral_code: string },
    ) => Promise<{ data: AdminSetReferrerResult | null; error: { message?: string } | null }>)("admin_set_referrer_by_code", {
      p_user_id: editUser.id,
      p_referral_code: code,
    })) as { data: AdminSetReferrerResult | null; error: { message?: string } | null };
    setEditSaving(false);

    if (res.error || res.data?.error) {
      toast({
        title: "Erro ao vincular indicação",
        description: res.data?.error || res.error?.message || "Verifique se a migration RPC foi aplicada no Supabase.",
        variant: "destructive",
      });
      return;
    }

    if (res.data?.already_linked) {
      toast({
        title: "Indicação já vinculada",
        description: "Este cliente já está ligado a uma indicação.",
      });
    } else {
      toast({
        title: "✅ Indicação vinculada",
        description: "Agora esse cliente aparece como aguardando o 1º pagamento na tela de indicações.",
      });
    }

    setEditForm({
      ...editForm,
      referred_by: res.data?.referrer_id || true,
      referred_by_code_input: "",
    });
    setEditUser({ ...editUser, referred_by: res.data?.referrer_id || true });
    await loadUsers();
  };

  const updateStatus = async (userId: string, status: string) => {
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_status", user_id: userId, data: { status } },
    });
    toast({ title: `Status atualizado para ${status}` });
    loadUsers();
  };

  const toggleFreeze = async (userId: string, currentlyFrozen: boolean) => {
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_profile", user_id: userId, data: { balance_frozen: !currentlyFrozen } },
    });
    toast({ title: currentlyFrozen ? "Saldo descongelado!" : "Saldo congelado!" });
    loadUsers();
  };

  const adjustBalance = async () => {
    if (!showBalanceAdjust || !balanceAmount) return;
    if (!balanceDesc.trim()) {
      toast({ title: "Erro", description: "Observação obrigatória ao ajustar saldo", variant: "destructive" });
      return;
    }
    const val = parseFloat(balanceAmount);
    if (balanceMode === "set") {
      // Set balance to exact value: calculate diff
      const diff = val - Number(showBalanceAdjust.balance);
      await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "adjust_balance",
          user_id: showBalanceAdjust.id,
          data: { amount: diff, description: balanceDesc },
        },
      });
    } else {
      await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "adjust_balance",
          user_id: showBalanceAdjust.id,
          data: { amount: val, description: balanceDesc },
        },
      });
    }
    toast({ title: "Saldo ajustado!" });
    setShowBalanceAdjust(null);
    setBalanceAmount("");
    setBalanceDesc("");
    loadUsers();
  };

  const bulkAdjust = async () => {
    if (selectedUsers.size === 0 || !bulkAmount) {
      toast({ title: "Erro", description: "Selecione usuários e informe o valor", variant: "destructive" });
      return;
    }
    if (!bulkDesc.trim()) {
      toast({ title: "Erro", description: "Observação obrigatória", variant: "destructive" });
      return;
    }

    const val = parseFloat(bulkAmount);
    const promises = Array.from(selectedUsers).map(async (userId) => {
      const u = users.find((x) => x.id === userId);
      let amount = val;
      if (bulkMode === "remove") amount = -val;
      if (bulkMode === "set" && u) amount = val - Number(u.balance);
      return supabase.functions.invoke("admin-manage-user", {
        body: { action: "adjust_balance", user_id: userId, data: { amount, description: bulkDesc } },
      });
    });

    await Promise.all(promises);
    toast({ title: `Saldo ajustado para ${selectedUsers.size} usuários!` });
    setShowBulkAdjust(false);
    setSelectedUsers(new Set());
    setBulkAmount("");
    setBulkDesc("");
    loadUsers();
  };

  const archiveUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja arquivar este cliente? Ele será deslogado e poderá ser reativado depois."))
      return;
    // Optimistic: remove from list immediately
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "archived" } : u)));
    const res = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "archive_user", user_id: userId, data: {} },
    });
    if (res.error || res.data?.error) {
      toast({ title: "Erro ao arquivar", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Cliente arquivado e deslogado!" });
    }
    loadUsers();
  };

  const reactivateUser = async (userId: string) => {
    if (!confirm("Reativar este cliente?")) return;
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "reactivate_user", user_id: userId, data: {} },
    });
    toast({ title: "Cliente reativado com sucesso!" });
    loadUsers();
  };

  const viewHistory = async (u: any) => {
    setShowUserHistory(u);
    setHistoryFilter("all");
    const { data } = await supabase
      .from("balance_history")
      .select("*")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setUserHistory(data || []);
  };

  const toggleSelect = (id: string) => {
    const s = new Set(selectedUsers);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedUsers(s);
  };

  const selectAll = () => {
    if (selectedUsers.size === filtered.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filtered.map((u) => u.id)));
    }
  };

  const filteredHistory = historyFilter === "all" ? userHistory : userHistory.filter((h) => h.type === historyFilter);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Users className="text-primary" /> Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
        </div>
        <div className="flex gap-2">
          {selectedUsers.size > 0 && (
            <button
              onClick={() => setShowBulkAdjust(true)}
              className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-all hover:brightness-110"
            >
              <UsersRound size={16} /> Ajuste em Massa ({selectedUsers.size})
            </button>
          )}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:brightness-110 ${showArchived ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Archive size={16} /> {showArchived ? "Ver Ativos" : "Arquivados"}
          </button>
          <button
            onClick={() => {
              setShowAutoRegister(true);
              setPastedText("");
              setParsedData(null);
              setAutoName("");
              setAutoEmail("");
              setAutoReferredByCode("");
            }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-all hover:brightness-110"
          >
            <ClipboardPaste size={16} /> Cadastro Automático
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
          >
            <Plus size={16} /> Criar Usuário
          </button>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Criar Usuário</h2>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { key: "name", label: "Nome completo", type: "text" },
                  { key: "username", label: "Username IPTV", type: "text" },
                  { key: "email", label: "E-mail do cliente (opcional, não usar para login)", type: "email" },
                  { key: "password", label: "Senha", type: "password" },
                  { key: "iptv_user", label: "Usuário IPTV", type: "text" },
                  { key: "iptv_server", label: "Servidor IPTV", type: "text" },
                  { key: "iptv_app", label: "App IPTV", type: "text" },
                  { key: "iptv_expiry", label: "Vencimento IPTV", type: "date" },
                  {
                    key: "referred_by_code",
                    label: "Código de indicação recebido (opcional) — Ex: WMC001A",
                    type: "text",
                  },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
                    <input
                      type={f.type}
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                    {f.key === "email" && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Login do cliente será pelo Usuário IPTV/Username, não por esse e-mail.
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Função</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="client">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {creating ? "Criando..." : "Criar Usuário"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto Register Modal */}
      <AnimatePresence>
        {showAutoRegister && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                  <ClipboardPaste size={20} className="text-primary" /> Cadastro Automático
                </h2>
                <button
                  onClick={() => setShowAutoRegister(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                Cole o texto com as credenciais IPTV do cliente abaixo. O sistema irá extrair automaticamente os dados
                necessários.
              </p>

              {/* Step 1: Paste */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  📋 Texto com credenciais IPTV
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    setParsedData(null);
                  }}
                  rows={6}
                  placeholder="Cole aqui o texto com as informações do cliente (usuário, senha, DNS, vencimento, etc.)..."
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none font-mono"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          setPastedText(text);
                          setParsedData(null);
                          toast({ title: "📋 Texto colado da área de transferência!" });
                        }
                      } catch {
                        toast({
                          title: "Erro",
                          description: "Permita o acesso à área de transferência",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:brightness-110"
                  >
                    <ClipboardPaste size={14} /> Colar
                  </button>
                  <button
                    onClick={handlePasteAnalyze}
                    disabled={!pastedText.trim()}
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:brightness-110 disabled:opacity-50"
                  >
                    🔍 Analisar Texto
                  </button>
                </div>
              </div>

              {/* Step 2: Parsed Results - Editable */}
              {parsedData && (
                <div className="mb-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-success" /> Dados Extraídos (editáveis)
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Usuário IPTV *", key: "username", type: "text" },
                      { label: "Senha IPTV", key: "password", type: "text" },
                      { label: "Servidor/DNS", key: "server", type: "text" },
                      { label: "Vencimento", key: "expiry", type: "date" },
                      { label: "Conexões", key: "connections", type: "number" },
                      { label: "Valor Mensal (R$)", key: "monthly_value", type: "number" },
                    ].map((item) => (
                      <div key={item.key}>
                        <label className="mb-1 block text-[10px] uppercase text-muted-foreground">{item.label}</label>
                        <input
                          type={item.type}
                          value={parsedData[item.key] || ""}
                          onChange={(e) => setParsedData({ ...parsedData, [item.key]: e.target.value })}
                          step={item.type === "number" ? "0.01" : undefined}
                          className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  {parsedData.plan && (
                    <div className="rounded-lg bg-muted/30 px-3 py-2">
                      <span className="text-[10px] uppercase text-muted-foreground">Plano detectado</span>
                      <p className="text-sm font-medium text-foreground">{parsedData.plan}</p>
                    </div>
                  )}

                  {!parsedData.username && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle size={16} /> Preencha o campo Usuário IPTV.
                    </div>
                  )}

                  {parsedData.username && (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <h3 className="text-sm font-semibold text-foreground">Dados do Cliente</h3>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Nome do cliente *</label>
                        <input
                          type="text"
                          value={autoName}
                          onChange={(e) => setAutoName(e.target.value)}
                          placeholder="Nome completo do cliente"
                          className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">E-mail (opcional)</label>
                        <input
                          type="email"
                          value={autoEmail}
                          onChange={(e) => setAutoEmail(e.target.value)}
                          placeholder="email@exemplo.com"
                          className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Gift size={13} /> Código de indicação recebido (opcional)
                        </label>
                        <input
                          type="text"
                          value={autoReferredByCode}
                          onChange={(e) => setAutoReferredByCode(e.target.value.toUpperCase())}
                          placeholder="Ex: WMC001A"
                          className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm uppercase text-foreground focus:border-primary focus:outline-none"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Quando esse cliente fizer o 1º pagamento, o dono do código ganha 1 mês grátis automaticamente.
                          O código do cliente novo será gerado em ordem: WMC001A, WMC002A...
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        💡 Login: <strong>Usuário:</strong> {parsedData.username} · <strong>Senha:</strong>{" "}
                        {parsedData.password || parsedData.username}
                        {!autoEmail && (
                          <span>
                            {" "}
                            · E-mail auto: <strong>{parsedData.username}@iptv.bitz</strong>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleAutoRegister}
                        disabled={autoCreating || !autoName.trim()}
                        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                      >
                        {autoCreating ? "Cadastrando..." : "✅ Cadastrar Cliente"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Balance Adjust Modal */}
      <AnimatePresence>
        {showBalanceAdjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm rounded-2xl p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Ajustar Saldo</h2>
                <button
                  onClick={() => setShowBalanceAdjust(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                {showBalanceAdjust.name} · Saldo: R$ {Number(showBalanceAdjust.balance).toFixed(2)}
              </p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setBalanceMode("adjust")}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${balanceMode === "adjust" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}
                  >
                    Adicionar/Remover
                  </button>
                  <button
                    onClick={() => setBalanceMode("set")}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${balanceMode === "set" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}
                  >
                    Definir Valor
                  </button>
                </div>
                <input
                  type="number"
                  placeholder={balanceMode === "set" ? "Novo saldo exato" : "Valor (+ ou -)"}
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <input
                  placeholder="Observação (obrigatória)"
                  value={balanceDesc}
                  onChange={(e) => setBalanceDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  onClick={adjustBalance}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110"
                >
                  Aplicar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Adjust Modal */}
      <AnimatePresence>
        {showBulkAdjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-md rounded-2xl p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Ajuste em Massa</h2>
                <button
                  onClick={() => setShowBulkAdjust(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{selectedUsers.size} usuários selecionados</p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["add", "remove", "set"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setBulkMode(m)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium ${bulkMode === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}
                    >
                      {m === "add" ? "Adicionar" : m === "remove" ? "Remover" : "Definir"}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Valor"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <input
                  placeholder="Observação (obrigatória)"
                  value={bulkDesc}
                  onChange={(e) => setBulkDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  onClick={bulkAdjust}
                  className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:brightness-110"
                >
                  Aplicar para {selectedUsers.size} usuários
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User History Modal */}
      <AnimatePresence>
        {showUserHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Histórico · {showUserHistory.name}</h2>
                <button
                  onClick={() => setShowUserHistory(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Saldo atual: R$ {Number(showUserHistory.balance).toFixed(2)} · Total ganho: R${" "}
                {Number(showUserHistory.total_earned).toFixed(2)}
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {["all", "credit", "debit", "withdrawal", "mission", "referral"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${historyFilter === f ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}
                  >
                    {f === "all"
                      ? "Todos"
                      : f === "credit"
                        ? "Crédito"
                        : f === "debit"
                          ? "Débito"
                          : f === "withdrawal"
                            ? "Saque"
                            : f === "mission"
                              ? "Missão"
                              : "Indicação"}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                )}
                {filteredHistory.map((item) => {
                  const isDebit = item.type === "debit" || item.type === "withdrawal";
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateBRT(item.created_at, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px]">{item.type}</span>
                        </p>
                      </div>
                      <span className={`text-sm font-semibold ${isDebit ? "text-destructive" : "text-success"}`}>
                        {isDebit ? "-" : "+"}R$ {Number(item.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search */}

      {/* Edit User Modal */}
      <AnimatePresence>
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                  <Pencil size={18} className="text-primary" /> Editar Cliente · {editUser.name}
                </h2>
                <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Dados Pessoais */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    👤 Dados Pessoais
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Username</label>
                      <input
                        value={editForm.username}
                        disabled
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Gift size={13} /> Código de Indicação
                      </label>
                      <input
                        value={editForm.referral_code || ""}
                        readOnly
                        placeholder="WMC001A"
                        className="w-full cursor-copy rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-sm font-semibold uppercase text-red-300 focus:border-red-500/50 focus:outline-none"
                        onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Código sequencial automático para indicar novos clientes.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Status Plataforma</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="active">Ativo</option>
                        <option value="suspended">Suspenso</option>
                        <option value="blocked">Bloqueado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Chave PIX</label>
                    <input
                      value={editForm.pix_key}
                      onChange={(e) => setEditForm({ ...editForm, pix_key: e.target.value })}
                      placeholder="CPF, telefone, e-mail..."
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Indicação recebida */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    🎁 Indicação Recebida
                  </p>
                  {editForm.referred_by ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
                      Este cliente já está vinculado a uma indicação. Quando ele fizer o 1º pagamento, o indicador ganha
                      1 mês grátis automaticamente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Código de quem indicou este cliente
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={editForm.referred_by_code_input || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, referred_by_code_input: e.target.value.toUpperCase() })
                          }
                          placeholder="Ex: WMC001A"
                          className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm uppercase text-foreground focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={linkReferralForEditUser}
                          disabled={editSaving || !String(editForm.referred_by_code_input || "").trim()}
                          className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          Vincular
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Use para clientes antigos cadastrados pelo admin que ainda não aparecem na tela de indicações.
                      </p>
                    </div>
                  )}
                </div>

                {/* Dados IPTV */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📺 Dados IPTV</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Usuário IPTV</label>
                      <input
                        value={editForm.iptv_user}
                        onChange={(e) => setEditForm({ ...editForm, iptv_user: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Senha IPTV</label>
                      <input
                        value={editForm.iptv_password}
                        onChange={(e) => setEditForm({ ...editForm, iptv_password: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Servidor</label>
                      <input
                        value={editForm.iptv_server}
                        onChange={(e) => setEditForm({ ...editForm, iptv_server: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">App IPTV</label>
                      <input
                        value={editForm.iptv_app}
                        onChange={(e) => setEditForm({ ...editForm, iptv_app: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">App TV</label>
                      <input
                        value={editForm.iptv_tv_app}
                        onChange={(e) => setEditForm({ ...editForm, iptv_tv_app: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Código Cliente</label>
                      <input
                        value={editForm.iptv_client_code}
                        onChange={(e) => setEditForm({ ...editForm, iptv_client_code: e.target.value })}
                        placeholder="BTZ-XXXXX"
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Status IPTV</label>
                      <select
                        value={editForm.iptv_status}
                        onChange={(e) => setEditForm({ ...editForm, iptv_status: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="active">Ativo</option>
                        <option value="blocked">Bloqueado</option>
                        <option value="maintenance">Em Manutenção</option>
                        <option value="unstable">Instabilidade</option>
                        <option value="disabled">Desativado</option>
                        <option value="awaiting_activation">Aguardando Ativação</option>
                        <option value="awaiting_payment">Aguardando Pagamento</option>
                        <option value="trust_active">Ativo em Confiança</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Vencimento IPTV</label>
                      <input
                        type="date"
                        value={editForm.iptv_expiry}
                        onChange={(e) => setEditForm({ ...editForm, iptv_expiry: e.target.value })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Financeiro */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💰 Financeiro</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Valor Mensal (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.iptv_monthly_value}
                        onChange={(e) => setEditForm({ ...editForm, iptv_monthly_value: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Conexões</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.iptv_connections}
                        onChange={(e) => setEditForm({ ...editForm, iptv_connections: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={editForm.iptv_due_day}
                        onChange={(e) => setEditForm({ ...editForm, iptv_due_day: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    💡 Valor total:{" "}
                    <strong>
                      R$ {(Number(editForm.iptv_monthly_value) * Number(editForm.iptv_connections)).toFixed(2)}
                    </strong>
                    /mês
                  </div>
                </div>

                <button
                  onClick={saveEditUser}
                  disabled={editSaving}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  <Save size={16} />
                  {editSaving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/50 py-3 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Buscar por nome ou usuário..."
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Código</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Saldo</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/20"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-primary">{user.iptv_client_code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    {user.referral_code && (
                      <p className="mt-0.5 text-[10px] font-semibold text-red-400">Indicação: {user.referral_code}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">R$ {Number(user.balance).toFixed(2)}</span>
                    {user.balance_frozen && (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        <Snowflake size={10} /> Congelado
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[user.status] || ""}`}
                    >
                      {user.status === "active" ? "Ativo" : user.status === "suspended" ? "Suspenso" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditUser(user)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setShowBalanceAdjust(user)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Ajustar saldo"
                      >
                        <DollarSign size={16} />
                      </button>
                      <button
                        onClick={() => viewHistory(user)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Histórico"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => toggleFreeze(user.id, user.balance_frozen)}
                        className={`rounded-lg p-1.5 ${user.balance_frozen ? "text-destructive" : "text-muted-foreground"} hover:bg-muted hover:text-foreground`}
                        title={user.balance_frozen ? "Descongelar" : "Congelar"}
                      >
                        <Snowflake size={16} />
                      </button>
                      {user.status === "archived" ? (
                        <button
                          onClick={() => reactivateUser(user.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-success/10 hover:text-success"
                          title="Reativar"
                        >
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => updateStatus(user.id, user.status === "active" ? "suspended" : "active")}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={user.status === "active" ? "Suspender" : "Ativar"}
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={() => archiveUser(user.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Arquivar"
                          >
                            <Archive size={16} />
                          </button>
                        </>
                      )}
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
