import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Eye,
  EyeOff,
  ShieldAlert,
  Lock,
  Unlock,
  RotateCcw,
  LogOut,
  Tv,
  Wallet,
  History,
  Settings,
  User,
  CreditCard,
  CalendarCheck,
  Trash2,
  RotateCw,
  TrendingUp,
  Plus,
  Pencil,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TV_STATUSES, getStatusInfo } from "./types";
import { formatDateBRT, formatDateTimeBRT } from "@/lib/utils";
import { useAppBranding } from "@/hooks/useAppBranding";
import { invokeAuthenticatedFunction } from "@/lib/edgeFunctions";


const getTodayDateOnly = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
};

const getNextDateByDay = (day: number) => {
  const today = new Date(`${getTodayDateOnly()}T00:00:00`);
  const safeDay = Math.max(1, Math.min(31, Number(day || 10)));
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let due = new Date(today.getFullYear(), today.getMonth(), Math.min(safeDay, lastDay));

  if (due < today) {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    due = new Date(next.getFullYear(), next.getMonth(), Math.min(safeDay, nextLastDay));
  }

  const offset = due.getTimezoneOffset();
  return new Date(due.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
};

const getDayFromDateOnly = (value: string) => {
  if (!value) return 0;
  const day = Number(String(value).split("-")[2] || 0);
  return Math.max(1, Math.min(31, day));
};

const addMonthsToDateOnlyByFixedDay = (dateOnly: string, months: number) => {
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  const safeMonths = Math.max(1, Number(months || 1));
  const dueDay = Math.max(1, Math.min(31, Number(day || 1)));
  const targetMonthIndex = (month || 1) - 1 + safeMonths;
  const targetYear = (year || new Date().getFullYear()) + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  return `${targetYear}-${String(normalizedMonthIndex + 1).padStart(2, "0")}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
};


const broadcastClientProfileUpdate = (userId: string, payload: Record<string, any>) => {
  const data = {
    user_id: userId,
    sentAt: Date.now(),
    profile: payload,
  };

  try {
    localStorage.setItem("wmcplayer_client_profile_update", JSON.stringify(data));
  } catch {
    // opcional
  }

  try {
    window.dispatchEvent(new CustomEvent("wmcplayer-client-profile-update", { detail: data }));
  } catch {
    // opcional
  }
};

const broadcastFinanceUpdate = (userId: string, payload: Record<string, any> = {}) => {
  const data = { user_id: userId, sentAt: Date.now(), ...payload };
  try {
    window.dispatchEvent(new CustomEvent("wmcplayer-finance-updated", { detail: data }));
  } catch {
    // opcional
  }
};


const TABS = [
  { key: "overview", label: "Visão Geral", icon: User },
  { key: "financial", label: "Financeiro", icon: Wallet },
  { key: "access", label: "Acesso", icon: Lock },
  { key: "system", label: "Sistema", icon: Settings },
  { key: "history", label: "Histórico", icon: History },
];

interface Props {
  user: any;
  servers: any[];
  tvApps: any[];
  onClose: () => void;
  onSaved: () => void;
}

export function ClientEditPanel({ user, servers, tvApps, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const { appName, logoUrl } = useAppBranding();
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualPaymentForm, setManualPaymentForm] = useState({
    amount: "",
    payment_date: "",
    period_start: "",
    period_end: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({ months: 1, amount: "", notes: "" });
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "past" | "future">("all");
  const [scheduledRates, setScheduledRates] = useState<any[]>([]);
  const [rateForm, setRateForm] = useState({ new_monthly_value: "", effective_date: "", notes: "" });
  const [showRateForm, setShowRateForm] = useState(false);
  const [billingDueDates, setBillingDueDates] = useState<any[]>([]);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editRateForm, setEditRateForm] = useState({ new_monthly_value: "", effective_date: "", notes: "" });
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({ amount: "", notes: "" });
  const [form, setForm] = useState({
    iptv_server: user.iptv_server || "",
    iptv_status: user.iptv_status || "active",
    iptv_monthly_value: user.iptv_monthly_value || 0,

    iptv_connections: user.iptv_connections || 1,
    iptv_tv_app: user.iptv_tv_app || "",
    iptv_client_code: user.iptv_client_code || "",
    iptv_user: user.iptv_user || "",
    iptv_password: user.iptv_password || "",
    iptv_app: user.iptv_app || "",
    iptv_expiry: user.iptv_expiry || "",
    billing_due_date_id: user.billing_due_date_id || "",
    billing_proportional_enabled: Boolean(user.billing_proportional_enabled),
    admin_notes: user.admin_notes || "",
    admin_notes_urgent: user.admin_notes_urgent || false,
    name: user.name || "",
  });

  const totalValue = Number(form.iptv_monthly_value) * Number(form.iptv_connections);
  const statusInfo = getStatusInfo(form.iptv_status);
  const selectedBillingDueDate = billingDueDates.find((item: any) => item.id === (form as any).billing_due_date_id);
  const fixedBillingDay = Number(form.iptv_expiry ? getDayFromDateOnly(form.iptv_expiry) : selectedBillingDueDate?.day_of_month || (form as any).iptv_due_day || 10);
  const fixedBillingGraceDays = Number(selectedBillingDueDate?.grace_days ?? 5);

  useEffect(() => {
    (supabase as any)
      .from("billing_due_dates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("day_of_month", { ascending: true })
      .then(({ data }: any) => setBillingDueDates(data || []));
  }, []);
  const appTitle = (appName || "WMCFLIX").trim().toUpperCase();
  const tvAppOptions = useMemo(() => {
    const normalizedTitle = appTitle.toLowerCase();
    const existingApps = Array.isArray(tvApps) ? tvApps : [];
    const filteredApps = existingApps.filter((app) => {
      const name = String(app?.name || "")
        .trim()
        .toLowerCase();
      return name !== "wmcflix" && name !== normalizedTitle;
    });

    return [{ id: "wmcflix-oficial", name: appTitle, icon: "", logoUrl, isOfficialWmcflix: true }, ...filteredApps];
  }, [tvApps, appTitle, logoUrl]);
  const selectedTvApp = tvAppOptions.find((app) => app.name === form.iptv_tv_app);

  const loadLogs = useCallback(async (force = false) => {
    if (logsLoaded && !force) return;
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .eq("target_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data || []);
    setLogsLoaded(true);
  }, [user.id, logsLoaded]);

  const loadPayments = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("iptv_payments")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "pix_pending")
      .order("period_start", { ascending: true })
      .limit(50);
    setPayments(data || []);
    setPaymentsLoaded(true);
  }, [user.id]);

  const loadScheduledRates = useCallback(async () => {
    const { data } = await supabase
      .from("iptv_scheduled_rates")
      .select("*")
      .eq("user_id", user.id)
      .order("effective_date", { ascending: true });
    setScheduledRates(data || []);
  }, [user.id]);

  useEffect(() => {
    if (tab === "financial") {
      void loadPayments();
      void loadScheduledRates();
    }
    if (tab === "history") void loadLogs();
  }, [tab, loadPayments, loadScheduledRates, loadLogs]);

  useEffect(() => {
    if (!user?.id) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshFinance = (payload?: any) => {
      if (payload?.user_id && payload.user_id !== user.id) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadPayments();
        void loadScheduledRates();
        if (tab === "history") void loadLogs(true);
        onSaved();
      }, 80);
    };

    const onFinanceUpdate = (event: Event) => refreshFinance((event as CustomEvent)?.detail);
    window.addEventListener("wmcplayer-finance-updated", onFinanceUpdate);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("wmcplayer-finance-updated", onFinanceUpdate);
    };
  }, [user.id, tab, loadPayments, loadScheduledRates, loadLogs, onSaved]);

  const saveForm = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };

      // Data exata sempre manda em tudo: validade, dia financeiro e tela do cliente.
      if (payload.iptv_expiry) {
        payload.iptv_due_day = getDayFromDateOnly(payload.iptv_expiry);
      } else if (payload.billing_due_date_id) {
        const selected = billingDueDates.find((item: any) => item.id === payload.billing_due_date_id);
        const day = Number(selected?.day_of_month || payload.iptv_due_day || 10);
        payload.iptv_due_day = day;
        payload.iptv_expiry = getNextDateByDay(day);
      } else {
        payload.billing_due_date_id = null;
        payload.iptv_due_day = Number(payload.iptv_due_day || 10);
      }

      // Não tenta alterar e-mail/senha do Auth quando esses campos não mudaram.
      // Isso evitava falhas 4xx/5xx ao salvar somente status, servidor ou aplicativo.
      if (String(payload.iptv_user || "").trim() === String(user.iptv_user || "").trim()) {
        delete payload.iptv_user;
      }
      if (String(payload.iptv_password || "") === String(user.iptv_password || "")) {
        delete payload.iptv_password;
      }

      const result = await invokeAuthenticatedFunction<any>("admin-manage-user", {
        action: "update_profile",
        user_id: user.id,
        data: payload,
      });

      if (!result?.success) {
        throw new Error(result?.error || "O servidor não confirmou a atualização.");
      }

      const savedPatch = { ...payload, ...(result?.profile_patch || {}) };
      broadcastClientProfileUpdate(user.id, savedPatch);
      setForm({ ...form, ...savedPatch });
      toast({ title: "✅ Dados atualizados para " + user.name, description: "Atualizado em todo o app: Admin > Usuários, Admin > TV e painel do cliente." });
      onSaved();
    } catch (err: any) {
      toast({ title: "Erro ao salvar alterações", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmPayment = async () => {
    setSaving(true);
    const months = Number(paymentForm.months);
    const amount = paymentForm.amount ? Number(paymentForm.amount) : totalValue * months;

    // Mesmo vencido, a base é sempre o vencimento previsto do cliente.
    // Ex.: venceu 09/07 e confirmou em 10/07 => renova até 09/08.
    const periodStart = form.iptv_expiry || getTodayDateOnly();
    const periodEnd = addMonthsToDateOnlyByFixedDay(periodStart, months);

    const { data: confirmationData, error: confirmationError } = await supabase.functions.invoke("admin-manage-user", {
      body: {
        action: "confirm_payment",
        user_id: user.id,
        data: { amount, months, notes: paymentForm.notes, period_start: periodStart },
      },
    });
    if (confirmationError || (confirmationData as any)?.error) {
      throw new Error((confirmationData as any)?.error || confirmationError?.message || "Erro ao confirmar pagamento.");
    }

    const confirmedPeriodEnd = (confirmationData as any)?.period_end || periodEnd;
    broadcastFinanceUpdate(user.id, { action: "confirm_payment", status: "confirmed", period_end: confirmedPeriodEnd });
    toast({ title: `✅ Pagamento confirmado — ${months} mês(es) até ${confirmedPeriodEnd}` });
    setForm({ ...form, iptv_expiry: confirmedPeriodEnd, iptv_status: "active" });
    setShowConfirmPayment(false);
    setPaymentForm({ months: 1, amount: "", notes: "" });
    setPaymentsLoaded(false);
    loadPayments();
    setSaving(false);
    onSaved();
  };

  const registerManualPayment = async () => {
    if (
      !manualPaymentForm.amount ||
      !manualPaymentForm.payment_date ||
      !manualPaymentForm.period_start ||
      !manualPaymentForm.period_end
    ) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    await supabase.functions.invoke("admin-manage-user", {
      body: {
        action: "register_manual_payment",
        user_id: user.id,
        data: manualPaymentForm,
      },
    });
    broadcastFinanceUpdate(user.id, { action: "register_manual_payment", status: "confirmed" });
    toast({ title: "✅ Pagamento manual registrado com sucesso!" });
    setShowManualPayment(false);
    setManualPaymentForm({ amount: "", payment_date: "", period_start: "", period_end: "", notes: "" });
    setPaymentsLoaded(false);
    await loadPayments();
    setSaving(false);
  };

  const quickAction = async (action: string) => {
    setSaving(true);
    if (action === "block") {
      await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_profile", user_id: user.id, data: { iptv_status: "blocked" } },
      });
      setForm({ ...form, iptv_status: "blocked" });
      toast({ title: "🔒 Cliente bloqueado" });
    } else if (action === "activate") {
      await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_profile", user_id: user.id, data: { iptv_status: "active" } },
      });
      setForm({ ...form, iptv_status: "active" });
      toast({ title: "🔓 Cliente ativado" });
    } else if (action === "reset_password") {
      const newPass = Math.random().toString(36).slice(-8);
      await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_profile", user_id: user.id, data: { iptv_password: newPass } },
      });
      setForm({ ...form, iptv_password: newPass });
      toast({ title: "🔑 Nova senha: " + newPass, description: "Copie e envie ao cliente." });
    }
    setSaving(false);
    onSaved();
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoices((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const bulkDeleteInvoices = async () => {
    if (selectedInvoices.length === 0) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "bulk_delete_invoices", user_id: user.id, data: { payment_ids: selectedInvoices } },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const deletedCount = Number((data as any)?.deleted ?? selectedInvoices.length);
      broadcastFinanceUpdate(user.id, { action: "bulk_delete_invoices" });
      toast({ title: `🗑️ ${deletedCount} fatura(s) excluída(s)` });
      setSelectedInvoices([]);
      await loadPayments();
    } catch (err: any) {
      toast({ title: "Erro ao excluir faturas", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const bulkUpdateInvoices = async () => {
    if (selectedInvoices.length === 0) return;
    setSaving(true);
    const updates: any = {};
    if (bulkEditForm.amount) updates.amount = Number(bulkEditForm.amount);
    if (bulkEditForm.notes) updates.notes = bulkEditForm.notes;
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "bulk_update_invoices", user_id: user.id, data: { payment_ids: selectedInvoices, updates } },
    });
    broadcastFinanceUpdate(user.id, { action: "bulk_update_invoices" });
    toast({ title: `✅ ${selectedInvoices.length} fatura(s) atualizada(s)` });
    setSelectedInvoices([]);
    setBulkEditMode(false);
    setBulkEditForm({ amount: "", notes: "" });
    setPaymentsLoaded(false);
    await loadPayments();
    setSaving(false);
  };

  const regenerateInvoices = async () => {
    setSaving(true);
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "regenerate_future_invoices", user_id: user.id, data: {} },
    });
    broadcastFinanceUpdate(user.id, { action: "regenerate_future_invoices" });
    toast({ title: "🔄 Faturas pendentes excluídas e 6 novas geradas" });
    setSelectedInvoices([]);
    setPaymentsLoaded(false);
    await loadPayments();
    await loadScheduledRates();
    setSaving(false);
    onSaved();
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all";
  const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";

  const isExpired = form.iptv_expiry && new Date(form.iptv_expiry) < new Date();

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative flex w-full max-w-lg flex-col bg-card border-l border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <User size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{user.name}</h2>
              <p className="text-xs text-muted-foreground">
                @{user.username} · {user.iptv_client_code || "Sem código"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Expired alert */}
        {isExpired && (
          <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-5 py-2">
            <ShieldAlert size={14} className="text-destructive shrink-0" />
            <p className="text-xs font-medium text-destructive">Plano vencido em {form.iptv_expiry}</p>
            <button
              onClick={() => {
                setTab("financial");
                setShowConfirmPayment(true);
              }}
              className="ml-auto rounded-lg bg-primary/15 px-3 py-1 text-[10px] font-semibold text-primary hover:bg-primary/25 transition-colors"
            >
              Renovar
            </button>
          </div>
        )}

        {/* Status badge + quick actions */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.color}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusInfo.dot} animate-pulse`} />
            {statusInfo.label}
          </span>
          <div className="ml-auto flex gap-1.5">
            {form.iptv_status !== "blocked" ? (
              <button
                onClick={() => quickAction("block")}
                disabled={saving}
                className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                title="Bloquear"
              >
                <Lock size={12} />
              </button>
            ) : (
              <button
                onClick={() => quickAction("activate")}
                disabled={saving}
                className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                title="Ativar"
              >
                <Unlock size={12} />
              </button>
            )}
            <button
              onClick={() => quickAction("reset_password")}
              disabled={saving}
              className="rounded-lg bg-yellow-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-yellow-400 hover:bg-yellow-500/20 transition-colors"
              title="Resetar senha"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-xs font-medium transition-all border-b-2 ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* ===== OVERVIEW ===== */}
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <div>
                      <label className={labelCls}>Nome Completo</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Código do Cliente</label>
                        <input
                          value={form.iptv_client_code}
                          onChange={(e) => setForm({ ...form, iptv_client_code: e.target.value })}
                          placeholder="BTZ-XXXXX"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Conexões</label>
                        <input
                          type="number"
                          min="1"
                          value={form.iptv_connections}
                          onChange={(e) => setForm({ ...form, iptv_connections: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Servidor</label>
                        <select
                          value={form.iptv_server}
                          onChange={(e) => setForm({ ...form, iptv_server: e.target.value })}
                          className={inputCls}
                        >
                          <option value="">Selecione...</option>
                          {servers.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>App TV</label>
                        <select
                          value={form.iptv_tv_app}
                          onChange={(e) => setForm({ ...form, iptv_tv_app: e.target.value })}
                          className={inputCls}
                        >
                          <option value="">Nenhum</option>
                          {tvAppOptions.map((a) => (
                            <option key={a.id} value={a.name}>
                              {a.isOfficialWmcflix ? "▣" : a.icon} {a.name}
                            </option>
                          ))}
                        </select>
                        {selectedTvApp?.isOfficialWmcflix && (
                          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                            <img src={logoUrl} alt={appTitle} className="h-6 w-6 rounded-md object-contain bg-black" />
                            <span className="text-xs font-medium text-red-300">App oficial {appTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      📎 Observações
                    </p>
                    <textarea
                      value={form.admin_notes}
                      onChange={(e) => setForm({ ...form, admin_notes: e.target.value.slice(0, 5000) })}
                      rows={10}
                      placeholder="Avisos, informações técnicas..."
                      className={`${inputCls} resize-none`}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.admin_notes_urgent}
                          onChange={(e) => setForm({ ...form, admin_notes_urgent: e.target.checked })}
                          className="h-4 w-4 rounded accent-destructive"
                        />
                        <span className="text-xs text-foreground">⚠️ Urgente</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">{(form.admin_notes || "").length}/5000</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== FINANCIAL ===== */}
              {tab === "financial" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      💰 Mensalidade
                    </p>
                    <div>
                      <label className={labelCls}>Valor Base (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.iptv_monthly_value}
                        onChange={(e) => setForm({ ...form, iptv_monthly_value: Number(e.target.value) })}
                        className={inputCls}
                      />
                    </div>
                    {billingDueDates.length > 0 && (
                      <div>
                        <label className={labelCls}>Data de Pagamento</label>
                        <select
                          value={(form as any).billing_due_date_id || ""}
                          onChange={(e) => {
                            const selected = billingDueDates.find((item: any) => item.id === e.target.value);
                            const nextDay = Number(selected?.day_of_month || (form as any).iptv_due_day || 10);
                            setForm({
                              ...form,
                              billing_due_date_id: e.target.value,
                              iptv_due_day: nextDay,
                              iptv_expiry: form.iptv_expiry || getNextDateByDay(nextDay),
                            } as any);
                          }}
                          className={inputCls}
                        >
                          <option value="">Usar data padrão</option>
                          {billingDueDates.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.label || `Dia ${item.day_of_month}`} · Bloqueia após {item.grace_days} dia(s)
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={form.iptv_expiry || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              iptv_expiry: e.target.value,
                              iptv_due_day: e.target.value ? getDayFromDateOnly(e.target.value) : (form as any).iptv_due_day,
                            } as any)
                          }
                          className={inputCls + " mt-2 border-red-500/40"}
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          A data digitada é obrigatória para fixar o vencimento. Ao salvar, atualiza validade, dia financeiro, cobrança e painel do cliente.
                        </p>
                      </div>
                    )}

                    <label className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <input
                        type="checkbox"
                        checked={Boolean((form as any).billing_proportional_enabled)}
                        onChange={(e) => setForm({ ...form, billing_proportional_enabled: e.target.checked } as any)}
                        className="mt-0.5 h-4 w-4 rounded accent-red-600"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-red-300">Pagamento proporcional</span>
                        <span className="block text-[10px] text-muted-foreground">
                          Só calcula e mostra proporcional se esta opção estiver marcada pelo admin.
                        </span>
                      </span>
                    </label>
                    <div className="rounded-lg bg-primary/10 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Valor Total ({form.iptv_connections} conexão{Number(form.iptv_connections) > 1 ? "ões" : ""})
                        </span>
                        <span className="text-lg font-bold text-primary">R$ {totalValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vencimento */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📅 Validade</p>
                    <div>
                      <label className={labelCls}>Validade fixa</label>
                      <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2">
                        <p className="text-sm font-semibold text-red-300">Todo dia {fixedBillingDay}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Próxima cobrança:{" "}
                          {form.iptv_expiry
                            ? String(form.iptv_expiry).split("-").reverse().join("/")
                            : "calculada automaticamente"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Bloqueio após {fixedBillingGraceDays} dia(s) corridos de atraso.
                        </p>
                      </div>
                    </div>
                    {isExpired && (
                      <div className="rounded-lg bg-destructive/10 p-2 text-center">
                        <p className="text-xs font-medium text-destructive">⚠️ Plano vencido</p>
                      </div>
                    )}
                  </div>

                  {/* Scheduled Rate Changes */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        📈 Reajustes Programados
                      </p>
                      <button
                        onClick={() => setShowRateForm(!showRateForm)}
                        className="rounded-lg bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {showRateForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={labelCls}>Novo Valor Base (R$)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={rateForm.new_monthly_value}
                                onChange={(e) => setRateForm({ ...rateForm, new_monthly_value: e.target.value })}
                                placeholder="20.00"
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>A partir de</label>
                              <input
                                type="date"
                                value={rateForm.effective_date}
                                onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })}
                                className={inputCls}
                              />
                            </div>
                          </div>
                          <div>
                            <label className={labelCls}>Observação</label>
                            <input
                              value={rateForm.notes}
                              onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
                              placeholder="Reajuste anual, etc."
                              className={inputCls}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!rateForm.new_monthly_value || !rateForm.effective_date) return;
                                setSaving(true);
                                await supabase.functions.invoke("admin-manage-user", {
                                  body: { action: "add_scheduled_rate", user_id: user.id, data: rateForm },
                                });
                                toast({ title: "✅ Reajuste programado!" });
                                setRateForm({ new_monthly_value: "", effective_date: "", notes: "" });
                                setShowRateForm(false);
                                await loadScheduledRates();
                                setSaving(false);
                              }}
                              disabled={saving || !rateForm.new_monthly_value || !rateForm.effective_date}
                              className="flex-1 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setShowRateForm(false)}
                              className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                            >
                              Cancelar
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {scheduledRates.length === 0 ? (
                      <p className="text-center text-[11px] text-muted-foreground py-2">Nenhum reajuste programado</p>
                    ) : (
                      <div className="space-y-1.5">
                        {scheduledRates.map((r) => {
                          const [y, m, d] = r.effective_date.split("-");
                          const formatted = `${d}/${m}/${y}`;
                          const isEditing = editingRateId === r.id;

                          if (isEditing) {
                            return (
                              <div
                                key={r.id}
                                className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2"
                              >
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className={labelCls}>Valor (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editRateForm.new_monthly_value}
                                      onChange={(e) =>
                                        setEditRateForm({ ...editRateForm, new_monthly_value: e.target.value })
                                      }
                                      className={inputCls}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelCls}>A partir de</label>
                                    <input
                                      type="date"
                                      value={editRateForm.effective_date}
                                      onChange={(e) =>
                                        setEditRateForm({ ...editRateForm, effective_date: e.target.value })
                                      }
                                      className={inputCls}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className={labelCls}>Observação</label>
                                  <input
                                    value={editRateForm.notes}
                                    onChange={(e) => setEditRateForm({ ...editRateForm, notes: e.target.value })}
                                    className={inputCls}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      setSaving(true);
                                      await supabase.functions.invoke("admin-manage-user", {
                                        body: {
                                          action: "update_scheduled_rate",
                                          user_id: user.id,
                                          data: {
                                            rate_id: r.id,
                                            new_monthly_value: editRateForm.new_monthly_value,
                                            effective_date: editRateForm.effective_date,
                                            notes: editRateForm.notes,
                                          },
                                        },
                                      });
                                      toast({ title: "✅ Reajuste atualizado!" });
                                      setEditingRateId(null);
                                      await loadScheduledRates();
                                      setSaving(false);
                                    }}
                                    disabled={saving}
                                    className="flex-1 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => setEditingRateId(null)}
                                    className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={r.id}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${r.applied ? "bg-muted/20 border-border/30" : "bg-primary/5 border-primary/20"}`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <TrendingUp
                                    size={11}
                                    className={r.applied ? "text-muted-foreground" : "text-primary"}
                                  />
                                  <span
                                    className={`text-xs font-semibold ${r.applied ? "text-muted-foreground" : "text-foreground"}`}
                                  >
                                    R$ {Number(r.new_monthly_value).toFixed(2)}/tela
                                  </span>
                                  {r.applied && (
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                                      Aplicado
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  A partir de {formatted}
                                  {r.notes ? ` · ${r.notes}` : ""}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    setEditingRateId(r.id);
                                    setEditRateForm({
                                      new_monthly_value: String(r.new_monthly_value),
                                      effective_date: r.effective_date,
                                      notes: r.notes || "",
                                    });
                                  }}
                                  className="rounded-lg p-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  onClick={async () => {
                                    setSaving(true);
                                    await supabase.functions.invoke("admin-manage-user", {
                                      body: {
                                        action: "delete_scheduled_rate",
                                        user_id: user.id,
                                        data: { rate_id: r.id },
                                      },
                                    });
                                    toast({ title: "🗑️ Reajuste removido" });
                                    await loadScheduledRates();
                                    setSaving(false);
                                  }}
                                  disabled={saving}
                                  className="rounded-lg p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Confirm Payment button */}
                  <button
                    onClick={() => setShowConfirmPayment(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-all"
                  >
                    <CalendarCheck size={16} /> Confirmar Pagamento / Renovar
                  </button>

                  {/* Manual Payment Registration button */}
                  <button
                    onClick={() => setShowManualPayment(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 transition-all"
                  >
                    <Plus size={16} /> Registrar Pagamento Manual
                  </button>

                  {/* Confirm Payment Modal */}
                  <AnimatePresence>
                    {showConfirmPayment && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3"
                      >
                        <p className="text-xs font-semibold text-emerald-400">💳 Confirmar Pagamento</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Meses</label>
                            <select
                              value={paymentForm.months}
                              onChange={(e) => setPaymentForm({ ...paymentForm, months: Number(e.target.value) })}
                              className={inputCls}
                            >
                              <option value={1}>1 mês</option>
                              <option value={2}>2 meses</option>
                              <option value={3}>3 meses</option>
                              <option value={6}>6 meses</option>
                              <option value={12}>12 meses</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Valor (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                              placeholder={`${(totalValue * Number(paymentForm.months)).toFixed(2)}`}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Observação</label>
                          <input
                            value={paymentForm.notes}
                            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                            placeholder="PIX confirmado, etc."
                            className={inputCls}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={confirmPayment}
                            disabled={saving}
                            className="flex-1 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                          >
                            {saving ? "Processando..." : "✅ Confirmar"}
                          </button>
                          <button
                            onClick={() => setShowConfirmPayment(false)}
                            className="rounded-xl bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Manual Payment Registration Modal */}
                  <AnimatePresence>
                    {showManualPayment && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
                      >
                        <p className="text-xs font-semibold text-primary">📝 Registrar Pagamento Manual</p>
                        <p className="text-[10px] text-muted-foreground">
                          Apenas para registro histórico. Não altera datas de validade nem status do cliente.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Data do Pagamento *</label>
                            <input
                              type="date"
                              value={manualPaymentForm.payment_date}
                              onChange={(e) =>
                                setManualPaymentForm({ ...manualPaymentForm, payment_date: e.target.value })
                              }
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Valor (R$) *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={manualPaymentForm.amount}
                              onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, amount: e.target.value })}
                              placeholder={totalValue.toFixed(2)}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Período Início *</label>
                            <input
                              type="date"
                              value={manualPaymentForm.period_start}
                              onChange={(e) =>
                                setManualPaymentForm({ ...manualPaymentForm, period_start: e.target.value })
                              }
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Período Fim *</label>
                            <input
                              type="date"
                              value={manualPaymentForm.period_end}
                              onChange={(e) =>
                                setManualPaymentForm({ ...manualPaymentForm, period_end: e.target.value })
                              }
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Observação</label>
                          <input
                            value={manualPaymentForm.notes}
                            onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, notes: e.target.value })}
                            placeholder="PIX, dinheiro, transferência..."
                            className={inputCls}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={registerManualPayment}
                            disabled={
                              saving ||
                              !manualPaymentForm.amount ||
                              !manualPaymentForm.payment_date ||
                              !manualPaymentForm.period_start ||
                              !manualPaymentForm.period_end
                            }
                            className="flex-1 rounded-xl bg-primary/20 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/30 disabled:opacity-50 transition-all"
                          >
                            {saving ? "Registrando..." : "📝 Registrar"}
                          </button>
                          <button
                            onClick={() => setShowManualPayment(false)}
                            className="rounded-xl bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Payment History + Future Invoices */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Faturas</p>
                      <div className="flex gap-1">
                        {(["all", "past", "future"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setInvoiceFilter(f)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${invoiceFilter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                          >
                            {f === "all" ? "Todas" : f === "past" ? "Anteriores" : "Próximas"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setSaving(true);
                          await supabase.functions.invoke("admin-manage-user", {
                            body: { action: "generate_future_invoices", user_id: user.id, data: { months_ahead: 6 } },
                          });
                          toast({ title: "📅 Faturas futuras geradas (6 meses)" });
                          setPaymentsLoaded(false);
                          await loadPayments();
                          setSaving(false);
                        }}
                        disabled={saving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        <CreditCard size={12} /> Gerar 6 Faturas
                      </button>
                      <button
                        onClick={regenerateInvoices}
                        disabled={saving}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-2 text-[11px] font-medium text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                        title="Exclui todas faturas pendentes e regenera 6 novas"
                      >
                        <RefreshCw size={12} /> Recriar Faturas
                      </button>
                    </div>

                    {/* Bulk actions bar */}
                    {selectedInvoices.length > 0 && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-primary">
                          {selectedInvoices.length} fatura(s) selecionada(s)
                        </p>
                        {bulkEditMode ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Novo Valor (R$)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={bulkEditForm.amount}
                                  onChange={(e) => setBulkEditForm({ ...bulkEditForm, amount: e.target.value })}
                                  placeholder="Manter atual"
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Observação</label>
                                <input
                                  value={bulkEditForm.notes}
                                  onChange={(e) => setBulkEditForm({ ...bulkEditForm, notes: e.target.value })}
                                  placeholder="Manter atual"
                                  className={inputCls}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={bulkUpdateInvoices}
                                disabled={saving}
                                className="flex-1 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors"
                              >
                                ✅ Aplicar
                              </button>
                              <button
                                onClick={() => {
                                  setBulkEditMode(false);
                                  setBulkEditForm({ amount: "", notes: "" });
                                }}
                                className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setBulkEditMode(true)}
                              className="flex-1 rounded-lg bg-primary/15 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors"
                            >
                              <Pencil size={11} className="inline mr-1" /> Editar em Massa
                            </button>
                            <button
                              onClick={bulkDeleteInvoices}
                              disabled={saving}
                              className="flex-1 rounded-lg bg-destructive/15 px-3 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/25 transition-colors"
                            >
                              <Trash2 size={11} className="inline mr-1" /> Excluir Selecionadas
                            </button>
                            <button
                              onClick={() => setSelectedInvoices([])}
                              className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                            >
                              Limpar
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {(() => {
                      const today = new Date().toISOString().split("T")[0];
                      const filtered = payments
                        .filter((p: any) => {
                          if (invoiceFilter === "past") return p.period_end <= today;
                          if (invoiceFilter === "future") return p.period_end > today;
                          return true;
                        })
                        .sort((a: any, b: any) => a.period_start.localeCompare(b.period_start));

                      if (filtered.length === 0) {
                        return (
                          <p className="text-center text-xs text-muted-foreground py-4">Nenhuma fatura encontrada.</p>
                        );
                      }

                      // Select all pending visible
                      const pendingVisible = filtered.filter((p: any) => p.status === "pending");
                      const allPendingSelected =
                        pendingVisible.length > 0 && pendingVisible.every((p: any) => selectedInvoices.includes(p.id));

                      return (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {pendingVisible.length > 0 && (
                            <button
                              onClick={() => {
                                if (allPendingSelected) {
                                  setSelectedInvoices([]);
                                } else {
                                  setSelectedInvoices(pendingVisible.map((p: any) => p.id));
                                }
                              }}
                              className="flex items-center gap-1.5 text-[10px] text-primary font-medium hover:underline"
                            >
                              {allPendingSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                              {allPendingSelected ? "Desmarcar todas pendentes" : "Selecionar todas pendentes"}
                            </button>
                          )}
                          {filtered.map((p: any) => {
                            // Parse payment_date avoiding UTC shift
                            const dateParts = p.payment_date?.split("T")[0]?.split("-");
                            const formatted = dateParts
                              ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
                              : new Date(p.payment_date).toLocaleDateString("pt-BR");
                            const startParts = p.period_start?.split("-");
                            const startFormatted = startParts
                              ? `${startParts[2]}/${startParts[1]}/${startParts[0]}`
                              : "";
                            const endParts = p.period_end?.split("-");
                            const endFormatted = endParts ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : "";
                            const isReversed = p.status === "reversed";
                            const isPending = p.status === "pending";
                            const isConfirmed = p.status === "confirmed";
                            const isRemoved = p.status === "removed";
                            const isFuture = p.period_start > today;
                            const isSelected = selectedInvoices.includes(p.id);

                            const statusColor =
                              isReversed || isRemoved
                                ? "bg-destructive/10 text-destructive"
                                : isPending
                                  ? "bg-yellow-500/10 text-yellow-400"
                                  : "bg-emerald-500/10 text-emerald-400";
                            const statusLabel = isRemoved
                              ? "Removido"
                              : isReversed
                                ? "Revertido"
                                : isPending
                                  ? "Pendente"
                                  : "Pago";
                            const borderColor =
                              isReversed || isRemoved
                                ? "bg-destructive/5 border-destructive/20"
                                : isPending
                                  ? "bg-yellow-500/5 border-yellow-500/20"
                                  : "bg-muted/30 border-border/20";

                            return (
                              <div
                                key={p.id}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border ${borderColor} ${isSelected ? "ring-1 ring-primary/40" : ""}`}
                              >
                                {isPending && (
                                  <button
                                    onClick={() => toggleInvoiceSelection(p.id)}
                                    className="shrink-0 text-primary"
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={14} />
                                    ) : (
                                      <Square size={14} className="text-muted-foreground" />
                                    )}
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-medium text-foreground">
                                      {isPending && isFuture ? `Vence ${startFormatted}` : formatted}
                                    </p>
                                    {isFuture && isPending && (
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                        Futura
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {p.months} mês(es) · {startFormatted} → {endFormatted}
                                  </p>
                                  {p.notes && (
                                    <p className="text-[10px] text-muted-foreground/70 italic truncate">{p.notes}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <span
                                      className={`text-sm font-semibold ${isReversed || isRemoved ? "text-muted-foreground line-through" : "text-foreground"}`}
                                    >
                                      R$ {Number(p.amount).toFixed(2)}
                                    </span>
                                    <span
                                      className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}
                                    >
                                      {statusLabel}
                                    </span>
                                  </div>
                                  {isPending ? (
                                    <button
                                      onClick={async () => {
                                        setSaving(true);
                                        await supabase.functions.invoke("admin-manage-user", {
                                          body: {
                                            action: "mark_invoice_paid",
                                            user_id: user.id,
                                            data: { payment_id: p.id },
                                          },
                                        });
                                        toast({ title: "✅ Fatura marcada como paga" });
                                        setPaymentsLoaded(false);
                                        await loadPayments();
                                        setSaving(false);
                                        onSaved();
                                      }}
                                      disabled={saving}
                                      className="rounded-lg p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                      title="Marcar como pago"
                                    >
                                      <CalendarCheck size={12} />
                                    </button>
                                  ) : isRemoved ? (
                                    <button
                                      onClick={async () => {
                                        setSaving(true);
                                        await supabase.functions.invoke("admin-manage-user", {
                                          body: {
                                            action: "remove_payment",
                                            user_id: user.id,
                                            data: { payment_id: p.id },
                                          },
                                        });
                                        toast({ title: "✅ Pagamento restaurado" });
                                        setPaymentsLoaded(false);
                                        await loadPayments();
                                        setSaving(false);
                                        onSaved();
                                      }}
                                      disabled={saving}
                                      className="rounded-lg p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                      title="Restaurar pagamento"
                                    >
                                      <RotateCw size={12} />
                                    </button>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={async () => {
                                          setSaving(true);
                                          await supabase.functions.invoke("admin-manage-user", {
                                            body: {
                                              action: "remove_payment",
                                              user_id: user.id,
                                              data: { payment_id: p.id },
                                            },
                                          });
                                          toast({ title: "🗑️ Pagamento removido" });
                                          setPaymentsLoaded(false);
                                          await loadPayments();
                                          setSaving(false);
                                          onSaved();
                                        }}
                                        disabled={saving}
                                        className="rounded-lg p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                        title="Remover pagamento"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          setSaving(true);
                                          await supabase.functions.invoke("admin-manage-user", {
                                            body: {
                                              action: "reverse_payment",
                                              user_id: user.id,
                                              data: { payment_id: p.id },
                                            },
                                          });
                                          toast({
                                            title: isReversed ? "✅ Pagamento re-confirmado" : "↩️ Pagamento revertido",
                                          });
                                          setPaymentsLoaded(false);
                                          await loadPayments();
                                          setSaving(false);
                                          onSaved();
                                        }}
                                        disabled={saving}
                                        className={`rounded-lg p-1.5 transition-colors ${isReversed ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
                                        title={isReversed ? "Re-confirmar pagamento" : "Reverter pagamento"}
                                      >
                                        <RotateCcw size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Saldo */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo Atual</p>
                        <p className="text-lg font-bold text-foreground">R$ {Number(user.balance || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Créditos</p>
                        <p className="text-lg font-bold text-foreground">💎 {user.credits || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Ganho</p>
                        <p className="text-lg font-bold text-emerald-400">
                          R$ {Number(user.total_earned || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== ACCESS ===== */}
              {tab === "access" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      🔐 Dados TV
                    </p>
                    <div>
                      <label className={labelCls}>Usuário TV</label>
                      <input
                        value={form.iptv_user}
                        onChange={(e) => setForm({ ...form, iptv_user: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Senha TV</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={form.iptv_password}
                          onChange={(e) => setForm({ ...form, iptv_password: e.target.value })}
                          className={inputCls}
                        />
                        <button
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Aplicativo</label>
                      <input
                        value={form.iptv_app}
                        onChange={(e) => setForm({ ...form, iptv_app: e.target.value })}
                        placeholder="Ex: SmartOne, XCTV..."
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🛡️ Segurança</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Criado em</p>
                        <p className="font-medium text-foreground">{formatDateBRT(user.created_at)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Saldo Congelado</p>
                        <p className="font-medium text-foreground">{user.balance_frozen ? "🔒 Sim" : "🔓 Não"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== SYSTEM ===== */}
              {tab === "system" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      📡 Servidor & Status
                    </p>
                    <div>
                      <label className={labelCls}>Servidor Contratado</label>
                      <select
                        value={form.iptv_server}
                        onChange={(e) => setForm({ ...form, iptv_server: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">Selecione...</option>
                        {servers.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status do Sistema</label>
                      <select
                        value={form.iptv_status}
                        onChange={(e) => setForm({ ...form, iptv_status: e.target.value })}
                        className={inputCls}
                      >
                        {TV_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>App para TV</label>
                      <select
                        value={form.iptv_tv_app}
                        onChange={(e) => setForm({ ...form, iptv_tv_app: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">Nenhum</option>
                        {tvAppOptions.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.isOfficialWmcflix ? "▣" : a.icon} {a.name}
                          </option>
                        ))}
                      </select>
                      {selectedTvApp?.isOfficialWmcflix && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                          <img src={logoUrl} alt={appTitle} className="h-6 w-6 rounded-md object-contain bg-black" />
                          <span className="text-xs font-medium text-red-300">App oficial {appTitle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== HISTORY ===== */}
              {tab === "history" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    📋 Últimas Atividades
                  </p>
                  {logs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Nenhum registro encontrado</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{log.action}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateBRT(log.created_at, {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <p className="mt-1 text-[10px] text-muted-foreground truncate">
                              {JSON.stringify(log.details).slice(0, 120)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Save Footer */}
        <div className="border-t border-border px-5 py-4">
          <button
            onClick={saveForm}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
