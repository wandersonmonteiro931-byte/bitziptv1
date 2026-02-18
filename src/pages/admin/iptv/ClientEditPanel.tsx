import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Eye, EyeOff, ShieldAlert, Lock, Unlock, RotateCcw, LogOut, Tv, Wallet, History, Settings, User, CreditCard, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { IPTV_STATUSES, getStatusInfo } from "./types";

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
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ months: 1, amount: "", notes: "" });
  const [form, setForm] = useState({
    iptv_server: user.iptv_server || "",
    iptv_status: user.iptv_status || "active",
    iptv_monthly_value: user.iptv_monthly_value || 0,
    iptv_due_day: user.iptv_due_day || 10,
    iptv_connections: user.iptv_connections || 1,
    iptv_tv_app: user.iptv_tv_app || "",
    iptv_client_code: user.iptv_client_code || "",
    iptv_user: user.iptv_user || "",
    iptv_password: user.iptv_password || "",
    iptv_app: user.iptv_app || "",
    iptv_expiry: user.iptv_expiry || "",
    admin_notes: user.admin_notes || "",
    admin_notes_urgent: user.admin_notes_urgent || false,
    name: user.name || "",
  });

  const totalValue = Number(form.iptv_monthly_value) * Number(form.iptv_connections);
  const statusInfo = getStatusInfo(form.iptv_status);

  const loadLogs = async () => {
    if (logsLoaded) return;
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .eq("target_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data || []);
    setLogsLoaded(true);
  };

  const loadPayments = async () => {
    if (paymentsLoaded) return;
    const { data } = await (supabase as any)
      .from("iptv_payments")
      .select("*")
      .eq("user_id", user.id)
      .order("payment_date", { ascending: false })
      .limit(50);
    setPayments(data || []);
    setPaymentsLoaded(true);
  };

  // Load payments when financial tab is opened
  useEffect(() => {
    if (tab === "financial") loadPayments();
    if (tab === "history") loadLogs();
  }, [tab]);

  const saveForm = async () => {
    setSaving(true);
    await supabase.functions.invoke("admin-manage-user", {
      body: { action: "update_profile", user_id: user.id, data: form },
    });
    toast({ title: "✅ Dados atualizados para " + user.name });
    setSaving(false);
    onSaved();
  };

  const confirmPayment = async () => {
    setSaving(true);
    const months = Number(paymentForm.months);
    const amount = paymentForm.amount ? Number(paymentForm.amount) : totalValue * months;

    // Calculate period
    const startDate = new Date();
    let periodStart: string;
    let periodEnd: string;

    if (form.iptv_expiry && new Date(form.iptv_expiry) > startDate) {
      // If not expired yet, extend from current expiry
      periodStart = form.iptv_expiry;
      const end = new Date(form.iptv_expiry);
      end.setMonth(end.getMonth() + months);
      periodEnd = end.toISOString().split("T")[0];
    } else {
      // If expired or no expiry, start from today
      periodStart = startDate.toISOString().split("T")[0];
      const end = new Date(startDate);
      end.setMonth(end.getMonth() + months);
      periodEnd = end.toISOString().split("T")[0];
    }

    await supabase.functions.invoke("admin-manage-user", {
      body: {
        action: "confirm_payment",
        user_id: user.id,
        data: {
          amount,
          months,
          notes: paymentForm.notes,
          period_start: periodStart,
          period_end: periodEnd,
        },
      },
    });

    toast({ title: `✅ Pagamento confirmado — ${months} mês(es) até ${periodEnd}` });
    setForm({ ...form, iptv_expiry: periodEnd, iptv_status: "active" });
    setShowConfirmPayment(false);
    setPaymentForm({ months: 1, amount: "", notes: "" });
    setPaymentsLoaded(false);
    loadPayments();
    setSaving(false);
    onSaved();
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

  const inputCls = "w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all";
  const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";

  // Check if expired
  const isExpired = form.iptv_expiry && new Date(form.iptv_expiry) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/60 backdrop-blur-sm" onClick={onClose}>
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
              <p className="text-xs text-muted-foreground">@{user.username} · {user.iptv_client_code || "Sem código"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Expired alert */}
        {isExpired && (
          <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-5 py-2">
            <ShieldAlert size={14} className="text-destructive shrink-0" />
            <p className="text-xs font-medium text-destructive">Plano vencido em {form.iptv_expiry}</p>
            <button
              onClick={() => { setTab("financial"); setShowConfirmPayment(true); }}
              className="ml-auto rounded-lg bg-primary/15 px-3 py-1 text-[10px] font-semibold text-primary hover:bg-primary/25 transition-colors"
            >
              Renovar
            </button>
          </div>
        )}

        {/* Status badge + quick actions */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
            <span className={`h-2 w-2 rounded-full ${statusInfo.dot} animate-pulse`} />
            {statusInfo.label}
          </span>
          <div className="ml-auto flex gap-1.5">
            {form.iptv_status !== "blocked" ? (
              <button onClick={() => quickAction("block")} disabled={saving} className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors" title="Bloquear">
                <Lock size={12} />
              </button>
            ) : (
              <button onClick={() => quickAction("activate")} disabled={saving} className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Ativar">
                <Unlock size={12} />
              </button>
            )}
            <button onClick={() => quickAction("reset_password")} disabled={saving} className="rounded-lg bg-yellow-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-yellow-400 hover:bg-yellow-500/20 transition-colors" title="Resetar senha">
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
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
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
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

              {/* ===== OVERVIEW ===== */}
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <div>
                      <label className={labelCls}>Nome Completo</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Código do Cliente</label>
                        <input value={form.iptv_client_code} onChange={(e) => setForm({ ...form, iptv_client_code: e.target.value })} placeholder="BTZ-XXXXX" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Conexões</label>
                        <input type="number" min="1" value={form.iptv_connections} onChange={(e) => setForm({ ...form, iptv_connections: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Servidor</label>
                        <select value={form.iptv_server} onChange={(e) => setForm({ ...form, iptv_server: e.target.value })} className={inputCls}>
                          <option value="">Selecione...</option>
                          {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>App TV</label>
                        <select value={form.iptv_tv_app} onChange={(e) => setForm({ ...form, iptv_tv_app: e.target.value })} className={inputCls}>
                          <option value="">Nenhum</option>
                          {tvApps.map((a) => <option key={a.id} value={a.name}>{a.icon} {a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📎 Observações</p>
                    <textarea
                      value={form.admin_notes}
                      onChange={(e) => setForm({ ...form, admin_notes: e.target.value.slice(0, 5000) })}
                      rows={3}
                      placeholder="Avisos, informações técnicas..."
                      className={`${inputCls} resize-none`}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.admin_notes_urgent} onChange={(e) => setForm({ ...form, admin_notes_urgent: e.target.checked })} className="h-4 w-4 rounded accent-destructive" />
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">💰 Mensalidade</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Valor Base (R$)</label>
                        <input type="number" step="0.01" value={form.iptv_monthly_value} onChange={(e) => setForm({ ...form, iptv_monthly_value: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Dia Vencimento</label>
                        <input type="number" min="1" max="28" value={form.iptv_due_day} onChange={(e) => setForm({ ...form, iptv_due_day: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Valor Total ({form.iptv_connections} conexão{Number(form.iptv_connections) > 1 ? "ões" : ""})</span>
                        <span className="text-lg font-bold text-primary">R$ {totalValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vencimento */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📅 Validade</p>
                    <div>
                      <label className={labelCls}>Data de Expiração</label>
                      <input type="date" value={form.iptv_expiry || ""} onChange={(e) => setForm({ ...form, iptv_expiry: e.target.value })} className={inputCls} />
                    </div>
                    {isExpired && (
                      <div className="rounded-lg bg-destructive/10 p-2 text-center">
                        <p className="text-xs font-medium text-destructive">⚠️ Plano vencido</p>
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

                  {/* Confirm Payment Modal */}
                  <AnimatePresence>
                    {showConfirmPayment && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                        <p className="text-xs font-semibold text-emerald-400">💳 Confirmar Pagamento</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Meses</label>
                            <select value={paymentForm.months} onChange={(e) => setPaymentForm({ ...paymentForm, months: Number(e.target.value) })} className={inputCls}>
                              <option value={1}>1 mês</option>
                              <option value={2}>2 meses</option>
                              <option value={3}>3 meses</option>
                              <option value={6}>6 meses</option>
                              <option value={12}>12 meses</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Valor (R$)</label>
                            <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder={`${(totalValue * Number(paymentForm.months)).toFixed(2)}`} className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Observação</label>
                          <input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="PIX confirmado, etc." className={inputCls} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={confirmPayment} disabled={saving}
                            className="flex-1 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-all">
                            {saving ? "Processando..." : "✅ Confirmar"}
                          </button>
                          <button onClick={() => setShowConfirmPayment(false)}
                            className="rounded-xl bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Payment History */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Histórico de Pagamentos</p>
                    {payments.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">Nenhum pagamento registrado.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {payments.map((p: any) => {
                          const date = new Date(p.payment_date);
                          const formatted = date.toLocaleDateString("pt-BR");
                          const endParts = p.period_end?.split("-");
                          const endFormatted = endParts ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : "";
                          const isReversed = p.status === "reversed";
                          return (
                            <div key={p.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${isReversed ? "bg-destructive/5 border-destructive/20" : "bg-muted/30 border-border/20"}`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{formatted}</p>
                                <p className="text-[10px] text-muted-foreground">{p.months} mês(es) · até {endFormatted}</p>
                                {p.notes && <p className="text-[10px] text-muted-foreground/70 italic truncate">{p.notes}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <span className={`text-sm font-semibold ${isReversed ? "text-muted-foreground line-through" : "text-foreground"}`}>R$ {Number(p.amount).toFixed(2)}</span>
                                  <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${isReversed ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-400"}`}>
                                    {isReversed ? "Revertido" : "Pago"}
                                  </span>
                                </div>
                                <button
                                  onClick={async () => {
                                    setSaving(true);
                                    await supabase.functions.invoke("admin-manage-user", {
                                      body: { action: "reverse_payment", user_id: user.id, data: { payment_id: p.id } },
                                    });
                                    toast({ title: isReversed ? "✅ Pagamento re-confirmado" : "↩️ Pagamento revertido" });
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
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                        <p className="text-lg font-bold text-emerald-400">R$ {Number(user.total_earned || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== ACCESS ===== */}
              {tab === "access" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🔐 Dados IPTV</p>
                    <div>
                      <label className={labelCls}>Usuário IPTV</label>
                      <input value={form.iptv_user} onChange={(e) => setForm({ ...form, iptv_user: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Senha IPTV</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={form.iptv_password}
                          onChange={(e) => setForm({ ...form, iptv_password: e.target.value })}
                          className={inputCls}
                        />
                        <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Aplicativo</label>
                      <input value={form.iptv_app} onChange={(e) => setForm({ ...form, iptv_app: e.target.value })} placeholder="Ex: SmartOne, XCIPTV..." className={inputCls} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🛡️ Segurança</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-muted-foreground">Criado em</p>
                        <p className="font-medium text-foreground">{new Date(user.created_at).toLocaleDateString("pt-BR")}</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📡 Servidor & Status</p>
                    <div>
                      <label className={labelCls}>Servidor Contratado</label>
                      <select value={form.iptv_server} onChange={(e) => setForm({ ...form, iptv_server: e.target.value })} className={inputCls}>
                        <option value="">Selecione...</option>
                        {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status do Sistema</label>
                      <select value={form.iptv_status} onChange={(e) => setForm({ ...form, iptv_status: e.target.value })} className={inputCls}>
                        {IPTV_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>App para TV</label>
                      <select value={form.iptv_tv_app} onChange={(e) => setForm({ ...form, iptv_tv_app: e.target.value })} className={inputCls}>
                        <option value="">Nenhum</option>
                        {tvApps.map((a) => <option key={a.id} value={a.name}>{a.icon} {a.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== HISTORY ===== */}
              {tab === "history" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Últimas Atividades</p>
                  {logs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Nenhum registro encontrado</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{log.action}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(log.created_at).toLocaleDateString("pt-BR")} {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
