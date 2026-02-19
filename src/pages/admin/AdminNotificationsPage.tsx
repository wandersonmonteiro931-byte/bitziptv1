import { AppLayout } from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Send, Users, User, Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Settings2, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TRIGGER_EVENTS = [
  { value: "payment_received", label: "Pagamento Recebido", icon: "💰", description: "Quando o PIX é confirmado" },
  { value: "activation_confirmed", label: "Ativação Confirmada", icon: "✅", description: "Quando o admin ativa o plano" },
  { value: "expiry_approaching", label: "Vencimento Próximo", icon: "⚠️", description: "X dias antes do vencimento" },
  { value: "user_blocked", label: "Usuário Bloqueado", icon: "🔒", description: "Quando o acesso é bloqueado" },
  { value: "user_activated", label: "Usuário Ativado", icon: "🟢", description: "Quando o status muda para ativo" },
];

const TEMPLATE_VARS = [
  { var: "{nome}", desc: "Nome do cliente" },
  { var: "{validade}", desc: "Data de validade (dd/mm/aaaa)" },
  { var: "{valor}", desc: "Valor do pagamento" },
  { var: "{servidor}", desc: "Servidor IPTV" },
  { var: "{plano_meses}", desc: "Meses do plano" },
  { var: "{data_pagamento}", desc: "Data do pagamento" },
];

const QUICK_TEMPLATES = [
  { icon: "💳", label: "Fatura Paga", title: "Pagamento Confirmado ✅", body: "Sua fatura foi confirmada com sucesso! Obrigado pelo pagamento." },
  { icon: "⏳", label: "Aguardando", title: "Fatura Pendente", body: "Você tem uma fatura aguardando pagamento. Acesse o app para efetuar o pagamento via PIX." },
  { icon: "📅", label: "Vencimento", title: "Vencimento Chegando ⚠️", body: "Sua mensalidade vence em breve. Renove agora!" },
  { icon: "🔒", label: "Bloqueado", title: "Acesso Bloqueado 🔒", body: "Seu acesso foi bloqueado por falta de pagamento." },
  { icon: "🔧", label: "Manutenção", title: "Manutenção Programada 🔧", body: "Estamos realizando uma manutenção no sistema." },
  { icon: "⚡", label: "Instabilidade", title: "Instabilidade Detectada ⚡", body: "Identificamos instabilidade no serviço." },
  { icon: "🎮", label: "Jogos", title: "Novos Desafios! 🎮", body: "Novos jogos foram liberados! Venha jogar e ganhar." },
  { icon: "🎁", label: "Promoção", title: "Promoção Especial! 🎁", body: "Aproveite nossa promoção por tempo limitado!" },
  { icon: "📢", label: "Aviso", title: "Aviso Importante 📢", body: "" },
];

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
  const [activeTab, setActiveTab] = useState<"send" | "rules">("send");

  // Send tab state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "user">("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [subCount, setSubCount] = useState(0);

  // Rules tab state
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [editingRule, setEditingRule] = useState<Partial<NotificationRule> | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [usersRes, historyRes, subsRes, rulesRes] = await Promise.all([
      supabase.from("profiles").select("id, name, username").order("name"),
      supabase.from("push_notifications").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("push_subscriptions").select("id", { count: "exact" }),
      supabase.from("notification_rules").select("*").order("created_at", { ascending: true }),
    ]);
    setUsers(usersRes.data || []);
    setHistory(historyRes.data || []);
    setSubCount(subsRes.count || 0);
    setRules((rulesRes.data as any[]) || []);
  };

  const sendNotification = async () => {
    if (!title || !body) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-notification", {
        body: { action: "send", title, body, target_type: targetType, target_ids: targetType === "user" ? selectedUsers : [] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `✅ Notificação enviada!`, description: `${data.sent} enviado(s), ${data.failed} falha(s)` });
      setTitle(""); setBody(""); setSelectedUsers([]);
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally { setSending(false); }
  };

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

  const filteredUsers = users.filter(
    (u) => u.name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase())
  );

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
        <button onClick={() => setActiveTab("send")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "send" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <Send size={13} /> Enviar Manual
        </button>
        <button onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === "rules" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <Settings2 size={13} /> Regras Automáticas
        </button>
      </div>

      {activeTab === "send" && (
        <>
          {/* Quick Templates */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">⚡ Templates Rápidos</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => { setTitle(t.title); setBody(t.body); }}
                  className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compose */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-bold text-foreground">📝 Compor Notificação</p>
            <div>
              <label className={labelCls}>Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da notificação" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mensagem</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Corpo da notificação..." className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Destinatários</label>
              <div className="flex gap-2">
                <button onClick={() => { setTargetType("all"); setSelectedUsers([]); }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${targetType === "all" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                  <Users size={13} /> Todos
                </button>
                <button onClick={() => setTargetType("user")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${targetType === "user" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                  <User size={13} /> Específico
                </button>
              </div>
            </div>
            {targetType === "user" && (
              <div className="space-y-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário..." className={inputCls} />
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                  {filteredUsers.slice(0, 20).map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={selectedUsers.includes(u.id)}
                        onChange={(e) => e.target.checked ? setSelectedUsers([...selectedUsers, u.id]) : setSelectedUsers(selectedUsers.filter((id) => id !== u.id))}
                        className="h-3.5 w-3.5 rounded accent-primary" />
                      <span className="text-xs text-foreground">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground">@{u.username}</span>
                    </label>
                  ))}
                </div>
                {selectedUsers.length > 0 && <p className="text-[10px] text-primary font-medium">{selectedUsers.length} selecionado(s)</p>}
              </div>
            )}
            <button onClick={sendNotification} disabled={sending || !title || !body}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Enviando..." : "Enviar Notificação"}
            </button>
          </motion.div>

          {/* History */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Histórico</p>
            <div className="space-y-2">
              {history.map((n) => (
                <div key={n.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">✅ {n.sent_count}</span>
                        {n.failed_count > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">❌ {n.failed_count}</span>}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {n.target_type === "all" ? "Todos" : `${n.target_ids?.length || 0} usuário(s)`}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {new Date(n.created_at).toLocaleDateString("pt-BR")} {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
              {history.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Nenhuma notificação enviada ainda</p>}
            </div>
          </div>
        </>
      )}

      {activeTab === "rules" && (
        <>
          {/* Add Rule Button */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Regras que disparam notificações automáticas por evento
            </p>
            <button onClick={() => setEditingRule({ trigger_event: "payment_received", is_active: true, conditions: {}, click_url: "/" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors">
              <Plus size={13} /> Nova Regra
            </button>
          </div>

          {/* Variables Reference */}
          <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">📎 Variáveis Disponíveis</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS.map((v) => (
                <span key={v.var} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary" title={v.desc}>
                  {v.var}
                </span>
              ))}
            </div>
          </div>

          {/* Rules List */}
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
                          URL: {rule.click_url}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
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
                  </div>
                </motion.div>
              );
            })}
            {rules.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma regra configurada</div>
            )}
          </div>
        </>
      )}

      {/* Edit/Create Rule Modal */}
      <AnimatePresence>
        {editingRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setEditingRule(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                  <input value={editingRule.title_template || ""} onChange={(e) => setEditingRule({ ...editingRule, title_template: e.target.value })} placeholder="Ex: ✅ Servidor Atualizado!" className={inputCls} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Use variáveis: {"{nome}"}, {"{validade}"}, {"{valor}"}</p>
                </div>

                <div>
                  <label className={labelCls}>Corpo da Notificação</label>
                  <textarea value={editingRule.body_template || ""} onChange={(e) => setEditingRule({ ...editingRule, body_template: e.target.value })} rows={3} placeholder="Ex: Olá {nome}! Seu plano foi ativado..." className={`${inputCls} resize-none`} />
                </div>

                <div>
                  <label className={labelCls}>URL ao Clicar</label>
                  <input value={editingRule.click_url || "/"} onChange={(e) => setEditingRule({ ...editingRule, click_url: e.target.value })} placeholder="/" className={inputCls} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Ex: /iptv, /credits, /dashboard</p>
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
    </AppLayout>
  );
};

export default AdminNotificationsPage;
