import { AppLayout } from "@/components/AppLayout";
import { CalendarCheck, CheckCircle, Clock, Edit3, Gift, Loader2, Plus, Power, PowerOff, Save, Trash2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateBRT } from "@/lib/utils";

type ReferralStatus = "pending" | "converted" | "rewarded" | "rejected";

type ReferralUser = {
  id: string;
  name: string;
  username: string;
  referral_code?: string | null;
  referred_by?: string | null;
  iptv_user?: string | null;
  iptv_expiry?: string | null;
  status?: string | null;
};

type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: ReferralStatus | string;
  reward_months: number;
  reward_type?: string;
  first_payment_id?: string | null;
  converted_at?: string | null;
  rewarded_at?: string | null;
  reward_period_start?: string | null;
  reward_period_end?: string | null;
  reward_message?: string | null;
  notes?: string | null;
  created_at: string;
  referrer?: ReferralUser | null;
  referred?: ReferralUser | null;
};

type ReferralSettings = {
  id?: number;
  is_active: boolean;
  default_reward_months: number;
  updated_at?: string | null;
};

type ReferralForm = {
  id?: string;
  referrer_id: string;
  referred_id: string;
  status: ReferralStatus;
  reward_months: number;
  notes: string;
};

const emptyForm: ReferralForm = {
  referrer_id: "",
  referred_id: "",
  status: "pending",
  reward_months: 1,
  notes: "",
};

const normalizeStatus = (status: string): ReferralStatus => {
  if (status === "approved") return "rewarded";
  if (["pending", "converted", "rewarded", "rejected"].includes(status)) return status as ReferralStatus;
  return "pending";
};

const formatDateOnlyBR = (value?: string | null) => {
  if (!value) return "—";
  const parts = String(value).slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
};

const AdminReferralsPage = () => {
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [users, setUsers] = useState<ReferralUser[]>([]);
  const [settings, setSettings] = useState<ReferralSettings>({ is_active: true, default_reward_months: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReferralForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ReferralRow | null>(null);
  const [search, setSearch] = useState("");

  const invokeAdmin = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    const response = await supabase.functions.invoke("admin-manage-user", {
      body: { action, data },
    });

    if (response.error || response.data?.error) {
      throw new Error(response.data?.error || response.error?.message || "Operação não concluída.");
    }

    return response.data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await invokeAdmin("referral_list");
      setReferrals(Array.isArray(payload?.referrals) ? payload.referrals : []);
      setUsers(Array.isArray(payload?.users) ? payload.users : []);
      setSettings({
        is_active: payload?.settings?.is_active !== false,
        default_reward_months: Math.max(1, Number(payload?.settings?.default_reward_months || 1)),
        updated_at: payload?.settings?.updated_at || null,
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar indicações",
        description: error instanceof Error ? error.message : "Execute o SQL e publique as Edge Functions da versão.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin, toast]);

  useEffect(() => {
    void load();
    const onReferralCommand = () => void load();
    const onFinanceCommand = () => void load();
    window.addEventListener("wmcplayer-referrals-updated", onReferralCommand);
    window.addEventListener("wmcplayer-finance-updated", onFinanceCommand);
    return () => {
      window.removeEventListener("wmcplayer-referrals-updated", onReferralCommand);
      window.removeEventListener("wmcplayer-finance-updated", onFinanceCommand);
    };
  }, [load]);

  const metrics = useMemo(() => {
    const normalized = referrals.map((item) => normalizeStatus(item.status));
    return {
      total: referrals.length,
      pending: normalized.filter((status) => status === "pending").length,
      converted: normalized.filter((status) => status === "converted" || status === "rewarded").length,
      months: referrals
        .filter((item) => normalizeStatus(item.status) === "rewarded")
        .reduce((sum, item) => sum + Math.max(1, Number(item.reward_months || 1)), 0),
    };
  }, [referrals]);

  const filteredReferrals = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return referrals;
    return referrals.filter((item) => {
      const haystack = [
        item.referrer?.name,
        item.referrer?.username,
        item.referrer?.referral_code,
        item.referred?.name,
        item.referred?.username,
        item.referred?.iptv_user,
        item.status,
        item.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [referrals, search]);

  const openCreate = () => {
    setForm({ ...emptyForm, reward_months: settings.default_reward_months });
    setShowForm(true);
  };

  const openEdit = (referral: ReferralRow) => {
    setForm({
      id: referral.id,
      referrer_id: referral.referrer_id,
      referred_id: referral.referred_id,
      status: normalizeStatus(referral.status),
      reward_months: Math.max(1, Number(referral.reward_months || 1)),
      notes: referral.notes || "",
    });
    setShowForm(true);
  };

  const saveReferral = async () => {
    if (!form.referrer_id || !form.referred_id) {
      toast({ title: "Selecione indicador e indicado", variant: "destructive" });
      return;
    }
    if (form.referrer_id === form.referred_id) {
      toast({ title: "Autoindicação bloqueada", description: "O cliente não pode indicar a si mesmo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await invokeAdmin(form.id ? "referral_update" : "referral_create", {
        ...form,
        reward_months: Math.max(1, Number(form.reward_months || 1)),
      });
      toast({ title: form.id ? "Indicação atualizada" : "Indicação adicionada" });
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast({
        title: "Erro ao salvar indicação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteReferral = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await invokeAdmin("referral_delete", { id: deleteTarget.id });
      toast({ title: "Indicação excluída" });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast({
        title: "Erro ao excluir indicação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePromotion = async () => {
    setSaving(true);
    try {
      const payload = await invokeAdmin("referral_set_promotion", {
        is_active: !settings.is_active,
        default_reward_months: settings.default_reward_months,
      });
      setSettings({
        is_active: payload?.settings?.is_active !== false,
        default_reward_months: Math.max(1, Number(payload?.settings?.default_reward_months || 1)),
        updated_at: payload?.settings?.updated_at || null,
      });
      toast({
        title: settings.is_active ? "Promoção encerrada" : "Promoção ativada",
        description: settings.is_active
          ? "Novos códigos deixam de valer e os clientes verão “Promoção encerrada.”"
          : "Os códigos de indicação voltaram a ser aceitos.",
      });
    } catch (error) {
      toast({
        title: "Erro ao alterar promoção",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const availableReferredUsers = useMemo(() => {
    const occupied = new Set(referrals.filter((item) => item.id !== form.id).map((item) => item.referred_id));
    return users.filter((user) => !occupied.has(user.id));
  }, [users, referrals, form.id]);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Gift className="text-red-500" /> Gerenciar Indicações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle completo dos vínculos, conversões, recompensas e da promoção de 1 mês grátis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={togglePromotion}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
              settings.is_active
                ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {settings.is_active ? <PowerOff size={16} /> : <Power size={16} />}
            {settings.is_active ? "Encerrar promoção" : "Ativar promoção"}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            <Plus size={16} /> Adicionar indicação
          </button>
        </div>
      </div>

      <div className={`mb-6 rounded-2xl border p-4 ${settings.is_active ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
        <div className="flex items-center gap-3">
          {settings.is_active ? <CheckCircle className="text-emerald-400" /> : <XCircle className="text-amber-400" />}
          <div>
            <p className={`font-semibold ${settings.is_active ? "text-emerald-300" : "text-amber-300"}`}>
              {settings.is_active ? "Promoção ativa" : "Promoção encerrada."}
            </p>
            <p className="text-xs text-muted-foreground">
              {settings.is_active
                ? "Novos códigos são aceitos. Cada primeiro pagamento concede 1 mês grátis ao indicador."
                : "Novos códigos não são aceitos. O histórico e as indicações já registradas continuam visíveis."}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
          <p className="text-xs text-muted-foreground">Indicações</p>
        </div>
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-400">{metrics.pending}</p>
          <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
        </div>
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-400">{metrics.converted}</p>
          <p className="text-xs text-muted-foreground">Convertidas</p>
        </div>
        <div className="stat-card rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{metrics.months}</p>
          <p className="text-xs text-muted-foreground">Meses grátis liberados</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">TODAS AS INDICAÇÕES</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar indicador, indicado ou código..."
            className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground outline-none focus:border-red-500 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" /> Carregando indicações...
          </div>
        ) : filteredReferrals.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma indicação encontrada.</p>
        ) : (
          <div className="space-y-3">
            {filteredReferrals.map((referral) => {
              const status = normalizeStatus(referral.status);
              const rewarded = status === "rewarded";
              const converted = status === "converted";
              const rejected = status === "rejected";
              return (
                <div key={referral.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      {rewarded ? (
                        <CalendarCheck size={20} className="mt-0.5 text-emerald-400" />
                      ) : rejected ? (
                        <XCircle size={20} className="mt-0.5 text-destructive" />
                      ) : (
                        <Clock size={20} className={`mt-0.5 ${converted ? "text-blue-400" : "text-amber-400"}`} />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {referral.referrer?.name || referral.referrer?.username || "Indicador"}
                          <span className="mx-2 text-muted-foreground">→</span>
                          {referral.referred?.name || referral.referred?.username || "Indicado"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Código: {referral.referrer?.referral_code || "—"} · Criada em {formatDateBRT(referral.created_at)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Usuário do indicado: {referral.referred?.iptv_user || referral.referred?.username || "—"}
                        </p>
                        {referral.first_payment_id && (
                          <p className="mt-1 text-[11px] text-blue-300">Pagamento gerador: {referral.first_payment_id}</p>
                        )}
                        {rewarded && (
                          <p className="mt-1 text-[11px] text-emerald-300">
                            Período grátis: {formatDateOnlyBR(referral.reward_period_start)} a {formatDateOnlyBR(referral.reward_period_end)}
                          </p>
                        )}
                        {referral.notes && <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">{referral.notes}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          rewarded
                            ? "bg-emerald-500/10 text-emerald-400"
                            : converted
                              ? "bg-blue-500/10 text-blue-400"
                              : rejected
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {rewarded
                          ? `Premiada: ${referral.reward_months || 1} mês(es)`
                          : converted
                            ? "Convertida"
                            : rejected
                              ? "Recusada"
                              : "Pendente"}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(referral)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30"
                      >
                        <Edit3 size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(referral)}
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                      >
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{form.id ? "Editar indicação" : "Adicionar indicação"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Indicador</label>
                <select
                  value={form.referrer_id}
                  onChange={(event) => setForm({ ...form, referrer_id: event.target.value })}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-foreground outline-none focus:border-red-500"
                >
                  <option value="">Selecione quem indicou</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.username} · {user.referral_code || "sem código"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Indicado</label>
                <select
                  value={form.referred_id}
                  onChange={(event) => setForm({ ...form, referred_id: event.target.value })}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-foreground outline-none focus:border-red-500"
                >
                  <option value="">Selecione o cliente indicado</option>
                  {availableReferredUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.username} · @{user.username}
                    </option>
                  ))}
                </select>
                {form.referrer_id && form.referred_id && form.referrer_id === form.referred_id && (
                  <p className="mt-1 text-xs font-semibold text-destructive">Autoindicação não é permitida.</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value as ReferralStatus })}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-foreground outline-none focus:border-red-500"
                  >
                    <option value="pending">Pendente</option>
                    <option value="converted">Convertida</option>
                    <option value="rewarded">Premiada</option>
                    <option value="rejected">Recusada</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Quantidade de meses</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.reward_months}
                    onChange={(event) => setForm({ ...form, reward_months: Math.max(1, Number(event.target.value || 1)) })}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-foreground outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Informações administrativas sobre esta indicação..."
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-foreground outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveReferral}
                disabled={saving || !form.referrer_id || !form.referred_id || form.referrer_id === form.referred_id}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar indicação
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-background p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Excluir indicação?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O vínculo entre <strong className="text-foreground">{deleteTarget.referrer?.name || "indicador"}</strong> e{" "}
              <strong className="text-foreground">{deleteTarget.referred?.name || "indicado"}</strong> será removido. O campo
              <code className="mx-1 rounded bg-muted px-1">profiles.referred_by</code> será sincronizado automaticamente.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground">
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteReferral}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default AdminReferralsPage;
