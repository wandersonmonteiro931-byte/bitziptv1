import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Bell, Send, Users, User, Loader2, Clock, CheckCircle, AlertTriangle, Megaphone, CreditCard, Tv, Gamepad2, Gift, Shield, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TEMPLATES = [
  { icon: "💳", label: "Fatura Paga", title: "Pagamento Confirmado ✅", body: "Sua fatura foi confirmada com sucesso! Obrigado pelo pagamento." },
  { icon: "⏳", label: "Aguardando Pagamento", title: "Fatura Pendente", body: "Você tem uma fatura aguardando pagamento. Acesse o app para efetuar o pagamento via PIX." },
  { icon: "📅", label: "Vencimento Próximo", title: "Vencimento Chegando ⚠️", body: "Sua mensalidade vence em breve. Renove agora para não perder o acesso!" },
  { icon: "🔒", label: "IPTV Bloqueado", title: "Acesso Bloqueado 🔒", body: "Seu acesso foi bloqueado por falta de pagamento. Regularize para voltar a assistir." },
  { icon: "🔧", label: "Manutenção", title: "Manutenção Programada 🔧", body: "Estamos realizando uma manutenção no sistema. O serviço será normalizado em breve." },
  { icon: "⚡", label: "Instabilidade", title: "Instabilidade Detectada ⚡", body: "Identificamos instabilidade no serviço. Nossa equipe já está trabalhando na resolução." },
  { icon: "✅", label: "Suporte Atualizou", title: "Atualização Realizada ✅", body: "O suporte realizou a atualização do seu plano. Sua nova data de vencimento já está disponível no app." },
  { icon: "🎮", label: "Novos Jogos", title: "Novos Desafios Disponíveis! 🎮", body: "Novos jogos e desafios foram liberados! Venha jogar e ganhar créditos." },
  { icon: "👥", label: "Indicação", title: "Indique e Ganhe! 👥", body: "Convide amigos para a Bitz IPTV e ganhe recompensas para cada indicação!" },
  { icon: "🎁", label: "Promoção", title: "Promoção Especial! 🎁", body: "Aproveite nossa promoção por tempo limitado. Não perca essa oportunidade!" },
  { icon: "📢", label: "Aviso Geral", title: "Aviso Importante 📢", body: "" },
  { icon: "🆕", label: "Nova Data", title: "Nova Data de Vencimento 📅", body: "Sua nova data de vencimento é: [DATA]. Acesse o app para mais detalhes." },
];

const AdminNotificationsPage = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "user">("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [subCount, setSubCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [usersRes, historyRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("id, name, username").order("name"),
      supabase.from("push_notifications").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("push_subscriptions").select("id", { count: "exact" }),
    ]);
    setUsers(usersRes.data || []);
    setHistory(historyRes.data || []);
    setSubCount(subsRes.count || 0);
  };

  const sendNotification = async () => {
    if (!title || !body) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-notification", {
        body: {
          action: "send",
          title,
          body,
          target_type: targetType,
          target_ids: targetType === "user" ? selectedUsers : [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: `✅ Notificação enviada!`,
        description: `${data.sent} enviado(s), ${data.failed} falha(s)`,
      });
      setTitle("");
      setBody("");
      setSelectedUsers([]);
      loadData();
    } catch (err: any) {
      toast({ title: "❌ Erro", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase())
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

      {/* Quick Templates */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">⚡ Templates Rápidos</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t, i) => (
            <button
              key={i}
              onClick={() => { setTitle(t.title); setBody(t.body); }}
              className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
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

        {/* Target */}
        <div>
          <label className={labelCls}>Destinatários</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setTargetType("all"); setSelectedUsers([]); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                targetType === "all" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Users size={13} /> Todos
            </button>
            <button
              onClick={() => setTargetType("user")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                targetType === "user" ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <User size={13} /> Específico
            </button>
          </div>
        </div>

        {/* User picker */}
        {targetType === "user" && (
          <div className="space-y-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuário..."
              className={inputCls}
            />
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
              {filteredUsers.slice(0, 20).map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                      else setSelectedUsers(selectedUsers.filter((id) => id !== u.id));
                    }}
                    className="h-3.5 w-3.5 rounded accent-primary"
                  />
                  <span className="text-xs text-foreground">{u.name}</span>
                  <span className="text-[10px] text-muted-foreground">@{u.username}</span>
                </label>
              ))}
            </div>
            {selectedUsers.length > 0 && (
              <p className="text-[10px] text-primary font-medium">{selectedUsers.length} selecionado(s)</p>
            )}
          </div>
        )}

        <button
          onClick={sendNotification}
          disabled={sending || !title || !body}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? "Enviando..." : "Enviar Notificação"}
        </button>
      </motion.div>

      {/* History */}
      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">📋 Histórico de Notificações</p>
        <div className="space-y-2">
          {history.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      ✅ {n.sent_count}
                    </span>
                    {n.failed_count > 0 && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        ❌ {n.failed_count}
                      </span>
                    )}
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
          {history.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">Nenhuma notificação enviada ainda</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminNotificationsPage;
