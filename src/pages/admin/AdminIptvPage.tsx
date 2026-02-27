import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Tv, Search, X, Users, Filter, Webhook, CheckCircle, Loader2, AlertCircle, ShieldCheck, XCircle, Wrench, AlertTriangle, Clock, Bell, ChevronDown, ChevronUp, Send } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { StatsCards } from "./iptv/StatsCards";
import { ClientEditPanel } from "./iptv/ClientEditPanel";
import { IPTV_STATUSES, QUICK_FILTERS, getStatusInfo } from "./iptv/types";

const BULK_FIELDS = [
  { value: "iptv_status", label: "Status" },
  { value: "iptv_server", label: "Servidor" },
  { value: "iptv_monthly_value", label: "Mensalidade" },
  { value: "iptv_connections", label: "Conexões" },
  { value: "iptv_tv_app", label: "App TV" },
  { value: "admin_notes", label: "Observação" },
  { value: "admin_notes_urgent", label: "Urgência da Obs." },
  { value: "scheduled_rate", label: "📈 Reajuste Programado" },
];

const AdminIptvPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [pendingActivations, setPendingActivations] = useState<any[]>([]);
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null);
  const [bulkRateForm, setBulkRateForm] = useState({ new_monthly_value: "", effective_date: "", notes: "" });
  const [trustRequests, setTrustRequests] = useState<any[]>([]);
  const [serverEventLoading, setServerEventLoading] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState<string | null>(null);
  const [eventDuration, setEventDuration] = useState("");
  const [processingTrust, setProcessingTrust] = useState<string | null>(null);
  const [cancelRequests, setCancelRequests] = useState<any[]>([]);
  const [processingCancel, setProcessingCancel] = useState<string | null>(null);

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterServer, setFilterServer] = useState("");
  const [filterApp, setFilterApp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterValueMin, setFilterValueMin] = useState("");
  const [filterValueMax, setFilterValueMax] = useState("");
  const [filterScreens, setFilterScreens] = useState("");
  const [filterExpiryFrom, setFilterExpiryFrom] = useState("");
  const [filterExpiryTo, setFilterExpiryTo] = useState("");

  // Notify filtered modal
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  const activeAdvancedFiltersCount = [filterServer, filterApp, filterStatus, filterValueMin, filterValueMax, filterScreens, filterExpiryFrom, filterExpiryTo].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    setFilterServer(""); setFilterApp(""); setFilterStatus("");
    setFilterValueMin(""); setFilterValueMax(""); setFilterScreens("");
    setFilterExpiryFrom(""); setFilterExpiryTo("");
  };

  const handleRegisterWebhook = async () => {
    setWebhookLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pix-efi/register-webhook", { method: "POST" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "✅ Webhook configurado!", description: "O webhook PIX foi registrado automaticamente na Efí." });
    } catch (err: any) {
      toast({ title: "❌ Erro ao configurar webhook", description: err.message || "Tente novamente mais tarde.", variant: "destructive" });
    } finally { setWebhookLoading(false); }
  };

  const loadData = async () => {
    const [u, s, a, pa, tr, cr] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("iptv_servers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("iptv_payments").select("*, profiles!iptv_payments_user_id_fkey(name, iptv_server, iptv_connections, iptv_expiry)").eq("status", "paid_pending_activation").order("payment_date", { ascending: false }),
      supabase.from("iptv_trust_requests").select("*, profiles!iptv_trust_requests_user_id_fkey(name, iptv_server, iptv_expiry)").eq("status", "pending").order("requested_at", { ascending: true }),
      supabase.from("iptv_cancellation_requests").select("*, profiles!iptv_cancellation_requests_user_id_fkey(name, iptv_server, iptv_expiry)").eq("status", "pending").order("created_at", { ascending: true }),
    ]);
    setUsers(u.data || []);
    setServers(s.data || []);
    setTvApps(a.data || []);
    setPendingActivations(pa.data || []);
    setTrustRequests(tr.data || []);
    setCancelRequests(cr.data || []);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-iptv-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "iptv_payments" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "iptv_trust_requests" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "iptv_cancellation_requests" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const confirmActivation = async (paymentId: string, userId: string) => {
    setConfirmingPayment(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "confirm_activation", user_id: userId, data: { payment_id: paymentId } },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "✅ Ativação confirmada!" });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setConfirmingPayment(null); }
  };

  const handleTrustAction = async (requestId: string, userId: string, approve: boolean) => {
    setProcessingTrust(requestId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: approve ? "approve_trust_unlock" : "reject_trust_unlock", user_id: userId, data: { request_id: requestId } },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: approve ? "✅ Confiança aprovada!" : "❌ Confiança rejeitada." });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setProcessingTrust(null); }
  };

  const handleCancelAction = async (requestId: string, userId: string, approve: boolean) => {
    setProcessingCancel(requestId);
    try {
      await supabase.from("iptv_cancellation_requests").update({
        status: approve ? "approved" : "rejected",
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        resolved_at: new Date().toISOString(),
        admin_notes: approve ? "Cancelamento aprovado" : "Cancelamento rejeitado",
      }).eq("id", requestId);
      if (approve) {
        await supabase.functions.invoke("admin-manage-user", {
          body: { action: "update_profile", user_id: userId, data: { iptv_status: "disabled" } },
        });
      }
      await supabase.functions.invoke("push-notification", {
        body: {
          action: "send", title: approve ? "Cancelamento Aprovado ✅" : "Cancelamento Recusado",
          body: approve ? "Seu plano IPTV foi cancelado conforme solicitado." : "Sua solicitação de cancelamento foi recusada pelo suporte.",
          target_type: "user", target_ids: [userId],
        },
      });
      toast({ title: approve ? "✅ Cancelamento aprovado" : "❌ Cancelamento rejeitado" });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setProcessingCancel(null); }
  };

  const maintenanceActive = users.some((u) => u.iptv_status === "maintenance");
  const unstableActive = users.some((u) => u.iptv_status === "unstable");

  const handleServerEvent = async (eventType: string, activate: boolean) => {
    setServerEventLoading(eventType);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: activate ? "activate_server_event" : "deactivate_server_event",
          user_id: "system",
          data: { event_type: eventType, duration_minutes: eventDuration ? Number(eventDuration) : null },
        },
      });
      if (error || res?.error) throw new Error(res?.error || error?.message);
      const count = activate ? res?.affected_count : res?.restored_count;
      toast({
        title: activate ? `🔧 ${eventType === "maintenance" ? "Manutenção" : "Instabilidade"} ativada!` : `✅ ${eventType === "maintenance" ? "Manutenção" : "Instabilidade"} finalizada!`,
        description: `${count} clientes ${activate ? "afetados" : "restaurados"}. Notificações enviadas.`,
      });
      setShowEventModal(null);
      setEventDuration("");
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setServerEventLoading(null); }
  };

  const filtered = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const fiveDays = new Date(today);
    fiveDays.setDate(fiveDays.getDate() + 5);
    const fiveDaysStr = fiveDays.toISOString().split("T")[0];

    let list = users;

    // Quick filters
    if (activeFilter === "active") list = list.filter((u) => u.iptv_status === "active");
    else if (activeFilter === "blocked") list = list.filter((u) => u.iptv_status === "blocked");
    else if (activeFilter === "expiring") list = list.filter((u) => u.iptv_expiry === todayStr && u.iptv_status === "active");
    else if (activeFilter === "expiring_5d") list = list.filter((u) => {
      if (!u.iptv_expiry || u.iptv_status === "blocked") return false;
      return u.iptv_expiry >= todayStr && u.iptv_expiry <= fiveDaysStr;
    });
    else if (activeFilter === "expired") list = list.filter((u) => {
      if (!u.iptv_expiry) return false;
      return new Date(u.iptv_expiry) < new Date();
    });
    else if (activeFilter === "unstable") list = list.filter((u) => u.iptv_status === "unstable");
    else if (activeFilter === "awaiting_payment") list = list.filter((u) => u.iptv_status === "awaiting_payment");
    else if (activeFilter === "awaiting_activation") list = list.filter((u) => u.iptv_status === "awaiting_activation");

    // Advanced filters
    if (filterServer) list = list.filter((u) => u.iptv_server === filterServer);
    if (filterApp) list = list.filter((u) => (u.iptv_tv_app || "").toLowerCase().includes(filterApp.toLowerCase()));
    if (filterStatus) list = list.filter((u) => u.iptv_status === filterStatus);
    if (filterValueMin) list = list.filter((u) => Number(u.iptv_monthly_value || 0) >= Number(filterValueMin));
    if (filterValueMax) list = list.filter((u) => Number(u.iptv_monthly_value || 0) <= Number(filterValueMax));
    if (filterScreens) list = list.filter((u) => Number(u.iptv_connections || 1) === Number(filterScreens));
    if (filterExpiryFrom) list = list.filter((u) => u.iptv_expiry && u.iptv_expiry >= filterExpiryFrom);
    if (filterExpiryTo) list = list.filter((u) => u.iptv_expiry && u.iptv_expiry <= filterExpiryTo);

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) ||
          u.iptv_client_code?.toLowerCase().includes(q) || u.iptv_server?.toLowerCase().includes(q) || u.iptv_user?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, search, activeFilter, filterServer, filterApp, filterStatus, filterValueMin, filterValueMax, filterScreens, filterExpiryFrom, filterExpiryTo]);

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
    if (selectedUsers.size === 0) return;
    if (bulkField === "scheduled_rate") {
      if (!bulkRateForm.new_monthly_value || !bulkRateForm.effective_date) return;
      await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "bulk_add_scheduled_rates", user_id: Array.from(selectedUsers)[0],
          data: { user_ids: Array.from(selectedUsers), new_monthly_value: bulkRateForm.new_monthly_value, effective_date: bulkRateForm.effective_date, notes: bulkRateForm.notes },
        },
      });
      toast({ title: `✅ Reajuste programado para ${selectedUsers.size} clientes!` });
      setShowBulk(false); setSelectedUsers(new Set()); setBulkRateForm({ new_monthly_value: "", effective_date: "", notes: "" });
      return;
    }
    if (!bulkValue) return;
    const data: Record<string, any> = {};
    if (["iptv_monthly_value", "iptv_connections"].includes(bulkField)) data[bulkField] = Number(bulkValue);
    else if (bulkField === "admin_notes_urgent") data[bulkField] = bulkValue === "true";
    else data[bulkField] = bulkValue;
    const promises = Array.from(selectedUsers).map((uid) =>
      supabase.functions.invoke("admin-manage-user", { body: { action: "update_profile", user_id: uid, data } })
    );
    await Promise.all(promises);
    toast({ title: `✅ Atualizado para ${selectedUsers.size} clientes!` });
    setShowBulk(false); setSelectedUsers(new Set()); setBulkValue(""); loadData();
  };

  // Send notification to selected/filtered users
  const handleSendNotification = async () => {
    if (!notifyTitle || !notifyBody) return;
    const targetIds = selectedUsers.size > 0 ? Array.from(selectedUsers) : filtered.map((u) => u.id);
    if (targetIds.length === 0) return;
    setNotifySending(true);
    try {
      const { data: notif } = await supabase.from("scheduled_notifications").insert({
        title_template: notifyTitle,
        body_template: notifyBody,
        click_action: "/dashboard",
        target_type: "specific",
        target_ids: targetIds,
        status: "draft",
        created_by: user?.id,
      }).select("id").single();

      if (notif) {
        const { data, error } = await supabase.functions.invoke("send-notification", {
          body: { notification_id: notif.id },
        });
        if (error) throw error;
        toast({ title: `✅ Notificação enviada!`, description: `${data.sent} enviado(s), ${data.failed} falha(s)` });
      }
      setShowNotifyModal(false);
      setNotifyTitle("");
      setNotifyBody("");
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setNotifySending(false); }
  };

  // Unique values for filter dropdowns
  const uniqueApps = useMemo(() => {
    const apps = new Set<string>();
    users.forEach((u) => { if (u.iptv_tv_app) apps.add(u.iptv_tv_app); });
    return Array.from(apps).sort();
  }, [users]);

  const uniqueScreens = useMemo(() => {
    const screens = new Set<number>();
    users.forEach((u) => screens.add(u.iptv_connections || 1));
    return Array.from(screens).sort((a, b) => a - b);
  }, [users]);

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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleRegisterWebhook} disabled={webhookLoading}
            className="flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent/25 transition-colors disabled:opacity-50">
            {webhookLoading ? <Loader2 size={14} className="animate-spin" /> : <Webhook size={14} />} Webhook PIX
          </button>
          <button onClick={() => maintenanceActive ? handleServerEvent("maintenance", false) : setShowEventModal("maintenance")} disabled={serverEventLoading === "maintenance"}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${maintenanceActive ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse hover:bg-yellow-500/30" : "bg-muted/50 text-muted-foreground hover:bg-yellow-500/15 hover:text-yellow-400"}`}>
            {serverEventLoading === "maintenance" ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            {maintenanceActive ? "Encerrar Manutenção" : "Manutenção"}
          </button>
          <button onClick={() => unstableActive ? handleServerEvent("unstable", false) : setShowEventModal("unstable")} disabled={serverEventLoading === "unstable"}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${unstableActive ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse hover:bg-orange-500/30" : "bg-muted/50 text-muted-foreground hover:bg-orange-500/15 hover:text-orange-400"}`}>
            {serverEventLoading === "unstable" ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {unstableActive ? "Encerrar Instabilidade" : "Instabilidade"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards users={users} />

      {/* Awaiting Support Section */}
      {pendingActivations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-amber-400">Aguardando Suporte ({pendingActivations.length})</h3>
          </div>
          <p className="mb-3 text-[10px] text-muted-foreground">Pagamentos PIX recebidos. Confirme após atualizar o servidor.</p>
          <div className="space-y-2">
            {pendingActivations.map((p) => {
              const profile = p.profiles as any;
              const endParts = p.period_end?.split("-");
              const endFormatted = endParts ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : "—";
              const dateParts = p.payment_date ? new Date(p.payment_date) : null;
              const dateFormatted = dateParts ? `${String(dateParts.getDate()).padStart(2,'0')}/${String(dateParts.getMonth()+1).padStart(2,'0')}` : "";
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-card/80 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{profile?.name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{profile?.iptv_server || "—"} · {p.months} mês(es) · até {endFormatted}</p>
                    <p className="text-[10px] text-muted-foreground">R$ {Number(p.amount).toFixed(2)} · Pago em {dateFormatted}</p>
                  </div>
                  <button onClick={() => confirmActivation(p.id, p.user_id)} disabled={confirmingPayment === p.id}
                    className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                    {confirmingPayment === p.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={12} className="inline mr-1" />Confirmar</>}
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Trust Requests */}
      {trustRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border-2 border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-cyan-400">Solicitações de Confiança ({trustRequests.length})</h3>
          </div>
          <p className="mb-3 text-[10px] text-muted-foreground">Clientes solicitaram desbloqueio de confiança (3 dias para pagamento, sem alterar validade).</p>
          <div className="space-y-2">
            {trustRequests.map((tr) => {
              const profile = tr.profiles as any;
              const reqDate = new Date(tr.requested_at);
              const dateFormatted = `${String(reqDate.getDate()).padStart(2,'0')}/${String(reqDate.getMonth()+1).padStart(2,'0')} ${String(reqDate.getHours()).padStart(2,'0')}:${String(reqDate.getMinutes()).padStart(2,'0')}`;
              return (
                <div key={tr.id} className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-card/80 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{profile?.name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{profile?.iptv_server || "—"} · Solicitado em {dateFormatted}</p>
                    {profile?.iptv_expiry && <p className="text-[10px] text-muted-foreground">Validade: {profile.iptv_expiry.split("-").reverse().join("/")}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleTrustAction(tr.id, tr.user_id, true)} disabled={processingTrust === tr.id}
                      className="rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/25 transition-colors disabled:opacity-50">
                      {processingTrust === tr.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={12} className="inline mr-1" />Aprovar</>}
                    </button>
                    <button onClick={() => handleTrustAction(tr.id, tr.user_id, false)} disabled={processingTrust === tr.id}
                      className="rounded-lg bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-50">
                      <XCircle size={12} className="inline" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Cancellation Requests */}
      {cancelRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <XCircle size={16} className="text-red-400" />
            <h3 className="text-sm font-bold text-red-400">Solicitações de Cancelamento ({cancelRequests.length})</h3>
          </div>
          <p className="mb-3 text-[10px] text-muted-foreground">Clientes solicitaram o cancelamento do plano IPTV.</p>
          <div className="space-y-2">
            {cancelRequests.map((cr) => {
              const profile = cr.profiles as any;
              const reqDate = new Date(cr.created_at);
              const dateFormatted = `${String(reqDate.getDate()).padStart(2,'0')}/${String(reqDate.getMonth()+1).padStart(2,'0')} ${String(reqDate.getHours()).padStart(2,'0')}:${String(reqDate.getMinutes()).padStart(2,'0')}`;
              return (
                <div key={cr.id} className="flex items-center justify-between rounded-xl border border-red-500/20 bg-card/80 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{profile?.name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{profile?.iptv_server || "—"} · Solicitado em {dateFormatted}</p>
                    {cr.reason && <p className="mt-1 text-[11px] text-muted-foreground italic">"{cr.reason}"</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <button onClick={() => handleCancelAction(cr.id, cr.user_id, true)} disabled={processingCancel === cr.id}
                      className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50">
                      {processingCancel === cr.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={12} className="inline mr-1" />Aprovar</>}
                    </button>
                    <button onClick={() => handleCancelAction(cr.id, cr.user_id, false)} disabled={processingCancel === cr.id}
                      className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                      <XCircle size={12} className="inline" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quick Filters */}
      <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {QUICK_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setActiveFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all ${activeFilter === f.key ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters Toggle */}
      <div className="mt-3">
        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors w-full justify-between ${activeAdvancedFiltersCount > 0 ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <span className="flex items-center gap-1.5">
            <Filter size={13} />
            Filtros Avançados
            {activeAdvancedFiltersCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{activeAdvancedFiltersCount}</span>
            )}
          </span>
          {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Server */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Servidor</label>
                    <select value={filterServer} onChange={(e) => setFilterServer(e.target.value)} className={`${inputCls} text-xs`}>
                      <option value="">Todos</option>
                      {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  {/* App TV */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">📺 App TV</label>
                    <select value={filterApp} onChange={(e) => setFilterApp(e.target.value)} className={`${inputCls} text-xs`}>
                      <option value="">Todos</option>
                      {uniqueApps.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  {/* Status */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Status</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`${inputCls} text-xs`}>
                      <option value="">Todos</option>
                      {IPTV_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  {/* Screens */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Telas</label>
                    <select value={filterScreens} onChange={(e) => setFilterScreens(e.target.value)} className={`${inputCls} text-xs`}>
                      <option value="">Todas</option>
                      {uniqueScreens.map((s) => <option key={s} value={s}>{s} tela{s > 1 ? "s" : ""}</option>)}
                    </select>
                  </div>
                  {/* Value Range */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Valor Mín (R$)</label>
                    <input type="number" step="0.01" value={filterValueMin} onChange={(e) => setFilterValueMin(e.target.value)} placeholder="0.00" className={`${inputCls} text-xs`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Valor Máx (R$)</label>
                    <input type="number" step="0.01" value={filterValueMax} onChange={(e) => setFilterValueMax(e.target.value)} placeholder="999.99" className={`${inputCls} text-xs`} />
                  </div>
                  {/* Expiry Range */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Vencimento De</label>
                    <input type="date" value={filterExpiryFrom} onChange={(e) => setFilterExpiryFrom(e.target.value)} className={`${inputCls} text-xs`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Vencimento Até</label>
                    <input type="date" value={filterExpiryTo} onChange={(e) => setFilterExpiryTo(e.target.value)} className={`${inputCls} text-xs`} />
                  </div>
                </div>
                {activeAdvancedFiltersCount > 0 && (
                  <button onClick={clearAdvancedFilters} className="text-[11px] font-medium text-destructive hover:underline">
                    Limpar filtros avançados
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search */}
      <div className="relative mt-3 mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, usuário, código, servidor..."
          className="w-full rounded-xl border border-border bg-muted/30 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
        )}
      </div>

      {/* Action bar */}
      <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-[11px] font-medium text-primary hover:underline">
            {selectedUsers.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
          </button>
          <span className="text-[10px] text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Notify button */}
          {(selectedUsers.size > 0 || filtered.length > 0) && (
            <button onClick={() => setShowNotifyModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-500/15 px-3 py-2 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/25 transition-colors">
              <Bell size={13} />
              Notificar {selectedUsers.size > 0 ? `(${selectedUsers.size})` : `Filtrados (${filtered.length})`}
            </button>
          )}
          {/* Bulk update - highlighted */}
          {selectedUsers.size > 0 && (
            <motion.button
              onClick={() => setShowBulk(true)}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-secondary to-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
            >
              <Users size={14} /> ⚡ Massa ({selectedUsers.size})
            </motion.button>
          )}
        </div>
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filtered.map((u, i) => {
          const si = getStatusInfo(u.iptv_status || "active");
          return (
            <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/20 hover:shadow-md hover:shadow-primary/5">
              <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelect(u.id)}
                className="h-4 w-4 shrink-0 rounded border-border accent-primary" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                  {u.admin_notes_urgent && <span className="text-[10px]">🔴</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${si.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${si.dot}`} /> {si.label}
                  </span>
                  {u.iptv_server && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{u.iptv_server}</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">R$ {Number(u.iptv_monthly_value || 0).toFixed(2)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{u.iptv_connections || 1} tela{(u.iptv_connections || 1) > 1 ? "s" : ""}</span>
                  {u.iptv_tv_app && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">📺 {u.iptv_tv_app}</span>}
                </div>
              </div>
              <button onClick={() => setEditUser(u)}
                className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                Editar
              </button>
            </motion.div>
          );
        })}
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</div>}
      </div>

      {/* Edit Panel */}
      <AnimatePresence>
        {editUser && (
          <ClientEditPanel user={editUser} servers={servers} tvApps={tvApps}
            onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); loadData(); }} />
        )}
      </AnimatePresence>

      {/* Bulk Modal */}
      <AnimatePresence>
        {showBulk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setShowBulk(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">⚡ Atualização em Massa</h2>
                <button onClick={() => setShowBulk(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <p className="mb-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 px-3 py-2 text-xs font-bold text-primary border border-primary/20">
                🎯 {selectedUsers.size} cliente{selectedUsers.size > 1 ? "s" : ""} selecionado{selectedUsers.size > 1 ? "s" : ""}
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
                  {bulkField === "scheduled_rate" ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] text-muted-foreground">Valor Base (R$)</label>
                          <input type="number" step="0.01" value={bulkRateForm.new_monthly_value}
                            onChange={(e) => setBulkRateForm({ ...bulkRateForm, new_monthly_value: e.target.value })} placeholder="20.00" className={inputCls} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-muted-foreground">A partir de</label>
                          <input type="date" value={bulkRateForm.effective_date}
                            onChange={(e) => setBulkRateForm({ ...bulkRateForm, effective_date: e.target.value })} className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-muted-foreground">Observação (opcional)</label>
                        <input value={bulkRateForm.notes} onChange={(e) => setBulkRateForm({ ...bulkRateForm, notes: e.target.value })} placeholder="Reajuste anual, etc." className={inputCls} />
                      </div>
                    </div>
                  ) : bulkField === "iptv_status" ? (
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
                <button onClick={bulkUpdate}
                  disabled={bulkField === "scheduled_rate" ? (!bulkRateForm.new_monthly_value || !bulkRateForm.effective_date) : !bulkValue}
                  className="w-full rounded-xl bg-gradient-to-r from-secondary to-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl disabled:opacity-50 transition-all">
                  ⚡ Aplicar para {selectedUsers.size} clientes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notify Filtered Modal */}
      <AnimatePresence>
        {showNotifyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setShowNotifyModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Bell size={16} className="text-blue-400" /> Notificar Clientes
                </h2>
                <button onClick={() => setShowNotifyModal(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <p className="mb-4 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 border border-blue-500/20">
                📨 {selectedUsers.size > 0 ? `${selectedUsers.size} selecionado(s)` : `${filtered.length} filtrado(s)`} receberão a notificação
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Título</label>
                  <input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="Ex: ⚠️ Aviso Importante" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mensagem</label>
                  <textarea value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} rows={3} placeholder="Ex: Olá {nome}, ..." className={`${inputCls} resize-none`} />
                </div>
                <p className="text-[10px] text-muted-foreground">💡 Variáveis disponíveis: {"{nome}"}, {"{venc}"}, {"{valor}"}, {"{app}"}, {"{serv}"}, {"{status}"}</p>
                <button onClick={handleSendNotification} disabled={notifySending || !notifyTitle || !notifyBody}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600 disabled:opacity-50 transition-all">
                  {notifySending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {notifySending ? "Enviando..." : "Enviar Notificação"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Server Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setShowEventModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">
                  {showEventModal === "maintenance" ? "🔧 Ativar Manutenção" : "⚠️ Ativar Instabilidade"}
                </h2>
                <button onClick={() => setShowEventModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Todos os clientes ativos terão o status alterado para {showEventModal === "maintenance" ? "Em Manutenção" : "Instabilidade"} e receberão uma notificação.
              </p>
              <div className="mb-4">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock size={12} /> Tempo estimado (minutos) — opcional
                </label>
                <input type="number" min="1" value={eventDuration} onChange={(e) => setEventDuration(e.target.value)} placeholder="Ex: 30" className={inputCls} />
              </div>
              <button onClick={() => handleServerEvent(showEventModal, true)} disabled={!!serverEventLoading}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition-all disabled:opacity-50 ${showEventModal === "maintenance" ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"}`}>
                {serverEventLoading ? <Loader2 size={16} className="inline animate-spin mr-2" /> : null}
                Ativar {showEventModal === "maintenance" ? "Manutenção" : "Instabilidade"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default AdminIptvPage;
