import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Send, Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Settings2, Zap, Clock, Users, User, Eye, Calendar, Copy, ChevronDown, ChevronUp, Save, Play, Variable, Filter, Upload } from "lucide-react";
import { IPTV_STATUSES } from "./iptv/types";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateBRT, formatDateTimeBRT } from "@/lib/utils";

// ─── Template Variables ───
const TEMPLATE_VARS = [
  { var: "{nome}", desc: "Primeiro nome do cliente" },
  { var: "{user}", desc: "Nome e sobrenome do cliente" },
  { var: "{venc}", desc: "Data de vencimento do cliente" },
  { var: "{valor}", desc: "Valor da mensalidade atual" },
  { var: "{app}", desc: "App instalado na TV do cliente" },
  { var: "{hoje}", desc: "Data de hoje" },
  { var: "{mês}", desc: "Mês atual da mensalidade" },
  { var: "{serv}", desc: "Servidor do cliente" },
  { var: "{status}", desc: "Status do servidor do cliente" },
  { var: "{próx}", desc: "Próximo vencimento" },
  { var: "{sbt}", desc: "Ao vivo no SBT agora" },
  { var: "{globo}", desc: "Ao vivo na Globo agora" },
  { var: "{record}", desc: "Ao vivo na Record agora" },
  { var: "{band}", desc: "Ao vivo na Band agora" },
  { var: "{redetv}", desc: "Ao vivo na RedeTV! agora" },
  { var: "{dicadatarde}", desc: "Destaque da tarde (cadastrado)" },
  { var: "{dicadasemana}", desc: "Destaque da semana (cadastrado)" },
  { var: "{suporte}", desc: "Nome do suporte" },
  { var: "{faltadias}", desc: "Dias restantes p/ vencimento" },
];

// ─── Click Routes ───
const CLICK_ROUTES = [
  { value: "/dashboard", label: "Tela Inicial" },
  { value: "/dashboard#gerar-pix", label: "Gerar PIX" },
  { value: "/dashboard#faturas", label: "Faturas Pagas" },
  { value: "/dashboard#plano", label: "Plano / Renovar" },
  { value: "/dashboard#suporte", label: "Suporte" },
  { value: "/iptv-info", label: "Meu IPTV / Dados de Acesso" },
  { value: "/challenges", label: "Jogos" },
  { value: "/scratch", label: "Raspadinha" },
  { value: "/cup-game", label: "Copos" },
  { value: "/prize-box", label: "Caixa Premiada" },
  { value: "/roulette", label: "Roleta" },
  { value: "/tv-guide", label: "Programação" },
  { value: "/missions", label: "Missões" },
  { value: "/credits", label: "Créditos Comprar" },
  { value: "/memory-game", label: "Memória" },
  { value: "/referrals", label: "Indicações" },
  { value: "/withdrawals", label: "Saques / Sacar" },
  { value: "/history", label: "Histórico de Ganhos" },
];

// ─── Trigger Events ───
const TRIGGER_EVENTS = [
  { value: "payment_received", label: "Pagamento Recebido", icon: "💰", description: "Quando o PIX é confirmado" },
  { value: "activation_confirmed", label: "Ativação Confirmada", icon: "✅", description: "Quando o admin ativa o plano" },
  { value: "expiry_approaching", label: "Vencimento Próximo", icon: "⚠️", description: "X dias antes do vencimento" },
  { value: "user_blocked", label: "Usuário Bloqueado", icon: "🔒", description: "Quando o acesso é bloqueado" },
  { value: "user_activated", label: "Usuário Ativado", icon: "🟢", description: "Quando o status muda para ativo" },
];

const QUICK_TEMPLATES = [
  { icon: "💳", label: "Fatura Paga", title: "Pagamento Confirmado ✅", body: "Sua fatura foi confirmada com sucesso! Obrigado pelo pagamento." },
  { icon: "⏳", label: "Aguardando", title: "Fatura Pendente", body: "Você tem uma fatura aguardando pagamento. Acesse o app para efetuar o pagamento via PIX." },
  { icon: "📅", label: "Vencimento", title: "Vencimento Chegando ⚠️", body: "Olá {nome}! Sua mensalidade vence em {faltadias} dias ({venc}). Renove agora!" },
  { icon: "🔒", label: "Bloqueado", title: "Acesso Bloqueado 🔒", body: "Olá {nome}, seu acesso foi bloqueado por falta de pagamento." },
  { icon: "🔧", label: "Manutenção", title: "Manutenção Programada 🔧", body: "Estamos realizando uma manutenção no sistema." },
  { icon: "⚡", label: "Instabilidade", title: "Instabilidade Detectada ⚡", body: "Identificamos instabilidade no serviço." },
  { icon: "🎮", label: "Jogos", title: "Novos Desafios! 🎮", body: "Novos jogos foram liberados! Venha jogar e ganhar." },
  { icon: "🎁", label: "Promoção", title: "Promoção Especial! 🎁", body: "Aproveite nossa promoção por tempo limitado!" },
  { icon: "🔄", label: "Atualização", title: "Atualização Disponível! 🔄", body: "Uma nova versão do app está disponível! Atualize agora." },
  { icon: "📢", label: "Aviso", title: "Aviso Importante 📢", body: "" },
  { icon: "📺", label: "TV Ao Vivo", title: "🔴 Ao Vivo Agora!", body: "Na Globo: {globo} | SBT: {sbt}. Aproveite!" },
];

interface ScheduledNotification {
  id: string;
  title_template: string;
  body_template: string;
  click_action: string;
  click_banner_id: string | null;
  click_text_title: string;
  click_text_body: string;
  schedule_at: string | null;
  target_type: string;
  target_ids: string[];
  status: string;
  is_active: boolean;
  sent_at: string | null;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  conditions: any;
  title_template: string;
  body_template: string;
  click_url: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

const AdminNotificationsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"saved" | "rules" | "vars">("saved");

  // Saved notifications state
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [editing, setEditing] = useState<Partial<ScheduledNotification> | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [subCount, setSubCount] = useState(0);

  // Banners for click action
  const [banners, setBanners] = useState<any[]>([]);

  // Rules tab state
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [editingRule, setEditingRule] = useState<Partial<NotificationRule> | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  // Legend toggle
  const [showLegend, setShowLegend] = useState(false);

  // Recipient filters
  const [recipientFilterServer, setRecipientFilterServer] = useState("");
  const [recipientFilterApp, setRecipientFilterApp] = useState("");
  const [recipientFilterStatus, setRecipientFilterStatus] = useState("");
  const [recipientFilterScreens, setRecipientFilterScreens] = useState("");
  const [showRecipientFilters, setShowRecipientFilters] = useState(false);
  const [servers, setServers] = useState<any[]>([]);
  const [tvApps, setTvApps] = useState<any[]>([]);

  // Custom variables
  const [customVars, setCustomVars] = useState<{ id: string; var_key: string; label: string; default_value: string; is_active: boolean }[]>([]);
  const [editingVar, setEditingVar] = useState<{ id?: string; var_key: string; label: string; default_value: string } | null>(null);
  const [savingVar, setSavingVar] = useState(false);

  // Click action type
  const [clickType, setClickType] = useState<"route" | "banner" | "text" | "image">("route");
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Refs for inserting variables
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedField = useRef<"title" | "body">("body");

  // Refs for rule modal
  const ruleTitleRef = useRef<HTMLInputElement>(null);
  const ruleBodyRef = useRef<HTMLTextAreaElement>(null);
  const ruleLastFocusedField = useRef<"title" | "body">("body");
  const [showRuleLegend, setShowRuleLegend] = useState(false);

  const insertVariable = (varName: string) => {
    const isTitle = lastFocusedField.current === "title";
    const el = isTitle ? titleRef.current : bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const newValue = el.value.substring(0, start) + varName + el.value.substring(end);
    if (isTitle) {
      setEditing(prev => prev ? { ...prev, title_template: newValue } : prev);
    } else {
      setEditing(prev => prev ? { ...prev, body_template: newValue } : prev);
    }
    setTimeout(() => {
      el.focus();
      const pos = start + varName.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertRuleVariable = (varName: string) => {
    const isTitle = ruleLastFocusedField.current === "title";
    const el = isTitle ? ruleTitleRef.current : ruleBodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const newValue = el.value.substring(0, start) + varName + el.value.substring(end);
    if (isTitle) {
      setEditingRule(prev => prev ? { ...prev, title_template: newValue } : prev);
    } else {
      setEditingRule(prev => prev ? { ...prev, body_template: newValue } : prev);
    }
    setTimeout(() => {
      el.focus();
      const pos = start + varName.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [usersRes, subsRes, rulesRes, notifsRes, bannersRes, varsRes, serversRes, tvAppsRes] = await Promise.all([
      supabase.from("profiles").select("id, name, username, iptv_server, iptv_tv_app, iptv_status, iptv_connections, iptv_monthly_value, iptv_expiry").order("name"),
      supabase.from("push_subscriptions").select("id", { count: "exact" }),
      supabase.from("notification_rules").select("*").order("created_at", { ascending: true }),
      supabase.from("scheduled_notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("content").select("id, title, content_type").eq("is_active", true).order("title"),
      supabase.from("custom_variables").select("*").order("created_at", { ascending: true }),
      supabase.from("iptv_servers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("iptv_tv_apps").select("*").eq("is_active", true).order("sort_order"),
    ]);
    setUsers(usersRes.data || []);
    setSubCount(subsRes.count || 0);
    setRules((rulesRes.data as any[]) || []);
    setNotifications((notifsRes.data as any[]) || []);
    setBanners(bannersRes.data || []);
    setCustomVars((varsRes.data as any[]) || []);
    setServers(serversRes.data || []);
    setTvApps(tvAppsRes.data || []);
  };

  // ─── Send Notification ───
  const sendNotification = async (notifId: string) => {
    setSendingId(notifId);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: { notification_id: notifId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `✅ Enviada!`, description: `${data.sent} enviado(s), ${data.failed} falha(s)` });
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setSendingId(null); }
  };

  // ─── Save Notification ───
  const saveNotif = async () => {
    if (!editing || !editing.body_template) return;
    if (clickType === "image" && !editing.click_text_body) {
      toast({ title: "⚠️ Imagem obrigatória", description: "Selecione uma imagem para o popup." });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title_template: editing.title_template || "",
        body_template: editing.body_template,
        click_action: clickType === "route" ? (editing.click_action || "/dashboard") : "/dashboard",
        click_banner_id: clickType === "banner" ? editing.click_banner_id : null,
        click_text_title: clickType === "text" ? (editing.click_text_title || "") : clickType === "image" ? "__IMAGE__" : "",
        click_text_body: clickType === "text" ? (editing.click_text_body || "") : clickType === "image" ? (editing.click_text_body || "") : "",
        schedule_at: editing.schedule_at || null,
        target_type: "specific",
        target_ids: editing.target_ids || [],
        is_active: editing.is_active ?? true,
        status: editing.schedule_at ? "scheduled" : "draft",
      };

      if (editing.id) {
        await supabase.from("scheduled_notifications").update(payload).eq("id", editing.id);
        toast({ title: "✅ Notificação atualizada!" });
      } else {
        payload.created_by = user?.id;
        await supabase.from("scheduled_notifications").insert(payload);
        toast({ title: "✅ Notificação salva!" });
      }
      setEditing(null);
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("scheduled_notifications").delete().eq("id", id);
    loadData();
    toast({ title: "🗑️ Removida" });
  };

  // ─── Rules ───
  const toggleRule = async (rule: NotificationRule) => {
    await supabase.from("notification_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
    loadData();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("notification_rules").delete().eq("id", id);
    loadData();
    toast({ title: "🗑️ Regra removida" });
  };

  const saveRule = async () => {
    if (!editingRule || !editingRule.name || !editingRule.title_template || !editingRule.body_template || !editingRule.trigger_event) return;
    setSavingRule(true);
    try {
      const payload = {
        name: editingRule.name,
        description: editingRule.description || "",
        trigger_event: editingRule.trigger_event,
        conditions: editingRule.conditions || {},
        title_template: editingRule.title_template,
        body_template: editingRule.body_template,
        click_url: editingRule.click_url || "/",
        icon: editingRule.icon || "",
        is_active: editingRule.is_active ?? true,
      };

      if (editingRule.id) {
        await supabase.from("notification_rules").update(payload).eq("id", editingRule.id);
        toast({ title: "✅ Regra atualizada!" });
      } else {
        await supabase.from("notification_rules").insert(payload);
        toast({ title: "✅ Regra criada!" });
      }
      setEditingRule(null);
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setSavingRule(false); }
  };

  // ─── Send Rule to Specific Users ───
  const [sendRuleManual, setSendRuleManual] = useState<NotificationRule | null>(null);
  const [manualRuleUsers, setManualRuleUsers] = useState<string[]>([]);
  const [sendingRuleManual, setSendingRuleManual] = useState(false);
  const [ruleManualSearch, setRuleManualSearch] = useState("");

  const handleSendRuleManual = async () => {
    if (!sendRuleManual || manualRuleUsers.length === 0) return;
    setSendingRuleManual(true);
    try {
      // Create a temporary notification and send it
      const { data: notif } = await supabase.from("scheduled_notifications").insert({
        title_template: sendRuleManual.title_template,
        body_template: sendRuleManual.body_template,
        click_action: sendRuleManual.click_url || "/",
        target_type: "specific",
        target_ids: manualRuleUsers,
        status: "draft",
        created_by: user?.id,
      }).select("id").single();

      if (notif) {
        const { data, error } = await supabase.functions.invoke("send-notification", {
          body: { notification_id: notif.id },
        });
        if (error) throw error;
        toast({ title: `✅ Enviada!`, description: `${data.sent} enviado(s)` });
      }

      setSendRuleManual(null);
      setManualRuleUsers([]);
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setSendingRuleManual(false); }
  };

  const filteredUsers = users.filter((u) => {
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase()) && !u.username?.toLowerCase().includes(search.toLowerCase())) return false;
    if (recipientFilterServer && u.iptv_server !== recipientFilterServer) return false;
    if (recipientFilterApp && !(u.iptv_tv_app || "").toLowerCase().includes(recipientFilterApp.toLowerCase())) return false;
    if (recipientFilterStatus && u.iptv_status !== recipientFilterStatus) return false;
    if (recipientFilterScreens && Number(u.iptv_connections || 1) !== Number(recipientFilterScreens)) return false;
    return true;
  });

  const recipientFiltersActive = [recipientFilterServer, recipientFilterApp, recipientFilterStatus, recipientFilterScreens].filter(Boolean).length;

  const uniqueAppsNotif = [...new Set(users.map((u: any) => u.iptv_tv_app).filter(Boolean))].sort() as string[];
  const uniqueScreensNotif = [...new Set(users.map((u: any) => u.iptv_connections || 1))].sort((a: number, b: number) => a - b) as number[];

  const openNewNotif = () => {
    setEditing({ target_type: "specific", is_active: true, target_ids: [], click_action: "/dashboard" });
    setClickType("route");
  };

  const openEditNotif = (n: ScheduledNotification) => {
    setEditing(n);
    if (n.click_banner_id) setClickType("banner");
    else if (n.click_text_title === "__IMAGE__") setClickType("image");
    else if (n.click_text_body) setClickType("text");
    else setClickType("route");
  };

  const allVars = [...TEMPLATE_VARS, ...customVars.filter(v => v.is_active).map(v => ({ var: `{${v.var_key}}`, desc: v.label || v.default_value }))];

  const saveCustomVar = async () => {
    if (!editingVar || !editingVar.var_key) return;
    setSavingVar(true);
    try {
      const key = editingVar.var_key.replace(/[{}]/g, "").trim();
      if (!key) throw new Error("Nome da variável é obrigatório");
      const payload = { var_key: key, label: editingVar.label || "", default_value: editingVar.default_value || "" };
      if (editingVar.id) {
        await supabase.from("custom_variables").update(payload).eq("id", editingVar.id);
        toast({ title: "✅ Variável atualizada!" });
      } else {
        await supabase.from("custom_variables").insert(payload);
        toast({ title: "✅ Variável criada!" });
      }
      setEditingVar(null);
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setSavingVar(false); }
  };

  const deleteCustomVar = async (id: string) => {
    await supabase.from("custom_variables").delete().eq("id", id);
    loadData();
    toast({ title: "🗑️ Variável removida" });
  };

  const toggleCustomVar = async (v: any) => {
    await supabase.from("custom_variables").update({ is_active: !v.is_active }).eq("id", v.id);
    loadData();
  };
  const inputCls = "w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all";
  const labelCls = "mb-1.5 block text-xs font-medium text-muted-foreground";

  return (
    <AppLayout>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Bell size={16} className="text-primary" />
          </div>
          Notificações Push
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {subCount} dispositivo{subCount !== 1 ? "s" : ""} inscrito{subCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setActiveTab("saved")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "saved" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <Bell size={13} /> Notificações
        </button>
        <button onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "rules" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <Settings2 size={13} /> Regras
        </button>
        <button onClick={() => setActiveTab("vars")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "vars" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <Variable size={13} /> Variáveis
        </button>
      </div>

      {/* Legend moved inside modal only */}

      {/* ─── TAB: Saved Notifications ─── */}
      {activeTab === "saved" && (
        <>
          {/* Quick Templates */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">⚡ Templates Rápidos</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => {
                  setEditing({ target_type: "specific", is_active: true, target_ids: [], click_action: "/dashboard", title_template: t.title, body_template: t.body });
                  setClickType("route");
                }}
                  className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Crie, salve e envie notificações personalizadas</p>
            <button onClick={openNewNotif}
              className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors">
              <Plus size={13} /> Nova
            </button>
          </div>

          {/* Notifications List */}
          <div className="space-y-2">
            {notifications.map((n) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{n.title_template}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                        n.status === "sent" ? "bg-emerald-500/15 text-emerald-400" :
                        n.status === "scheduled" ? "bg-amber-500/15 text-amber-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {n.status === "sent" ? "ENVIADA" : n.status === "scheduled" ? "AGENDADA" : "RASCUNHO"}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                        {n.target_type === "all" ? "Todos" : `${n.target_ids?.length || 0} usuário(s)`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1">{n.body_template}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {n.schedule_at && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 flex items-center gap-1">
                          <Clock size={9} /> {formatDateBRT(n.schedule_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {n.sent_at && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                          ✅ {n.sent_count} enviado(s) {n.failed_count > 0 ? `❌ ${n.failed_count}` : ""}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {CLICK_ROUTES.find(r => r.value === n.click_action)?.label || n.click_action}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => sendNotification(n.id)} disabled={sendingId === n.id}
                      className="rounded-lg p-2 hover:bg-emerald-500/10 transition-colors" title="Enviar agora">
                      {sendingId === n.id ? <Loader2 size={14} className="animate-spin text-primary" /> : <Play size={14} className="text-emerald-400" />}
                    </button>
                    <button onClick={() => openEditNotif(n)} className="rounded-lg p-2 hover:bg-muted transition-colors">
                      <Pencil size={14} className="text-primary" />
                    </button>
                    <button onClick={() => deleteNotif(n.id)} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {notifications.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Nenhuma notificação salva</p>}
          </div>
        </>
      )}

      {/* ─── TAB: Rules ─── */}
      {activeTab === "rules" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Regras que disparam notificações automáticas por evento</p>
            <button onClick={() => setEditingRule({ trigger_event: "payment_received", is_active: true, conditions: {}, click_url: "/" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors">
              <Plus size={13} /> Nova Regra
            </button>
          </div>

          <div className="space-y-2">
            {rules.map((rule) => {
              const trigger = TRIGGER_EVENTS.find((t) => t.value === rule.trigger_event);
              return (
                <motion.div key={rule.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border bg-card p-4 transition-all ${rule.is_active ? "border-border" : "border-border/50 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{trigger?.icon || "📌"}</span>
                        <p className="text-sm font-bold text-foreground truncate">{rule.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${rule.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {rule.is_active ? "ATIVA" : "INATIVA"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">{rule.description}</p>
                      <div className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                        <p className="text-xs font-semibold text-foreground">{rule.title_template}</p>
                        <p className="text-[11px] text-muted-foreground">{rule.body_template}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {trigger?.label || rule.trigger_event}
                        </span>
                        {rule.conditions?.days_before_expiry && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            {rule.conditions.days_before_expiry} dias antes
                          </span>
                        )}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {CLICK_ROUTES.find(r => r.value === rule.click_url)?.label || rule.click_url}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 flex-col">
                      <div className="flex gap-1">
                        <button onClick={() => toggleRule(rule)} className="rounded-lg p-2 hover:bg-muted transition-colors" title={rule.is_active ? "Desativar" : "Ativar"}>
                          {rule.is_active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                        </button>
                        <button onClick={() => setEditingRule(rule)} className="rounded-lg p-2 hover:bg-muted transition-colors">
                          <Pencil size={14} className="text-primary" />
                        </button>
                        <button onClick={() => deleteRule(rule.id)} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
                          <Trash2 size={14} className="text-destructive" />
                        </button>
                      </div>
                      <button onClick={() => { setSendRuleManual(rule); setManualRuleUsers([]); setRuleManualSearch(""); }}
                        className="rounded-lg p-1.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 justify-center">
                        <Send size={10} /> Manual
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {rules.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma regra configurada</p>}
          </div>
        </>
      )}

      {/* ─── TAB: Custom Variables ─── */}
      {activeTab === "vars" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Crie variáveis personalizadas para usar em notificações</p>
            <button onClick={() => setEditingVar({ var_key: "", label: "", default_value: "" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors">
              <Plus size={13} /> Nova Variável
            </button>
          </div>

          {/* Built-in vars info */}
          <div className="mb-4 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground mb-2">📎 Variáveis do Sistema ({TEMPLATE_VARS.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS.map((v) => (
                <span key={v.var} className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-mono text-muted-foreground" title={v.desc}>
                  {v.var}
                </span>
              ))}
            </div>
          </div>

          {/* Custom vars list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">✏️ Variáveis Personalizadas</p>
            {customVars.map((v) => (
              <motion.div key={v.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border bg-card p-4 transition-all ${v.is_active ? "border-border" : "border-border/50 opacity-60"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-bold text-primary">{`{${v.var_key}}`}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${v.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {v.is_active ? "ATIVA" : "INATIVA"}
                      </span>
                    </div>
                    {v.label && <p className="text-[11px] text-muted-foreground">{v.label}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">Valor padrão: <span className="font-medium text-foreground">{v.default_value || "(vazio)"}</span></p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => toggleCustomVar(v)} className="rounded-lg p-2 hover:bg-muted transition-colors">
                      {v.is_active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => setEditingVar({ id: v.id, var_key: v.var_key, label: v.label, default_value: v.default_value })} className="rounded-lg p-2 hover:bg-muted transition-colors">
                      <Pencil size={14} className="text-primary" />
                    </button>
                    <button onClick={() => deleteCustomVar(v.id)} className="rounded-lg p-2 hover:bg-destructive/10 transition-colors">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {customVars.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma variável personalizada criada</p>}
          </div>

          {/* Edit/Create Variable Modal */}
          <AnimatePresence>
            {editingVar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setEditingVar(null)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Variable size={16} className="text-primary" />
                      {editingVar.id ? "Editar Variável" : "Nova Variável"}
                    </h2>
                    <button onClick={() => setEditingVar(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Nome (sem chaves)</label>
                      <input value={editingVar.var_key} onChange={(e) => setEditingVar({ ...editingVar, var_key: e.target.value.replace(/[{}]/g, "").replace(/\s/g, "") })} placeholder="Ex: pix_code" className={inputCls} />
                      <p className="mt-1 text-[10px] text-muted-foreground">Será usado como: <span className="font-mono font-bold text-primary">{`{${editingVar.var_key || "..."}}`}</span></p>
                    </div>
                    <div>
                      <label className={labelCls}>Descrição</label>
                      <input value={editingVar.label} onChange={(e) => setEditingVar({ ...editingVar, label: e.target.value })} placeholder="Ex: Código PIX do cliente" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Valor Padrão</label>
                      <input value={editingVar.default_value} onChange={(e) => setEditingVar({ ...editingVar, default_value: e.target.value })} placeholder="Ex: Não disponível" className={inputCls} />
                    </div>
                    <button onClick={saveCustomVar} disabled={savingVar || !editingVar.var_key}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                      {savingVar ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {savingVar ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Bell size={16} className="text-primary" />
                  {editing.id ? "Editar Notificação" : "Nova Notificação"}
                </h2>
                <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className={labelCls}>Título (opcional)</label>
                  <input ref={titleRef} onFocus={() => { lastFocusedField.current = "title"; }} value={editing.title_template || ""} onChange={(e) => setEditing({ ...editing, title_template: e.target.value })} placeholder="Ex: ✅ Olá {nome}!" className={inputCls} />
                </div>

                {/* Body */}
                <div>
                  <label className={labelCls}>Mensagem</label>
                  <textarea ref={bodyRef} onFocus={() => { lastFocusedField.current = "body"; }} value={editing.body_template || ""} onChange={(e) => setEditing({ ...editing, body_template: e.target.value })} rows={3} placeholder="Ex: Sua mensalidade de {valor} vence em {faltadias} dias..." className={`${inputCls} resize-none`} />
                </div>

                {/* Variables Legend */}
                <div>
                  <button onClick={() => setShowLegend(!showLegend)}
                    className="flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors w-full justify-between">
                    <span>📎 Variáveis Disponíveis</span>
                    {showLegend ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <AnimatePresence>
                    {showLegend && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                          {allVars.map((v) => (
                            <div key={v.var} className="flex items-center gap-2">
                              <button onClick={() => insertVariable(v.var)}
                                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-mono font-bold text-primary hover:bg-primary/20 transition-colors">
                                {v.var} <Plus size={9} />
                              </button>
                              <span className="text-[10px] text-muted-foreground">{v.desc}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Click Action */}
                <div>
                  <label className={labelCls}>Ação ao Clicar</label>
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {(["route", "banner", "image", "text"] as const).map((t) => (
                      <button key={t} onClick={() => setClickType(t)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${clickType === t ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                        {t === "route" ? "📍 Tela" : t === "banner" ? "🖼️ Banner" : t === "image" ? "📷 Imagem" : "📝 Texto"}
                      </button>
                    ))}
                  </div>

                  {clickType === "route" && (
                    <select value={editing.click_action || "/dashboard"} onChange={(e) => setEditing({ ...editing, click_action: e.target.value })} className={inputCls}>
                      {CLICK_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  )}

                  {clickType === "banner" && (
                    <select value={editing.click_banner_id || ""} onChange={(e) => setEditing({ ...editing, click_banner_id: e.target.value })} className={inputCls}>
                      <option value="">Selecione um banner...</option>
                      {banners.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.content_type})</option>)}
                    </select>
                  )}

                  {clickType === "image" && (
                    <div className="space-y-2">
                      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImage(true);
                        try {
                          const ext = file.name.split(".").pop() || "jpg";
                          const path = `notif-images/${Date.now()}.${ext}`;
                          const { error: upErr } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
                          if (upErr) throw upErr;
                          const { data: urlData } = supabase.storage.from("banners").getPublicUrl(path);
                          setEditing(prev => prev ? { ...prev, click_text_body: urlData.publicUrl } : prev);
                        } catch (err: any) {
                          toast({ title: "❌ Erro no upload", description: err.message, variant: "destructive" });
                        } finally {
                          setUploadingImage(false);
                          if (imageInputRef.current) imageInputRef.current.value = "";
                        }
                      }} />
                      <button onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-4 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50">
                        {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploadingImage ? "Enviando..." : "Selecionar Imagem"}
                      </button>
                      {editing.click_text_body && (
                        <div className="rounded-xl border border-border bg-muted/30 p-2 relative">
                          <img src={editing.click_text_body} alt="Preview" className="w-full rounded-lg object-contain max-h-48" />
                          <button onClick={() => setEditing({ ...editing, click_text_body: "" })}
                            className="absolute top-3 right-3 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">A imagem será pré-carregada e exibida como popup ao clicar na notificação</p>
                    </div>
                  )}

                  {clickType === "text" && (
                    <div className="space-y-2">
                      <input value={editing.click_text_title || ""} onChange={(e) => setEditing({ ...editing, click_text_title: e.target.value })} placeholder="Título do popup" className={inputCls} />
                      <textarea value={editing.click_text_body || ""} onChange={(e) => setEditing({ ...editing, click_text_body: e.target.value })} rows={3} placeholder="Texto que aparece ao clicar na notificação..." className={`${inputCls} resize-none`} />
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div>
                  <label className={labelCls}>Agendar (opcional)</label>
                  <input type="datetime-local" value={editing.schedule_at ? new Date(editing.schedule_at).toISOString().slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, schedule_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inputCls} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Deixe vazio para envio manual</p>
                </div>

                {/* Target - with filters */}
                <div>
                  <label className={labelCls}>Destinatários</label>
                  <div className="space-y-2">
                    {/* Filter toggle */}
                    <button onClick={() => setShowRecipientFilters(!showRecipientFilters)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors w-full justify-between ${recipientFiltersActive > 0 ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                      <span className="flex items-center gap-1.5">
                        <Filter size={11} /> Filtrar por perfil
                        {recipientFiltersActive > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{recipientFiltersActive}</span>}
                      </span>
                      {showRecipientFilters ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    <AnimatePresence>
                      {showRecipientFilters && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-0.5 block text-[10px] text-muted-foreground">Servidor</label>
                              <select value={recipientFilterServer} onChange={(e) => setRecipientFilterServer(e.target.value)} className={`${inputCls} text-xs !py-1.5`}>
                                <option value="">Todos</option>
                                {servers.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] text-muted-foreground">📺 App TV</label>
                              <select value={recipientFilterApp} onChange={(e) => setRecipientFilterApp(e.target.value)} className={`${inputCls} text-xs !py-1.5`}>
                                <option value="">Todos</option>
                                {uniqueAppsNotif.map((a) => <option key={a} value={a}>{a}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] text-muted-foreground">Status</label>
                              <select value={recipientFilterStatus} onChange={(e) => setRecipientFilterStatus(e.target.value)} className={`${inputCls} text-xs !py-1.5`}>
                                <option value="">Todos</option>
                                {IPTV_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] text-muted-foreground">Telas</label>
                              <select value={recipientFilterScreens} onChange={(e) => setRecipientFilterScreens(e.target.value)} className={`${inputCls} text-xs !py-1.5`}>
                                <option value="">Todas</option>
                                {uniqueScreensNotif.map((s) => <option key={s} value={s}>{s} tela{s > 1 ? "s" : ""}</option>)}
                              </select>
                            </div>
                          </div>
                          {recipientFiltersActive > 0 && (
                            <button onClick={() => { setRecipientFilterServer(""); setRecipientFilterApp(""); setRecipientFilterStatus(""); setRecipientFilterScreens(""); }}
                              className="mt-1 text-[10px] font-medium text-destructive hover:underline">Limpar filtros</button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex gap-2 mb-1">
                      <button onClick={() => {
                        const allIds = filteredUsers.map(u => u.id);
                        setEditing({ ...editing, target_type: "specific", target_ids: allIds });
                      }}
                        className="rounded-lg bg-muted/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                        {recipientFiltersActive > 0 ? `Selecionar Filtrados (${filteredUsers.length})` : "Selecionar Todos"}
                      </button>
                      <button onClick={() => setEditing({ ...editing, target_type: "specific", target_ids: [] })}
                        className="rounded-lg bg-muted/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        Limpar
                      </button>
                    </div>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário..." className={inputCls} />
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                      {filteredUsers.slice(0, 30).map((u) => (
                        <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                          <input type="checkbox" checked={(editing.target_ids || []).includes(u.id)}
                            onChange={(e) => {
                              const ids = editing.target_ids || [];
                              setEditing({ ...editing, target_ids: e.target.checked ? [...ids, u.id] : ids.filter((id: string) => id !== u.id) });
                            }}
                            className="h-3.5 w-3.5 rounded accent-primary" />
                          <span className="text-xs text-foreground">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground">@{u.username}</span>
                        </label>
                      ))}
                    </div>
                    {(editing.target_ids || []).length > 0 && <p className="text-[10px] text-primary font-medium">{(editing.target_ids || []).length} selecionado(s)</p>}
                  </div>
                </div>

                {/* Save + Send */}
                <div className="flex gap-2">
                  <button onClick={saveNotif} disabled={saving || !editing.body_template || (clickType === "image" && !editing.click_text_body)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Edit/Create Rule Modal ─── */}
      <AnimatePresence>
        {editingRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setEditingRule(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Zap size={16} className="text-primary" />
                  {editingRule.id ? "Editar Regra" : "Nova Regra"}
                </h2>
                <button onClick={() => setEditingRule(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Nome da Regra</label>
                  <input value={editingRule.name || ""} onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })} placeholder="Ex: Lembrete de Pagamento" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Descrição</label>
                  <input value={editingRule.description || ""} onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })} placeholder="Quando esta regra é disparada..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Evento Gatilho</label>
                  <div className="space-y-1.5">
                    {TRIGGER_EVENTS.map((t) => (
                      <label key={t.value} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${editingRule.trigger_event === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        <input type="radio" name="trigger" checked={editingRule.trigger_event === t.value}
                          onChange={() => setEditingRule({ ...editingRule, trigger_event: t.value })}
                          className="accent-primary" />
                        <span className="text-lg">{t.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{t.label}</p>
                          <p className="text-[10px] text-muted-foreground">{t.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {editingRule.trigger_event === "expiry_approaching" && (
                  <div>
                    <label className={labelCls}>Dias antes do vencimento</label>
                    <input type="number" min={1} max={30}
                      value={editingRule.conditions?.days_before_expiry || 5}
                      onChange={(e) => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, days_before_expiry: Number(e.target.value) } })}
                      className={inputCls} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Título da Notificação</label>
                  <input ref={ruleTitleRef} onFocus={() => { ruleLastFocusedField.current = "title"; }} value={editingRule.title_template || ""} onChange={(e) => setEditingRule({ ...editingRule, title_template: e.target.value })} placeholder="Ex: ✅ Olá {nome}!" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Corpo da Notificação</label>
                  <textarea ref={ruleBodyRef} onFocus={() => { ruleLastFocusedField.current = "body"; }} value={editingRule.body_template || ""} onChange={(e) => setEditingRule({ ...editingRule, body_template: e.target.value })} rows={3} placeholder="Ex: Sua mensalidade vence em {faltadias} dias..." className={`${inputCls} resize-none`} />
                </div>

                {/* Variables Legend for Rules */}
                <div>
                  <button onClick={() => setShowRuleLegend(!showRuleLegend)}
                    className="flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors w-full justify-between">
                    <span>📎 Variáveis Disponíveis</span>
                    {showRuleLegend ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <AnimatePresence>
                    {showRuleLegend && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                          {allVars.map((v) => (
                            <div key={v.var} className="flex items-center gap-2">
                              <button onClick={() => insertRuleVariable(v.var)}
                                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-mono font-bold text-primary hover:bg-primary/20 transition-colors">
                                {v.var} <Plus size={9} />
                              </button>
                              <span className="text-[10px] text-muted-foreground">{v.desc}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label className={labelCls}>Caminho ao Clicar</label>
                  <select value={editingRule.click_url || "/"} onChange={(e) => setEditingRule({ ...editingRule, click_url: e.target.value })} className={inputCls}>
                    {CLICK_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <button onClick={saveRule} disabled={savingRule || !editingRule.name || !editingRule.title_template || !editingRule.body_template}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                  {savingRule ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  {savingRule ? "Salvando..." : editingRule.id ? "Salvar Alterações" : "Criar Regra"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Send Rule Manually Modal ─── */}
      <AnimatePresence>
        {sendRuleManual && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setSendRuleManual(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Send size={16} className="text-primary" />
                  Enviar Regra Manualmente
                </h2>
                <button onClick={() => setSendRuleManual(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 mb-4 space-y-1">
                <p className="text-xs font-semibold text-foreground">{sendRuleManual.title_template}</p>
                <p className="text-[11px] text-muted-foreground">{sendRuleManual.body_template}</p>
              </div>

              <div className="space-y-3">
                <input value={ruleManualSearch} onChange={(e) => setRuleManualSearch(e.target.value)} placeholder="Buscar usuário..." className={inputCls} />
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                  {users.filter((u) => u.name?.toLowerCase().includes(ruleManualSearch.toLowerCase()) || u.username?.toLowerCase().includes(ruleManualSearch.toLowerCase())).slice(0, 30).map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={manualRuleUsers.includes(u.id)}
                        onChange={(e) => e.target.checked ? setManualRuleUsers([...manualRuleUsers, u.id]) : setManualRuleUsers(manualRuleUsers.filter(id => id !== u.id))}
                        className="h-3.5 w-3.5 rounded accent-primary" />
                      <span className="text-xs text-foreground">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground">@{u.username}</span>
                    </label>
                  ))}
                </div>
                {manualRuleUsers.length > 0 && <p className="text-[10px] text-primary font-medium">{manualRuleUsers.length} selecionado(s)</p>}

                <button onClick={handleSendRuleManual} disabled={sendingRuleManual || manualRuleUsers.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                  {sendingRuleManual ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {sendingRuleManual ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default AdminNotificationsPage;
