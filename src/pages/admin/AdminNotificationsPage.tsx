import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Send, Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Settings2, Zap, Clock, Users, User, Eye, Calendar, Copy, ChevronDown, ChevronUp, Save, Play } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
  { value: "/iptv-info", label: "Meu IPTV / Dados de Acesso" },
  { value: "/iptv-info#gerar-pix", label: "Gerar PIX" },
  { value: "/iptv-info#faturas", label: "Faturas Pagas" },
  { value: "/challenges", label: "Jogos" },
  { value: "/scratch", label: "Raspadinha" },
  { value: "/cup-game", label: "Copos" },
  { value: "/prize-box", label: "Caixa Premiada" },
  { value: "/roulette", label: "Roleta" },
  { value: "/tv-guide", label: "Programação" },
  { value: "/iptv-info#app-tv", label: "App da TV" },
  { value: "/iptv-info#observacao", label: "Observação" },
  { value: "/iptv-info#suporte", label: "Suporte" },
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
  const [activeTab, setActiveTab] = useState<"saved" | "rules">("saved");

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

  // Click action type
  const [clickType, setClickType] = useState<"route" | "banner" | "text">("route");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [usersRes, subsRes, rulesRes, notifsRes, bannersRes] = await Promise.all([
      supabase.from("profiles").select("id, name, username").order("name"),
      supabase.from("push_subscriptions").select("id", { count: "exact" }),
      supabase.from("notification_rules").select("*").order("created_at", { ascending: true }),
      supabase.from("scheduled_notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("content").select("id, title, content_type").eq("is_active", true).order("title"),
    ]);
    setUsers(usersRes.data || []);
    setSubCount(subsRes.count || 0);
    setRules((rulesRes.data as any[]) || []);
    setNotifications((notifsRes.data as any[]) || []);
    setBanners(bannersRes.data || []);
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
    if (!editing || !editing.title_template || !editing.body_template) return;
    setSaving(true);
    try {
      const payload: any = {
        title_template: editing.title_template,
        body_template: editing.body_template,
        click_action: clickType === "route" ? (editing.click_action || "/dashboard") : clickType === "banner" ? "/dashboard" : "/dashboard",
        click_banner_id: clickType === "banner" ? editing.click_banner_id : null,
        click_text_title: clickType === "text" ? (editing.click_text_title || "") : "",
        click_text_body: clickType === "text" ? (editing.click_text_body || "") : "",
        schedule_at: editing.schedule_at || null,
        target_type: editing.target_type || "all",
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

  const filteredUsers = users.filter(
    (u) => u.name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const ruleFilteredUsers = users.filter(
    (u) => u.name?.toLowerCase().includes(ruleManualSearch.toLowerCase()) || u.username?.toLowerCase().includes(ruleManualSearch.toLowerCase())
  );

  const openNewNotif = () => {
    setEditing({ target_type: "all", is_active: true, target_ids: [], click_action: "/dashboard" });
    setClickType("route");
  };

  const openEditNotif = (n: ScheduledNotification) => {
    setEditing(n);
    if (n.click_banner_id) setClickType("banner");
    else if (n.click_text_body) setClickType("text");
    else setClickType("route");
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
          <Settings2 size={13} /> Regras Automáticas
        </button>
      </div>

      {/* ─── Legend ─── */}
      <div className="mb-4">
        <button onClick={() => setShowLegend(!showLegend)}
          className="flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors w-full justify-between">
          <span>📎 Variáveis Disponíveis</span>
          {showLegend ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <AnimatePresence>
          {showLegend && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                {TEMPLATE_VARS.map((v) => (
                  <div key={v.var} className="flex items-center gap-2">
                    <button onClick={() => navigator.clipboard.writeText(v.var)}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-mono font-bold text-primary hover:bg-primary/20 transition-colors">
                      {v.var} <Copy size={9} />
                    </button>
                    <span className="text-[10px] text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── TAB: Saved Notifications ─── */}
      {activeTab === "saved" && (
        <>
          {/* Quick Templates */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">⚡ Templates Rápidos</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => {
                  setEditing({ target_type: "all", is_active: true, target_ids: [], click_action: "/dashboard", title_template: t.title, body_template: t.body });
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
                          <Clock size={9} /> {new Date(n.schedule_at).toLocaleDateString("pt-BR")} {new Date(n.schedule_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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

      {/* ─── Edit/Create Notification Modal ─── */}
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
                  <label className={labelCls}>Título</label>
                  <input value={editing.title_template || ""} onChange={(e) => setEditing({ ...editing, title_template: e.target.value })} placeholder="Ex: ✅ Olá {nome}!" className={inputCls} />
                </div>

                {/* Body */}
                <div>
                  <label className={labelCls}>Mensagem</label>
                  <textarea value={editing.body_template || ""} onChange={(e) => setEditing({ ...editing, body_template: e.target.value })} rows={3} placeholder="Ex: Sua mensalidade de {valor} vence em {faltadias} dias..." className={`${inputCls} resize-none`} />
                </div>

                {/* Click Action */}
                <div>
                  <label className={labelCls}>Ação ao Clicar</label>
                  <div className="flex gap-1.5 mb-2">
                    {(["route", "banner", "text"] as const).map((t) => (
                      <button key={t} onClick={() => setClickType(t)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${clickType === t ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                        {t === "route" ? "📍 Tela" : t === "banner" ? "🖼️ Banner" : "📝 Texto"}
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

                {/* Target */}
                <div>
                  <label className={labelCls}>Destinatários</label>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setEditing({ ...editing, target_type: "all", target_ids: [] })}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${editing.target_type === "all" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                      <Users size={13} /> Todos
                    </button>
                    <button onClick={() => setEditing({ ...editing, target_type: "specific" })}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${editing.target_type === "specific" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                      <User size={13} /> Específico
                    </button>
                  </div>
                  {editing.target_type === "specific" && (
                    <div className="space-y-2">
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário..." className={inputCls} />
                      <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                        {filteredUsers.slice(0, 20).map((u) => (
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
                  )}
                </div>

                {/* Save + Send */}
                <div className="flex gap-2">
                  <button onClick={saveNotif} disabled={saving || !editing.title_template || !editing.body_template}
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
                  <input value={editingRule.title_template || ""} onChange={(e) => setEditingRule({ ...editingRule, title_template: e.target.value })} placeholder="Ex: ✅ Olá {nome}!" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Corpo da Notificação</label>
                  <textarea value={editingRule.body_template || ""} onChange={(e) => setEditingRule({ ...editingRule, body_template: e.target.value })} rows={3} placeholder="Ex: Sua mensalidade vence em {faltadias} dias..." className={`${inputCls} resize-none`} />
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
                  {ruleFilteredUsers.slice(0, 30).map((u) => (
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
