import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const brDateOnly = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value || "01";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const year = parts.find((part) => part.type === "year")?.value || String(date.getFullYear());

  return `${year}-${month}-${day}`;
};

const roundMoney = (v: number) => Math.round(v * 100) / 100;

const addDaysToDateOnly = (dateOnly: string, days: number) => {
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  const base = new Date(year, (month || 1) - 1, day || 1);
  base.setDate(base.getDate() + Number(days || 0));
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addMonthsToDateOnlyByFixedDay = (dateOnly: string, months: number, fixedDay?: number) => {
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  const safeMonths = Math.max(1, Number(months || 1));
  const dueDay = Math.max(1, Math.min(31, Number(fixedDay || day || 1)));
  const targetMonthIndex = (month || 1) - 1 + safeMonths;
  const targetYear = (year || new Date().getFullYear()) + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(dueDay, lastDay);
  return `${targetYear}-${String(normalizedMonthIndex + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
};

const isDateOnly = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const normalizeStatus = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const DISABLED_ACCOUNT_STATUSES = new Set([
  "disabled", "inactive", "deactivated", "desativado", "suspended", "suspenso",
  "archived", "arquivado", "deleted", "removed", "excluded", "excluido",
  "blocked", "bloqueado", "pending", "pendente",
]);

const REACTIVATABLE_ACCOUNT_STATUSES = new Set([
  "disabled", "inactive", "deactivated", "desativado", "suspended", "suspenso",
]);

const isAccessDisabled = (profile: any) =>
  DISABLED_ACCOUNT_STATUSES.has(normalizeStatus(profile?.status)) ||
  ["disabled", "inactive", "deactivated", "desativado"].includes(normalizeStatus(profile?.iptv_status));

const TV_STATUS_ALIASES: Record<string, string> = {
  inactive: "disabled",
  deactivated: "disabled",
  desativado: "disabled",
};

const ALLOWED_TV_STATUSES = new Set([
  "active", "blocked", "disabled", "awaiting_activation", "awaiting_payment",
  "maintenance", "unstable", "trust_active",
]);

const CLIENT_TV_INFO_ACTION = "client_tv_info_config";
const CLIENT_TV_INFO_TARGET = "client_tv_info";

const cleanTvInfoText = (value: unknown, maxLength = 5000) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const normalizeClientTvInfoData = (input: any = {}) => ({
  tv_username: cleanTvInfoText(input.tv_username, 300),
  tv_password: cleanTvInfoText(input.tv_password, 300),
  tv_code: cleanTvInfoText(input.tv_code, 500),
  tv_dns: cleanTvInfoText(input.tv_dns, 1200),
  tv_list_url: cleanTvInfoText(input.tv_list_url, 5000),
  tv_app_name: cleanTvInfoText(input.tv_app_name, 300),
  tv_app_logo_url: cleanTvInfoText(input.tv_app_logo_url, 5000),
  next_expiry: isDateOnly(input.next_expiry) ? String(input.next_expiry) : "",
  support_name: cleanTvInfoText(input.support_name, 300),
  support_whatsapp: cleanTvInfoText(input.support_whatsapp, 100),
  client_since: isDateOnly(input.client_since) ? String(input.client_since) : "",
  tutorial_image_url: cleanTvInfoText(input.tutorial_image_url, 5000),
  tutorial_youtube_url: cleanTvInfoText(input.tutorial_youtube_url, 5000),
});

const loadClientTvInfo = async (supabaseAdmin: any, userId: string) => {
  const { data: row, error } = await supabaseAdmin
    .from("admin_audit_logs")
    .select("id, details, created_at")
    .eq("target_id", userId)
    .eq("target_table", CLIENT_TV_INFO_TARGET)
    .eq("action", CLIENT_TV_INFO_ACTION)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { row, info: normalizeClientTvInfoData(row?.details || {}) };
};

const sendRealtimeBroadcast = async (_supabaseAdmin: any, channelName: string, eventName: string, payload: Record<string, any>) => {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Secrets do Supabase não configurados para Realtime REST.");
  }

  const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast/${encodeURIComponent(channelName)}/events/${encodeURIComponent(eventName)}`;
  const realtimeHeaders: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
  };
  if (serviceKey.split(".").length === 3) {
    realtimeHeaders.Authorization = `Bearer ${serviceKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: realtimeHeaders,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Realtime REST ${response.status}: ${await response.text()}`);
  }
};

const sendRealtimeBatch = async (messages: Array<{ topic: string; event: string; payload: Record<string, any> }>) => {
  if (!messages.length) return;

  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!supabaseUrl || !serviceKey) throw new Error("Secrets do Supabase não configurados para Realtime REST.");

  for (let index = 0; index < messages.length; index += 100) {
    const batch = messages.slice(index, index + 100);
    const realtimeHeaders: Record<string, string> = {
      apikey: serviceKey,
      "Content-Type": "application/json",
    };
    if (serviceKey.split(".").length === 3) {
      realtimeHeaders.Authorization = `Bearer ${serviceKey}`;
    }

    const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: realtimeHeaders,
      body: JSON.stringify({ messages: batch }),
    });

    if (!response.ok) {
      throw new Error(`Realtime REST batch ${response.status}: ${await response.text()}`);
    }
  }
};

const emitClientProfileUpdated = async (supabaseAdmin: any, userId: string, profilePatch: Record<string, any>) => {
  try {
    await sendRealtimeBroadcast(supabaseAdmin, `wmcplayer-client-${userId}`, "client-profile-updated", {
      user_id: userId,
      sentAt: Date.now(),
      profile: profilePatch,
    });
  } catch (err) {
    console.warn("Falha ao enviar atualização de perfil:", err instanceof Error ? err.message : String(err));
  }
};

const emitFinanceUpdated = async (supabaseAdmin: any, userId: string, payload: Record<string, any> = {}) => {
  const eventPayload = {
    user_id: userId,
    sentAt: Date.now(),
    ...payload,
  };

  const commands = [
    sendRealtimeBroadcast(supabaseAdmin, `wmcplayer-client-${userId}`, "finance-updated", eventPayload),
    sendRealtimeBroadcast(supabaseAdmin, "wmcplayer-admin", "finance-updated", eventPayload),
  ];

  if (payload.profile_patch) {
    commands.push(
      sendRealtimeBroadcast(supabaseAdmin, `wmcplayer-client-${userId}`, "client-profile-updated", {
        user_id: userId,
        sentAt: eventPayload.sentAt,
        profile: payload.profile_patch,
        action: payload.action,
      }),
    );
  }

  try {
    await Promise.all(commands);
  } catch (err) {
    console.warn("Falha ao enviar atualização financeira instantânea:", err instanceof Error ? err.message : String(err));
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!;

    const supabaseAuth = createClient(supabaseUrl, (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, user_id, data } = body;

    // request_withdrawal does NOT require admin role — it's called by the user
    if (action === "request_withdrawal") {
      if (!user_id || user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { amount, pix_key } = data || {};
      if (!amount || !pix_key) throw new Error("amount e pix_key são obrigatórios");

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("balance, balance_frozen, status, iptv_status")
        .eq("id", user_id)
        .single();
      if (!profile) throw new Error("Usuário não encontrado");
      if (isAccessDisabled(profile)) throw new Error("Usuário desativado.");
      if (profile.balance_frozen) throw new Error("Saldo congelado. Saques bloqueados.");
      if (Number(profile.balance) < Number(amount)) throw new Error("Saldo insuficiente");
      if (Number(amount) < 30) throw new Error("Valor mínimo de R$ 30,00");

      await supabaseAdmin
        .from("profiles")
        .update({
          balance: roundMoney(Number(profile.balance) - Number(amount)),
        })
        .eq("id", user_id);

      await supabaseAdmin.from("withdrawals").insert({
        user_id,
        amount: Number(amount),
        pix_key,
        status: "pending",
      });

      await supabaseAdmin.from("balance_history").insert({
        user_id,
        type: "withdrawal",
        amount: Math.abs(Number(amount)),
        description: `Saque solicitado - PIX: ${pix_key} (em análise)`,
      });

      await emitFinanceUpdated(supabaseAdmin, user_id, {
        action: "request_withdrawal",
        source: "withdrawals",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // client_check_trial_status — called by the logged client.
    // Automatically blocks expired trial users and sends the final warning push once.
    if (action === "client_check_trial_status") {
      if (!user_id || user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const today = brDateOnly(new Date());

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, trial_enabled, trial_ends_at, trial_expired_at, trial_expired_notice_sent_at, trial_payment_confirmed, iptv_status, iptv_expiry")
        .eq("id", user_id)
        .maybeSingle();

      const expired =
        Boolean(profile?.trial_enabled) &&
        !profile?.trial_payment_confirmed &&
        Boolean(profile?.trial_ends_at) &&
        String(profile?.trial_ends_at) < today;

      if (!expired) {
        if (profile?.trial_enabled && !profile?.trial_payment_confirmed && profile?.trial_ends_at) {
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_status: "active",
              iptv_expiry: String(profile.trial_ends_at),
              iptv_due_day: Math.max(1, Math.min(31, Number(String(profile.trial_ends_at).split("-")[2] || 10))),
              billing_due_date_id: null,
              trial_expired_at: null,
            })
            .eq("id", user_id);

          await emitClientProfileUpdated(supabaseAdmin, user_id, {
            iptv_status: "active",
            iptv_expiry: String(profile.trial_ends_at),
            trial_ends_at: profile.trial_ends_at,
            trial_expired_at: null,
          });
        }

        return new Response(JSON.stringify({ success: true, expired: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updatePayload: Record<string, any> = {
        iptv_status: "blocked",
        trial_expired_at: profile?.trial_expired_at || new Date().toISOString(),
      };

      if (!profile?.trial_expired_notice_sent_at) {
        updatePayload.trial_expired_notice_sent_at = new Date().toISOString();
      }

      await supabaseAdmin.from("profiles").update(updatePayload).eq("id", user_id);

      // Notificação automática ao cliente quando o teste termina.
      // Se Push estiver configurado, envia. Mesmo sem push, o app mostra o aviso sempre que entrar.
      if (!profile?.trial_expired_notice_sent_at) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id,
              title: "TESTE FINALIZADO",
              body: `Olá ${profile?.name || ""}! Seu período de teste terminou. Realize o pagamento do seu plano e continue aproveitando o melhor da TV!`,
              url: "/dashboard#gerar-pix",
            }),
          });
        } catch (pushErr) {
          console.error("Falha ao enviar push de teste finalizado:", pushErr);
        }
      }

      await emitClientProfileUpdated(supabaseAdmin, user_id, {
        iptv_status: "blocked",
        trial_expired_at: updatePayload.trial_expired_at,
        trial_expired_notice_sent_at: updatePayload.trial_expired_notice_sent_at,
      });

      return new Response(JSON.stringify({ success: true, expired: true, blocked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // request_trust_unlock — called by the user (no admin role needed)
    if (action === "request_trust_unlock") {
      if (!user_id || user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check 30-day cooldown
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recentTrust } = await supabaseAdmin
        .from("iptv_trust_requests")
        .select("id")
        .eq("user_id", user_id)
        .in("status", ["approved", "expired"])
        .gte("requested_at", thirtyDaysAgo.toISOString())
        .limit(1)
        .maybeSingle();
      if (recentTrust) {
        return new Response(
          JSON.stringify({ error: "Você já utilizou o desbloqueio de confiança nos últimos 30 dias." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Check if there's already a pending request
      const { data: pendingReq } = await supabaseAdmin
        .from("iptv_trust_requests")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      if (pendingReq) {
        return new Response(JSON.stringify({ error: "Já existe uma solicitação pendente." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create trust request and validate the insert.
      const { data: createdTrustRequest, error: createTrustError } = await supabaseAdmin
        .from("iptv_trust_requests")
        .insert({
          user_id,
          status: "pending",
          requested_at: new Date().toISOString(),
        })
        .select("id, user_id, status, requested_at")
        .single();

      if (createTrustError || !createdTrustRequest?.id) {
        console.error("Erro ao criar solicitação de confiança:", createTrustError);
        return new Response(JSON.stringify({ error: createTrustError?.message || "Não foi possível criar solicitação de confiança." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ordem instantânea para o único canal administrativo compartilhado.
      try {
        await sendRealtimeBroadcast(supabaseAdmin, "wmcplayer-admin", "trust-request-created", {
          request_id: createdTrustRequest.id,
          user_id,
          status: "pending",
          requested_at: createdTrustRequest.requested_at,
        });
      } catch (realtimeErr) {
        console.error("Falha ao avisar admin sobre confiança:", realtimeErr);
      }

      // Notify admins via push
      try {
        const { data: userProfile } = await supabaseAdmin.from("profiles").select("name").eq("id", user_id).single();
        const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
        for (const admin of adminRoles || []) {
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id: admin.user_id,
              title: "🤝 Solicitação de Confiança",
              body: `${userProfile?.name || "Cliente"} solicitou desbloqueio de confiança.`,
              url: "/admin/iptv",
            }),
          });
        }
      } catch (pushErr) {
        console.error("Failed to send trust request push:", pushErr);
      }

      return new Response(JSON.stringify({ success: true, request_id: createdTrustRequest.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consulta exclusiva da tela Minha TV. O cliente só pode ler o próprio registro.
    // Estes dados são informativos e nunca alteram profiles, Auth, pagamento ou serviço.
    if (action === "client_get_tv_info") {
      if (!user_id || user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { info } = await loadClientTvInfo(supabaseAdmin, user_id);
      return new Response(JSON.stringify({ success: true, info }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_pending_admin_requests") {
      const [{ data: trustRows, error: trustError }, { data: pendingPaymentRows, error: paymentError }] = await Promise.all([
        supabaseAdmin
          .from("iptv_trust_requests")
          .select("*")
          .eq("status", "pending")
          .order("requested_at", { ascending: true }),
        supabaseAdmin
          .from("iptv_payments")
          .select("*")
          .eq("status", "paid_pending_activation")
          .order("payment_date", { ascending: false }),
      ]);

      if (trustError || paymentError) {
        return new Response(JSON.stringify({ error: trustError?.message || paymentError?.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = Array.from(
        new Set(
          [...((trustRows || []) as any[]), ...((pendingPaymentRows || []) as any[])]
            .map((item) => item.user_id)
            .filter(Boolean),
        ),
      );

      const { data: profiles } = userIds.length
        ? await supabaseAdmin
            .from("profiles")
            .select("id, name, username, iptv_user, role, status, iptv_server, iptv_connections, iptv_expiry, iptv_due_day, iptv_status")
            .in("id", userIds)
        : { data: [] as any[] };

      const profilesById = new Map(((profiles || []) as any[]).map((profile) => [profile.id, profile]));

      // Calcula a data prevista correta para exibição no admin sem depender
      // de um period_end antigo gravado por versões anteriores.
      const paymentGroups = new Map<string, any[]>();
      for (const payment of (pendingPaymentRows || []) as any[]) {
        const list = paymentGroups.get(payment.user_id) || [];
        list.push(payment);
        paymentGroups.set(payment.user_id, list);
      }

      const normalizedPending: any[] = [];
      for (const [pendingUserId, payments] of paymentGroups.entries()) {
        const profile: any = profilesById.get(pendingUserId);
        const ordered = [...payments].sort((a, b) =>
          String(a.payment_date || a.created_at || "").localeCompare(String(b.payment_date || b.created_at || "")),
        );

        let cycleStart = isDateOnly(profile?.iptv_expiry)
          ? String(profile.iptv_expiry)
          : isDateOnly(ordered[0]?.period_start)
            ? String(ordered[0].period_start)
            : brDateOnly(new Date());

        const fixedDueDay = Math.max(
          1,
          Math.min(31, Number(profile?.iptv_due_day || cycleStart.split("-")[2] || 10)),
        );

        for (const payment of ordered) {
          const periodEnd = addMonthsToDateOnlyByFixedDay(
            cycleStart,
            Math.max(1, Number(payment.months || 1)),
            fixedDueDay,
          );
          normalizedPending.push({
            ...payment,
            period_start: cycleStart,
            period_end: periodEnd,
            profiles: profile || null,
          });
          cycleStart = periodEnd;
        }
      }

      normalizedPending.sort((a, b) =>
        String(b.payment_date || b.created_at || "").localeCompare(String(a.payment_date || a.created_at || "")),
      );

      return new Response(
        JSON.stringify({
          success: true,
          trust_requests: ((trustRows || []) as any[]).map((item) => ({
            ...item,
            profiles: profilesById.get(item.user_id) || null,
          })),
          pending_activations: normalizedPending,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "broadcast_client_event") {
      const eventName = String(data?.event || "").trim();
      if (!eventName) {
        return new Response(JSON.stringify({ error: "event é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let targetIds: string[] = Array.isArray(data?.target_ids)
        ? data.target_ids.map((id: unknown) => String(id)).filter(Boolean)
        : [];

      if (targetIds.length === 0) {
        const { data: clientRoles, error: roleError } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "client");
        if (roleError) throw new Error(roleError.message);
        targetIds = ((clientRoles || []) as any[]).map((row) => String(row.user_id)).filter(Boolean);
      }

      const sentAt = Date.now();
      const commandPayload = { sentAt, ...(data?.payload || {}) };
      const messages: Array<{ topic: string; event: string; payload: Record<string, any> }> = targetIds.map((id) => ({
        topic: `wmcplayer-client-${id}`,
        event: eventName,
        payload: { user_id: id, ...commandPayload },
      }));
      messages.push({
        topic: "wmcplayer-admin",
        event: eventName,
        payload: commandPayload,
      });

      await sendRealtimeBatch(messages);

      return new Response(JSON.stringify({ success: true, sent: targetIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (action) {
      case "get_client_tv_info": {
        const { info } = await loadClientTvInfo(supabaseAdmin, user_id);
        result = { success: true, info };
        break;
      }
      case "update_client_tv_info": {
        const info = normalizeClientTvInfoData(data || {});
        const { row } = await loadClientTvInfo(supabaseAdmin, user_id);
        const nowIso = new Date().toISOString();

        if (row?.id) {
          const { error: updateInfoError } = await supabaseAdmin
            .from("admin_audit_logs")
            .update({
              admin_id: caller.id,
              details: info,
              created_at: nowIso,
            })
            .eq("id", row.id);
          if (updateInfoError) throw new Error(updateInfoError.message);
        } else {
          const { error: insertInfoError } = await supabaseAdmin.from("admin_audit_logs").insert({
            admin_id: caller.id,
            action: CLIENT_TV_INFO_ACTION,
            target_id: user_id,
            target_table: CLIENT_TV_INFO_TARGET,
            details: info,
            created_at: nowIso,
          });
          if (insertInfoError) throw new Error(insertInfoError.message);
        }

        try {
          await sendRealtimeBroadcast(supabaseAdmin, `wmcplayer-client-${user_id}`, "client-tv-info-updated", {
            user_id,
            sentAt: Date.now(),
            info,
          });
        } catch (broadcastError) {
          console.warn(
            "Dados informativos salvos, mas não foi possível avisar o cliente em tempo real:",
            broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
          );
        }

        result = { success: true, info };
        break;
      }
      case "update_profile": {
        // Fetch current profile to detect actual status changes
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles")
          .select("status, iptv_status, iptv_user, username, iptv_expiry, iptv_due_day")
          .eq("id", user_id)
          .single();
        const previousStatus = currentProfile?.iptv_status;

        const updateData = { ...(data || {}) };

        if (updateData.iptv_status !== undefined) {
          const normalizedStatus = normalizeStatus(updateData.iptv_status);
          updateData.iptv_status = TV_STATUS_ALIASES[normalizedStatus] || normalizedStatus;
          if (!ALLOWED_TV_STATUSES.has(updateData.iptv_status)) {
            throw new Error(`Status inválido: ${String(data?.iptv_status || "")}`);
          }

          // Desativado é bloqueio de conta. Bloqueado continua podendo entrar para pagar.
          if (updateData.iptv_status === "disabled") {
            updateData.status = "suspended";
          } else if (updateData.iptv_status === "active" && REACTIVATABLE_ACCOUNT_STATUSES.has(normalizeStatus(currentProfile?.status))) {
            updateData.status = "active";
          }
        }

        // Ao ativar um PIX já recebido, a renovação parte do vencimento que já estava previsto.
        // Exemplo: venceu 09/07, admin confirmou 10/07 => próximo vencimento 09/08.
        // Nunca parte do dia em que o admin confirmou.
        let pendingActivationPayments: any[] = [];
        let activationFinalExpiry = "";
        if (updateData.iptv_status === "active" && updateData.trial_enabled !== true) {
          const { data: rows, error: pendingError } = await supabaseAdmin
            .from("iptv_payments")
            .select("id, months, period_start, period_end, created_at")
            .eq("user_id", user_id)
            .eq("status", "paid_pending_activation")
            .order("created_at", { ascending: true });

          if (pendingError) throw new Error(pendingError.message);
          pendingActivationPayments = Array.isArray(rows) ? rows : [];

          if (pendingActivationPayments.length > 0) {
            const originalScheduledExpiry = isDateOnly(currentProfile?.iptv_expiry)
              ? String(currentProfile.iptv_expiry)
              : isDateOnly(pendingActivationPayments[0]?.period_start)
                ? String(pendingActivationPayments[0].period_start)
                : brDateOnly(new Date());

            const fixedDueDay = Math.max(
              1,
              Math.min(31, Number(String(originalScheduledExpiry).split("-")[2] || currentProfile?.iptv_due_day || 10)),
            );

            let cycleStart = originalScheduledExpiry;
            for (const pendingPayment of pendingActivationPayments) {
              const paymentMonths = Math.max(1, Number(pendingPayment.months || 1));
              const correctedPeriodEnd = addMonthsToDateOnlyByFixedDay(cycleStart, paymentMonths, fixedDueDay);

              const { error: paymentDateError } = await supabaseAdmin
                .from("iptv_payments")
                .update({ period_start: cycleStart, period_end: correctedPeriodEnd })
                .eq("id", pendingPayment.id);
              if (paymentDateError) throw new Error(paymentDateError.message);

              pendingPayment.period_start = cycleStart;
              pendingPayment.period_end = correctedPeriodEnd;
              cycleStart = correctedPeriodEnd;
            }

            activationFinalExpiry = cycleStart;
            updateData.iptv_expiry = activationFinalExpiry;
            updateData.iptv_due_day = fixedDueDay;
          }
        }

        if (updateData.billing_due_date_id === "") {
          updateData.billing_due_date_id = null;
        }

        if (updateData.trial_enabled !== undefined) {
          updateData.trial_enabled = Boolean(updateData.trial_enabled);
          if (updateData.trial_enabled) {
            const duration = Math.max(1, Math.min(365, Number(updateData.trial_duration_days || 1)));
            updateData.trial_duration_days = duration;
            updateData.trial_started_at = updateData.trial_started_at || brDateOnly(new Date());
            updateData.trial_ends_at = isDateOnly(updateData.trial_ends_at)
              ? String(updateData.trial_ends_at)
              : addDaysToDateOnly(updateData.trial_started_at, duration);

            const trialEndDate = String(updateData.trial_ends_at);
            const trialFinished = trialEndDate < brDateOnly(new Date());

            // Quando o admin coloca como teste, a validade antiga é ignorada.
            // A data final do teste passa a mandar em todo o app.
            updateData.iptv_expiry = trialEndDate;
            updateData.iptv_due_day = Math.max(1, Math.min(31, Number(trialEndDate.split("-")[2] || 10)));
            updateData.billing_due_date_id = null;
            updateData.trial_payment_confirmed = false;
            updateData.iptv_status = trialFinished ? "blocked" : "active";
            updateData.trial_expired_at = trialFinished ? (updateData.trial_expired_at || new Date().toISOString()) : null;
            updateData.trial_expired_notice_sent_at = trialFinished ? updateData.trial_expired_notice_sent_at : null;
          } else {
            updateData.trial_duration_days = null;
            updateData.trial_started_at = null;
            updateData.trial_ends_at = null;
            updateData.trial_expired_at = null;
            updateData.trial_expired_notice_sent_at = null;
            updateData.trial_payment_confirmed = false;
          }
        }

        // REGRA FIXA: username/login sempre igual ao Usuário TV.
        if (typeof updateData.iptv_user === "string" && updateData.iptv_user.trim()) {
          const loginIdentifier = updateData.iptv_user.trim();
          updateData.username = loginIdentifier;

          const previousLogin = String(currentProfile?.iptv_user || currentProfile?.username || "").trim();
          if (loginIdentifier !== previousLogin) {
            const loginEmail = loginIdentifier.includes("@") ? loginIdentifier : `${loginIdentifier}@iptv.bitz`;
            const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
              email: loginEmail,
              email_confirm: true,
            } as any);

            if (authEmailError) {
              throw new Error(`Erro ao atualizar login do cliente: ${authEmailError.message}`);
            }
          }
        }

        const normalizeDateOnly = (value: any) => {
          const text = String(value || "").trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
          return text;
        };

        const getDayFromDateOnly = (value: string) => {
          const day = Number(String(value).split("-")[2] || 0);
          return Math.max(1, Math.min(31, day || 10));
        };

        const makeDueDate = (from: Date, dueDay: number) => {
          const y = from.getFullYear();
          const m = from.getMonth();
          const lastDay = new Date(y, m + 1, 0).getDate();
          let due = new Date(y, m, Math.min(dueDay, lastDay));

          if (due < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
            const next = new Date(y, m + 1, 1);
            const nextLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
            due = new Date(next.getFullYear(), next.getMonth(), Math.min(dueDay, nextLastDay));
          }

          return due.toISOString().split("T")[0];
        };

        const explicitExpiry = normalizeDateOnly(updateData.iptv_expiry);

        // REGRA PRINCIPAL:
        // Se o admin digitou uma data exata, ela manda em todo o sistema.
        // Isso vale usando "padrão" ou uma data fixa selecionada.
        if (explicitExpiry) {
          updateData.iptv_expiry = explicitExpiry;
          updateData.iptv_due_day = getDayFromDateOnly(explicitExpiry);
        } else if (updateData.billing_due_date_id) {
          const { data: selectedDue } = await supabaseAdmin
            .from("billing_due_dates")
            .select("id, day_of_month")
            .eq("id", updateData.billing_due_date_id)
            .maybeSingle();

          if (selectedDue) {
            const day = Number(selectedDue.day_of_month);
            updateData.iptv_due_day = day;

            const now = new Date(`${brDateOnly(new Date())}T00:00:00`);
            const { data: profileBillingBase } = await supabaseAdmin
              .from("profiles")
              .select("iptv_expiry, billing_cycle_started_at, created_at")
              .eq("id", user_id)
              .maybeSingle();

            const baseDate = profileBillingBase?.iptv_expiry
              ? new Date(`${profileBillingBase.iptv_expiry}T00:00:00`)
              : profileBillingBase?.billing_cycle_started_at
                ? new Date(`${profileBillingBase.billing_cycle_started_at}T00:00:00`)
                : profileBillingBase?.created_at
                  ? new Date(profileBillingBase.created_at)
                  : now;

            updateData.iptv_expiry = makeDueDate(baseDate, day);
          }
        } else if (updateData.billing_due_date_id === "" || updateData.billing_due_date_id === undefined) {
          updateData.billing_due_date_id = null;
          if (updateData.iptv_due_day) {
            updateData.iptv_expiry = makeDueDate(new Date(`${brDateOnly(new Date())}T00:00:00`), Number(updateData.iptv_due_day));
          }
        }

        // REGRA FIXA: senha de login sempre igual à Senha TV.
        if (typeof updateData.iptv_password === "string" && updateData.iptv_password.trim()) {
          const { error: authPwdError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            password: updateData.iptv_password.trim(),
          });
          if (authPwdError) {
            throw new Error(`Erro ao atualizar senha do cliente: ${authPwdError.message}`);
          }
        }

        if (updateData.iptv_expiry) {
          updateData.billing_cycle_started_at = updateData.billing_cycle_started_at || brDateOnly(new Date());
        }

        const { error } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user_id);
        if (error) throw new Error(error.message);

        await emitClientProfileUpdated(supabaseAdmin, user_id, {
          iptv_expiry: updateData.iptv_expiry,
          iptv_due_day: updateData.iptv_due_day,
          billing_due_date_id: updateData.billing_due_date_id,
          billing_cycle_started_at: updateData.billing_cycle_started_at,
          billing_proportional_enabled: updateData.billing_proportional_enabled,
          iptv_monthly_value: updateData.iptv_monthly_value,
          iptv_connections: updateData.iptv_connections,
          status: updateData.status,
          iptv_status: updateData.iptv_status,
          trial_enabled: updateData.trial_enabled,
          trial_ends_at: updateData.trial_ends_at,
          trial_expired_at: updateData.trial_expired_at,
          trial_payment_confirmed: updateData.trial_payment_confirmed,
        });

        // Quando o admin ativa após pagamento, confirma os pagamentos pendentes já corrigidos.
        // O vencimento definitivo é o vencimento anterior + quantidade de meses comprada.
        if (updateData.iptv_status === "active") {
          const hasPaidPendingActivation = pendingActivationPayments.length > 0;

          if (hasPaidPendingActivation) {
            const pendingIds = pendingActivationPayments.map((payment) => payment.id).filter(Boolean);
            const { error: confirmPendingError } = await supabaseAdmin
              .from("iptv_payments")
              .update({ status: "confirmed", admin_id: caller.id })
              .in("id", pendingIds);
            if (confirmPendingError) throw new Error(confirmPendingError.message);

            // Depois que o 1º pagamento for confirmado e o admin ativar,
            // o cliente deixa de ser teste e vira usuário efetivo.
            const { error: effectiveUserError } = await supabaseAdmin
              .from("profiles")
              .update({
                iptv_expiry: activationFinalExpiry || updateData.iptv_expiry,
                iptv_due_day: updateData.iptv_due_day,
                iptv_status: "active",
                trial_enabled: false,
                trial_payment_confirmed: true,
                trial_expired_at: null,
                trial_expired_notice_sent_at: null,
              })
              .eq("id", user_id);
            if (effectiveUserError) throw new Error(effectiveUserError.message);

            await emitFinanceUpdated(supabaseAdmin, user_id, {
              action: "activation_confirmed",
              status: "confirmed",
              payment_id: pendingActivationPayments[pendingActivationPayments.length - 1]?.id,
              period_end: activationFinalExpiry || updateData.iptv_expiry,
              profile_patch: {
                iptv_expiry: activationFinalExpiry || updateData.iptv_expiry,
                iptv_due_day: updateData.iptv_due_day,
                iptv_status: "active",
                trial_enabled: false,
                trial_payment_confirmed: true,
                trial_expired_at: null,
                trial_expired_notice_sent_at: null,
              },
            });
          }
        }

        // Se o admin salvar já como TESTE FINALIZADO, bloqueia e envia aviso automático uma vez.
        if (updateData.trial_enabled === true && updateData.iptv_status === "blocked") {
          try {
            const { data: trialProfile } = await supabaseAdmin
              .from("profiles")
              .select("name, trial_expired_notice_sent_at")
              .eq("id", user_id)
              .maybeSingle();

            if (!trialProfile?.trial_expired_notice_sent_at) {
              await supabaseAdmin
                .from("profiles")
                .update({ trial_expired_notice_sent_at: new Date().toISOString() })
                .eq("id", user_id);

              await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
                body: JSON.stringify({
                  action: "send_to_user",
                  user_id,
                  title: "TESTE FINALIZADO",
                  body: `Olá ${trialProfile?.name || ""}! Seu período de teste terminou. Realize o pagamento do seu plano e continue aproveitando o melhor da TV!`,
                  url: "/dashboard#gerar-pix",
                }),
              });
            }
          } catch (trialPushErr) {
            console.error("Falha ao enviar aviso automático de teste finalizado:", trialPushErr);
          }
        }

        // Send push notification ONLY when the status actually changed (not on regular edits)
        const statusActuallyChanged = updateData.iptv_status && updateData.iptv_status !== previousStatus;
        const isTrialStatusSave = updateData.trial_enabled === true;
        if (!isTrialStatusSave && statusActuallyChanged && (updateData.iptv_status === "blocked" || updateData.iptv_status === "active" || updateData.iptv_status === "disabled")) {
          try {
            const triggerEvent = updateData.iptv_status === "active" ? "activation_confirmed" : "user_blocked";
            const { data: userProfile } = await supabaseAdmin
              .from("profiles")
              .select("name, iptv_server, iptv_expiry")
              .eq("id", user_id)
              .single();
            const { data: rules } = await supabaseAdmin
              .from("notification_rules")
              .select("*")
              .eq("trigger_event", triggerEvent)
              .eq("is_active", true);

            if (rules && rules.length > 0) {
              const templateVars: Record<string, string> = {
                "{nome}": userProfile?.name || "",
                "{validade}": userProfile?.iptv_expiry ? userProfile.iptv_expiry.split("-").reverse().join("/") : "",
                "{servidor}": userProfile?.iptv_server || "",
                "{valor}": "",
                "{plano_meses}": "",
                "{data_pagamento}": "",
              };
              for (const rule of rules) {
                let t = rule.title_template;
                let b = rule.body_template;
                for (const [key, val] of Object.entries(templateVars)) {
                  t = t.replaceAll(key, val);
                  b = b.replaceAll(key, val);
                }
                await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
                  body: JSON.stringify({
                    action: "send_to_user",
                    user_id,
                    title: t,
                    body: b,
                    url: rule.click_url || "/",
                  }),
                });
              }
              console.log(`Manual ${updateData.iptv_status} push sent to user ${user_id} (${rules.length} rules)`);
            }
          } catch (pushErr) {
            console.error("Failed to send manual status push:", pushErr);
          }
        }

        if (updateData.iptv_status === "active" && updateData.trial_enabled !== true) {
          await emitClientProfileUpdated(supabaseAdmin, user_id, {
            iptv_status: "active",
            trial_enabled: false,
            trial_payment_confirmed: true,
            trial_expired_at: null,
            trial_expired_notice_sent_at: null,
          });
        }

        result = {
          success: true,
          profile_patch: {
            status: updateData.status,
            iptv_status: updateData.iptv_status,
            iptv_expiry: updateData.iptv_expiry,
            iptv_due_day: updateData.iptv_due_day,
            billing_due_date_id: updateData.billing_due_date_id,
            iptv_server: updateData.iptv_server,
            iptv_tv_app: updateData.iptv_tv_app,
            iptv_connections: updateData.iptv_connections,
            iptv_monthly_value: updateData.iptv_monthly_value,
          },
        };
        break;
      }
      case "set_referrer_by_code": {
        const cleanCode = String(data?.referred_by_code || "")
          .trim()
          .toUpperCase();
        if (!cleanCode) throw new Error("Informe o código de indicação.");

        const { data: targetProfile, error: targetError } = await supabaseAdmin
          .from("profiles")
          .select("id, name, username, referred_by")
          .eq("id", user_id)
          .maybeSingle();

        if (targetError) throw new Error(targetError.message);
        if (!targetProfile) throw new Error("Cliente não encontrado.");

        const { data: referrer, error: referrerError } = await supabaseAdmin
          .from("profiles")
          .select("id, name, username, referral_code")
          .ilike("referral_code", cleanCode)
          .maybeSingle();

        if (referrerError) throw new Error(referrerError.message);
        if (!referrer) throw new Error("Código de indicação não encontrado.");
        if (referrer.id === user_id) throw new Error("O cliente não pode indicar ele mesmo.");

        const { data: existingBefore } = await supabaseAdmin
          .from("referrals")
          .select("id, status, referrer_id")
          .eq("referred_id", user_id)
          .neq("status", "rejected")
          .maybeSingle();

        if (targetProfile.referred_by || existingBefore) {
          result = {
            success: true,
            already_linked: true,
            referrer_id: targetProfile.referred_by || existingBefore?.referrer_id || null,
            message: "Este cliente já possui uma indicação vinculada.",
          };
          break;
        }

        // Atualiza o profile. Se o trigger SQL existir, ele já cria a linha em referrals automaticamente.
        const { error: updateErr } = await supabaseAdmin
          .from("profiles")
          .update({ referred_by: referrer.id })
          .eq("id", user_id);

        if (updateErr) throw new Error(updateErr.message);

        // Confere se o trigger criou a indicação. Se não criou, insere manualmente.
        const { data: existingAfter } = await supabaseAdmin
          .from("referrals")
          .select("id, status, referrer_id")
          .eq("referred_id", user_id)
          .neq("status", "rejected")
          .maybeSingle();

        if (!existingAfter) {
          const { error: referralErr } = await supabaseAdmin.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: user_id,
            reward_amount: 0,
            status: "pending",
            reward_type: "free_month",
            reward_months: 1,
            notes: "Indicação vinculada manualmente pelo admin. Aguardando o primeiro pagamento do indicado.",
          });

          if (referralErr) throw new Error(referralErr.message);
        }

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "set_referrer_by_code",
          target_table: "profiles",
          target_id: user_id,
          details: {
            referred_by_code: cleanCode,
            referrer_id: referrer.id,
            referrer_name: referrer.name || referrer.username || "",
          },
        });

        result = {
          success: true,
          referrer_id: referrer.id,
          referrer_name: referrer.name || referrer.username || "",
          referred_by_code: referrer.referral_code,
        };
        break;
      }

      case "confirm_payment": {
        // Admin confirma um pagamento manualmente.
        // A renovação sempre parte do vencimento previsto que já existia,
        // mesmo que o admin confirme um ou mais dias depois.
        const { amount, months, notes, period_start } = data;
        if (!amount || !months) {
          throw new Error("amount e months são obrigatórios");
        }

        const { data: paymentProfile, error: paymentProfileError } = await supabaseAdmin
          .from("profiles")
          .select("iptv_expiry, iptv_due_day")
          .eq("id", user_id)
          .single();
        if (paymentProfileError) throw new Error(paymentProfileError.message);

        const scheduledPeriodStart = isDateOnly(paymentProfile?.iptv_expiry)
          ? String(paymentProfile.iptv_expiry)
          : isDateOnly(period_start)
            ? String(period_start)
            : brDateOnly(new Date());
        const fixedDueDay = Math.max(
          1,
          Math.min(31, Number(String(scheduledPeriodStart).split("-")[2] || paymentProfile?.iptv_due_day || 10)),
        );
        const correctedPeriodEnd = addMonthsToDateOnlyByFixedDay(scheduledPeriodStart, Number(months), fixedDueDay);

        const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
          .from("iptv_payments")
          .insert({
            user_id,
            amount: Number(amount),
            months: Number(months),
            period_start: scheduledPeriodStart,
            period_end: correctedPeriodEnd,
            status: "confirmed",
            payment_method: "pix",
            admin_id: caller.id,
            notes: notes || "",
          })
          .select("id")
          .single();
        if (insertPaymentError) throw new Error(insertPaymentError.message);

        const { error: updatePaymentProfileError } = await supabaseAdmin
          .from("profiles")
          .update({
            iptv_expiry: correctedPeriodEnd,
            iptv_due_day: fixedDueDay,
            iptv_status: "active",
            trial_enabled: false,
            trial_payment_confirmed: true,
            trial_expired_at: null,
            trial_expired_notice_sent_at: null,
          })
          .eq("id", user_id);
        if (updatePaymentProfileError) throw new Error(updatePaymentProfileError.message);

        await supabaseAdmin.from("balance_history").insert({
          user_id,
          type: "payment",
          amount: Number(amount),
          description: `Mensalidade confirmada - ${months} mês(es) até ${correctedPeriodEnd}`,
          admin_id: caller.id,
        });

        await emitFinanceUpdated(supabaseAdmin, user_id, {
          action: "activation_confirmed",
          status: "confirmed",
          payment_id: insertedPayment?.id,
          period_end: correctedPeriodEnd,
          profile_patch: {
            iptv_expiry: correctedPeriodEnd,
            iptv_due_day: fixedDueDay,
            iptv_status: "active",
            trial_enabled: false,
            trial_payment_confirmed: true,
          },
        });

        result = { success: true, period_start: scheduledPeriodStart, period_end: correctedPeriodEnd };
        break;
      }
      case "auto_block_expired": {
        // Block all expired users automatically
        const today = new Date().toISOString().split("T")[0];
        const { data: expiredUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, name, iptv_expiry, iptv_server")
          .lt("iptv_expiry", today)
          .in("iptv_status", ["active"]);

        // Also block trust_active users whose trust period expired
        const { data: expiredTrustUsers } = await supabaseAdmin
          .from("iptv_trust_requests")
          .select("user_id")
          .eq("status", "approved")
          .lt("trust_expires_at", today);

        const trustUserIds = (expiredTrustUsers || []).map((t: any) => t.user_id);
        if (trustUserIds.length > 0) {
          // Block these users and mark trust as expired
          for (const tuid of trustUserIds) {
            await supabaseAdmin
              .from("profiles")
              .update({ iptv_status: "blocked" })
              .eq("id", tuid)
              .eq("iptv_status", "trust_active");
            await supabaseAdmin
              .from("iptv_trust_requests")
              .update({ status: "expired" })
              .eq("user_id", tuid)
              .eq("status", "approved")
              .lt("trust_expires_at", today);
          }
        }

        const blocked: string[] = [];

        // Load user_blocked rules
        const { data: blockRules } = await supabaseAdmin
          .from("notification_rules")
          .select("*")
          .eq("trigger_event", "user_blocked")
          .eq("is_active", true);

        for (const u of expiredUsers || []) {
          await supabaseAdmin.from("profiles").update({ iptv_status: "blocked" }).eq("id", u.id);
          blocked.push(u.id);

          // Send block notification
          if (blockRules && blockRules.length > 0) {
            try {
              const templateVars: Record<string, string> = {
                "{nome}": u.name || "",
                "{validade}": u.iptv_expiry ? u.iptv_expiry.split("-").reverse().join("/") : "",
                "{servidor}": u.iptv_server || "",
                "{valor}": "",
                "{plano_meses}": "",
                "{data_pagamento}": "",
              };
              for (const rule of blockRules) {
                let t = rule.title_template;
                let b = rule.body_template;
                for (const [key, val] of Object.entries(templateVars)) {
                  t = t.replaceAll(key, val);
                  b = b.replaceAll(key, val);
                }
                await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
                  body: JSON.stringify({
                    action: "send_to_user",
                    user_id: u.id,
                    title: t,
                    body: b,
                    url: rule.click_url || "/iptv",
                  }),
                });
              }
            } catch (pushErr) {
              console.error(`Failed to send block push to ${u.id}:`, pushErr);
            }
          }
        }

        result = { success: true, blocked_count: blocked.length, blocked_ids: blocked };
        break;
      }
      case "adjust_balance": {
        const { amount, description } = data;
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("balance, total_earned")
          .eq("id", user_id)
          .single();
        if (!profile) throw new Error("Usuário não encontrado");

        const newBalance = roundMoney(Number(profile.balance) + Number(amount));
        const updates: any = { balance: newBalance };
        if (Number(amount) > 0) {
          updates.total_earned = roundMoney(Number(profile.total_earned) + Number(amount));
        }

        await supabaseAdmin.from("profiles").update(updates).eq("id", user_id);
        await supabaseAdmin.from("balance_history").insert({
          user_id,
          type: Number(amount) > 0 ? "credit" : "debit",
          amount: Math.abs(Number(amount)),
          description: description || "Ajuste manual pelo admin",
          admin_id: caller.id,
        });

        result = { success: true, new_balance: newBalance };
        break;
      }
      case "update_status": {
        await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", user_id);
        result = { success: true };
        break;
      }
      case "archive_user": {
        // Archive: set status to archived and ban auth user (force logout)
        await supabaseAdmin.from("profiles").update({ status: "archived", iptv_status: "disabled" }).eq("id", user_id);
        // Ban auth user to force logout
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "archive_user",
          target_table: "profiles",
          target_id: user_id,
          details: { archived_at: new Date().toISOString() },
        });

        result = { success: true };
        break;
      }
      case "reactivate_user": {
        // Reactivate: set status back to active and unban auth user
        await supabaseAdmin.from("profiles").update({ status: "active", iptv_status: "active" }).eq("id", user_id);
        // Unban auth user
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "reactivate_user",
          target_table: "profiles",
          target_id: user_id,
          details: { reactivated_at: new Date().toISOString() },
        });

        result = { success: true };
        break;
      }
      case "delete_user": {
        // Nunca deixar perfil excluído aparecendo nas telas administrativas de TV.
        await supabaseAdmin
          .from("profiles")
          .update({ status: "deleted", iptv_status: "disabled" })
          .eq("id", user_id);

        try {
          await supabaseAdmin.auth.admin.deleteUser(user_id);
        } catch (deleteError) {
          console.warn("Auth delete falhou, mas perfil foi marcado como deleted:", deleteError);
        }

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "delete_user",
          target_table: "profiles",
          target_id: user_id,
          details: { deleted_at: new Date().toISOString() },
        });

        result = { success: true };
        break;
      }
      case "reset_password": {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: data.password });
        if (error) throw new Error(error.message);
        result = { success: true };
        break;
      }
      case "process_withdrawal": {
        const { withdrawal_id, status, admin_notes } = data;
        const { data: withdrawal } = await supabaseAdmin
          .from("withdrawals")
          .select("*")
          .eq("id", withdrawal_id)
          .single();
        if (!withdrawal) throw new Error("Saque não encontrado");
        if (withdrawal.status !== "pending") throw new Error("Saque já foi processado");

        await supabaseAdmin
          .from("withdrawals")
          .update({
            status,
            admin_notes: admin_notes || "",
            processed_at: new Date().toISOString(),
          })
          .eq("id", withdrawal_id);

        if (status === "approved") {
          await supabaseAdmin.from("balance_history").insert({
            user_id: withdrawal.user_id,
            type: "withdrawal",
            amount: Number(withdrawal.amount),
            description: `Saque aprovado - PIX: ${withdrawal.pix_key}`,
            admin_id: caller.id,
          });
        } else if (status === "rejected") {
          const { data: wProfile } = await supabaseAdmin
            .from("profiles")
            .select("balance")
            .eq("id", withdrawal.user_id)
            .single();
          if (wProfile) {
            await supabaseAdmin
              .from("profiles")
              .update({
                balance: roundMoney(Number(wProfile.balance) + Number(withdrawal.amount)),
              })
              .eq("id", withdrawal.user_id);
            await supabaseAdmin.from("balance_history").insert({
              user_id: withdrawal.user_id,
              type: "credit",
              amount: Number(withdrawal.amount),
              description: `Saque recusado - saldo devolvido`,
              admin_id: caller.id,
            });
          }
        }

        result = { success: true };
        break;
      }
      case "register_manual_payment": {
        // Register a historical/manual payment record WITHOUT changing iptv_expiry or iptv_status
        const {
          amount: manualAmount,
          payment_date: manualDate,
          notes: manualNotes,
          period_start: manualStart,
          period_end: manualEnd,
        } = data;
        if (!manualAmount || !manualDate || !manualStart || !manualEnd) {
          throw new Error("amount, payment_date, period_start e period_end são obrigatórios");
        }

        await supabaseAdmin.from("iptv_payments").insert({
          user_id,
          amount: roundMoney(Number(manualAmount)),
          months: 1,
          period_start: manualStart,
          period_end: manualEnd,
          status: "confirmed",
          payment_method: "manual",
          payment_date: `${manualDate}T12:00:00`,
          admin_id: caller.id,
          notes: manualNotes || "Registro manual",
        });

        await supabaseAdmin.from("balance_history").insert({
          user_id,
          type: "payment",
          amount: roundMoney(Number(manualAmount)),
          description: `Pagamento registrado manualmente — R$ ${roundMoney(Number(manualAmount)).toFixed(2)} (${manualStart} a ${manualEnd})`,
          admin_id: caller.id,
        });

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "register_manual_payment",
          target_table: "iptv_payments",
          target_id: user_id,
          details: {
            amount: manualAmount,
            payment_date: manualDate,
            period_start: manualStart,
            period_end: manualEnd,
            notes: manualNotes,
          },
        });

        result = { success: true };
        break;
      }
      case "reverse_payment": {
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin.from("iptv_payments").select("*").eq("id", payment_id).single();
        if (!payment) throw new Error("Pagamento não encontrado");

        const currentStatus = payment.status;
        const newStatus = currentStatus === "confirmed" ? "reversed" : "confirmed";

        // Update payment status
        await supabaseAdmin.from("iptv_payments").update({ status: newStatus }).eq("id", payment_id);

        if (newStatus === "reversed") {
          // Find the latest confirmed payment to recalculate expiry
          const { data: latestPayment } = await supabaseAdmin
            .from("iptv_payments")
            .select("period_end")
            .eq("user_id", user_id)
            .eq("status", "confirmed")
            .neq("id", payment_id)
            .order("period_end", { ascending: false })
            .limit(1)
            .maybeSingle();

          const newExpiry = latestPayment?.period_end || null;
          const today = new Date().toISOString().split("T")[0];
          const isExpired = !newExpiry || newExpiry < today;

          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_expiry: newExpiry,
              iptv_status: isExpired ? "blocked" : "active",
            })
            .eq("id", user_id);

          await supabaseAdmin.from("balance_history").insert({
            user_id,
            type: "reversal",
            amount: Number(payment.amount),
            description: `Pagamento revertido pelo admin — R$ ${Number(payment.amount).toFixed(2)}`,
            admin_id: caller.id,
          });
        } else {
          // Re-confirming: restore expiry from this payment
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_expiry: payment.period_end,
              iptv_status: "active",
            })
            .eq("id", user_id);

          await supabaseAdmin.from("balance_history").insert({
            user_id,
            type: "payment",
            amount: Number(payment.amount),
            description: `Pagamento re-confirmado pelo admin — R$ ${Number(payment.amount).toFixed(2)}`,
            admin_id: caller.id,
          });
        }

        result = { success: true, new_status: newStatus };
        break;
      }
      case "generate_future_invoices": {
        const { months_ahead } = data;
        const count = Math.min(Number(months_ahead) || 6, 12);

        // Get user profile for monthly value and connections
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("iptv_monthly_value, iptv_connections, iptv_expiry")
          .eq("id", user_id)
          .single();
        if (!prof) throw new Error("Usuário não encontrado");

        const baseMonthlyValue = Number(prof.iptv_monthly_value);
        const connections = Number(prof.iptv_connections);

        // Get scheduled rate changes for this user
        const { data: scheduledRates } = await supabaseAdmin
          .from("iptv_scheduled_rates")
          .select("*")
          .eq("user_id", user_id)
          .eq("applied", false)
          .order("effective_date", { ascending: true });

        // Find the latest period_end across all non-reversed payments
        const { data: lastPay } = await supabaseAdmin
          .from("iptv_payments")
          .select("period_end")
          .eq("user_id", user_id)
          .not("status", "in", "(reversed,removed,pix_pending)")
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        let startFrom: Date;
        if (lastPay?.period_end) {
          startFrom = new Date(lastPay.period_end + "T00:00:00");
        } else if (prof.iptv_expiry) {
          startFrom = new Date(prof.iptv_expiry + "T00:00:00");
        } else {
          startFrom = new Date();
        }

        const invoices: any[] = [];
        const appliedRateIds: string[] = [];

        for (let i = 0; i < count; i++) {
          const pStart = new Date(startFrom);
          pStart.setMonth(pStart.getMonth() + i);
          const pEnd = new Date(startFrom);
          pEnd.setMonth(pEnd.getMonth() + i + 1);
          const pStartStr = pStart.toISOString().split("T")[0];

          // Check if there's a scheduled rate change that should apply
          let monthlyValue = baseMonthlyValue;
          for (const rate of scheduledRates || []) {
            if (rate.effective_date <= pStartStr) {
              monthlyValue = Number(rate.new_monthly_value);
              if (!appliedRateIds.includes(rate.id)) {
                appliedRateIds.push(rate.id);
              }
            }
          }

          invoices.push({
            user_id,
            amount: roundMoney(monthlyValue * connections),
            months: 1,
            period_start: pStartStr,
            period_end: pEnd.toISOString().split("T")[0],
            status: "pending",
            payment_method: "pix",
            notes:
              monthlyValue !== baseMonthlyValue
                ? `Reajuste: R$ ${monthlyValue.toFixed(2)}/tela`
                : "Fatura gerada automaticamente",
          });
        }

        // Only insert invoices that don't overlap with existing ones
        const { data: existing } = await supabaseAdmin
          .from("iptv_payments")
          .select("period_start, period_end")
          .eq("user_id", user_id)
          .not("status", "in", "(reversed,removed,pix_pending)");

        const existingPeriods = (existing || []).map((e: any) => `${e.period_start}_${e.period_end}`);
        const newInvoices = invoices.filter(
          (inv) => !existingPeriods.includes(`${inv.period_start}_${inv.period_end}`),
        );

        if (newInvoices.length > 0) {
          await supabaseAdmin.from("iptv_payments").insert(newInvoices);
        }

        // Mark applied rates and update profile monthly value
        if (appliedRateIds.length > 0) {
          await supabaseAdmin
            .from("iptv_scheduled_rates")
            .update({
              applied: true,
              applied_at: new Date().toISOString(),
            })
            .in("id", appliedRateIds);

          // Update the profile monthly value to the latest applied rate
          const latestApplied = (scheduledRates || [])
            .filter((r: any) => appliedRateIds.includes(r.id))
            .sort((a: any, b: any) => (a.effective_date > b.effective_date ? -1 : 1))[0];
          if (latestApplied) {
            await supabaseAdmin
              .from("profiles")
              .update({
                iptv_monthly_value: Number(latestApplied.new_monthly_value),
              })
              .eq("id", user_id);
          }
        }

        result = { success: true, generated: newInvoices.length, rates_applied: appliedRateIds.length };
        break;
      }
      case "mark_invoice_paid": {
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: invoice } = await supabaseAdmin.from("iptv_payments").select("*").eq("id", payment_id).single();
        if (!invoice) throw new Error("Fatura não encontrada");

        // Mark as confirmed
        await supabaseAdmin
          .from("iptv_payments")
          .update({
            status: "confirmed",
            admin_id: caller.id,
            payment_date: new Date().toISOString(),
          })
          .eq("id", payment_id);

        // Update profile every time the admin gives baixa, so admin/client panels refresh immediately.
        const { data: profile } = await supabaseAdmin.from("profiles").select("iptv_expiry").eq("id", user_id).single();
        const currentExpiry = profile?.iptv_expiry || "1970-01-01";
        const nextExpiry = invoice.period_end > currentExpiry ? invoice.period_end : currentExpiry;
        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_expiry: nextExpiry,
            iptv_status: "active",
          })
          .eq("id", user_id);

        // Log in balance_history
        await supabaseAdmin.from("balance_history").insert({
          user_id,
          type: "payment",
          amount: Number(invoice.amount),
          description: `Fatura paga — período até ${invoice.period_end}`,
          admin_id: caller.id,
        });

        result = { success: true };
        break;
      }
      case "confirm_activation": {
        // Admin confirms the selected payment and clears every pending activation for this client.
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin
          .from("iptv_payments")
          .select("*")
          .eq("id", payment_id)
          .eq("user_id", user_id)
          .eq("status", "paid_pending_activation")
          .single();
        if (!payment) throw new Error("Pagamento não encontrado ou já confirmado");

        const { data: pendingPayments, error: pendingPaymentsError } = await supabaseAdmin
          .from("iptv_payments")
          .select("id, months, period_start, period_end, payment_date, created_at")
          .eq("user_id", user_id)
          .eq("status", "paid_pending_activation")
          .order("payment_date", { ascending: true })
          .order("created_at", { ascending: true });

        if (pendingPaymentsError) throw pendingPaymentsError;

        const { data: activationProfile, error: activationProfileError } = await supabaseAdmin
          .from("profiles")
          .select("iptv_expiry, iptv_due_day")
          .eq("id", user_id)
          .maybeSingle();
        if (activationProfileError) throw activationProfileError;

        const pendingIds = (pendingPayments || []).map((item: any) => item.id);
        let cycleStart = isDateOnly(activationProfile?.iptv_expiry)
          ? String(activationProfile.iptv_expiry)
          : isDateOnly((pendingPayments || [])[0]?.period_start)
            ? String((pendingPayments || [])[0].period_start)
            : isDateOnly(payment.period_start)
              ? String(payment.period_start)
              : brDateOnly(new Date());

        const fixedDueDay = Math.max(
          1,
          Math.min(31, Number(activationProfile?.iptv_due_day || cycleStart.split("-")[2] || 10)),
        );

        for (const pendingPayment of pendingPayments || []) {
          const correctedPeriodEnd = addMonthsToDateOnlyByFixedDay(
            cycleStart,
            Math.max(1, Number(pendingPayment.months || 1)),
            fixedDueDay,
          );

          const { error: dateUpdateError } = await supabaseAdmin
            .from("iptv_payments")
            .update({ period_start: cycleStart, period_end: correctedPeriodEnd })
            .eq("id", pendingPayment.id);
          if (dateUpdateError) throw dateUpdateError;

          pendingPayment.period_start = cycleStart;
          pendingPayment.period_end = correctedPeriodEnd;
          cycleStart = correctedPeriodEnd;
        }

        if (pendingIds.length > 0) {
          const { error: confirmPaymentsError } = await supabaseAdmin
            .from("iptv_payments")
            .update({
              status: "confirmed",
              admin_id: caller.id,
            })
            .in("id", pendingIds);

          if (confirmPaymentsError) throw confirmPaymentsError;
        }

        // A confirmação usa sempre: vencimento anterior + quantidade de meses pagos.
        // Nunca usa o dia em que o admin confirmou e nunca usa uma data padrão diferente.
        const finalExpiry = String(cycleStart || payment.period_end || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(finalExpiry)) {
          throw new Error("A cobrança não possui uma data de vencimento prevista válida.");
        }

        const profilePatch = {
          iptv_status: "active",
          iptv_expiry: finalExpiry,
          iptv_due_day: Math.max(1, Math.min(31, Number(finalExpiry.split("-")[2] || 10))),
          billing_due_date_id: null,
          trial_enabled: false,
          trial_payment_confirmed: true,
          trial_expired_at: null,
          trial_expired_notice_sent_at: null,
        };

        const { error: profileUpdateError } = await supabaseAdmin
          .from("profiles")
          .update(profilePatch)
          .eq("id", user_id);

        if (profileUpdateError) throw profileUpdateError;

        await emitClientProfileUpdated(supabaseAdmin, user_id, profilePatch);

        // Send push notifications based on DB rules for activation_confirmed
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!;

          const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("name, iptv_server, iptv_expiry")
            .eq("id", user_id)
            .single();
          const { data: rules } = await supabaseAdmin
            .from("notification_rules")
            .select("*")
            .eq("trigger_event", "activation_confirmed")
            .eq("is_active", true);

          const templateVars: Record<string, string> = {
            "{nome}": userProfile?.name || "",
            "{validade}": finalExpiry ? finalExpiry.split("-").reverse().join("/") : "",
            "{valor}": Number(payment.amount).toFixed(2),
            "{servidor}": userProfile?.iptv_server || "",
            "{plano_meses}": String(payment.months || 1),
            "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),
          };

          for (const rule of rules || []) {
            let title = rule.title_template;
            let body = rule.body_template;
            for (const [key, val] of Object.entries(templateVars)) {
              title = title.replaceAll(key, val);
              body = body.replaceAll(key, val);
            }
            await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-key": serviceKey },
              body: JSON.stringify({ action: "send_to_user", user_id, title, body, url: rule.click_url || "/" }),
            });
          }
          console.log(`Activation push sent to user ${user_id} (${(rules || []).length} rules)`);
        } catch (pushErr) {
          console.error("Failed to send activation push:", pushErr);
        }

        result = {
          success: true,
          action: "activation_confirmed",
          status: "confirmed",
          iptv_status: "active",
          payment_id,
          payment_ids: pendingIds,
          period_end: finalExpiry,
          profile_patch: profilePatch,
        };
        break;
      }
      case "remove_payment": {

        // Admin soft-removes a payment (hides from client, recalculates expiry)
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin.from("iptv_payments").select("*").eq("id", payment_id).single();
        if (!payment) throw new Error("Pagamento não encontrado");

        const newStatus = payment.status === "removed" ? "confirmed" : "removed";

        await supabaseAdmin.from("iptv_payments").update({ status: newStatus }).eq("id", payment_id);

        // Recalculate expiry from latest confirmed payment
        const { data: latestPayment } = await supabaseAdmin
          .from("iptv_payments")
          .select("period_end")
          .eq("user_id", user_id)
          .eq("status", "confirmed")
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        const newExpiry = latestPayment?.period_end || null;
        const today = new Date().toISOString().split("T")[0];
        const isExpired = !newExpiry || newExpiry < today;

        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_expiry: newExpiry,
            iptv_status: isExpired ? "blocked" : "active",
          })
          .eq("id", user_id);

        result = { success: true, new_status: newStatus };
        break;
      }
      case "add_scheduled_rate": {
        const { new_monthly_value, effective_date, notes: rateNotes } = data;
        if (!new_monthly_value || !effective_date)
          throw new Error("new_monthly_value e effective_date são obrigatórios");

        await supabaseAdmin.from("iptv_scheduled_rates").insert({
          user_id,
          new_monthly_value: Number(new_monthly_value),
          effective_date,
          notes: rateNotes || "",
          created_by: caller.id,
        });

        result = { success: true };
        break;
      }
      case "delete_scheduled_rate": {
        const { rate_id } = data;
        if (!rate_id) throw new Error("rate_id é obrigatório");

        await supabaseAdmin.from("iptv_scheduled_rates").delete().eq("id", rate_id);
        result = { success: true };
        break;
      }
      case "update_scheduled_rate": {
        const { rate_id, new_monthly_value, effective_date, notes: rateNotes } = data;
        if (!rate_id) throw new Error("rate_id é obrigatório");

        const updates: any = {};
        if (new_monthly_value !== undefined) updates.new_monthly_value = Number(new_monthly_value);
        if (effective_date !== undefined) updates.effective_date = effective_date;
        if (rateNotes !== undefined) updates.notes = rateNotes;

        await supabaseAdmin.from("iptv_scheduled_rates").update(updates).eq("id", rate_id);
        result = { success: true };
        break;
      }
      case "bulk_delete_invoices": {
        const { payment_ids } = data;
        if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
          throw new Error("payment_ids é obrigatório");
        }

        // Only delete real pending invoices for this user (not hidden PIX charges)
        const { data: deletedRows, error: deleteError } = await supabaseAdmin
          .from("iptv_payments")
          .delete()
          .eq("user_id", user_id)
          .in("id", payment_ids)
          .eq("status", "pending")
          .select("id");
        if (deleteError) throw deleteError;
        result = { success: true, deleted: deletedRows?.length || 0 };
        break;
      }
      case "bulk_update_invoices": {
        const { payment_ids, updates: invoiceUpdates } = data;
        if (!payment_ids || !Array.isArray(payment_ids)) throw new Error("payment_ids é obrigatório");
        if (!invoiceUpdates) throw new Error("updates é obrigatório");

        const allowed: any = {};
        if (invoiceUpdates.amount !== undefined) allowed.amount = Number(invoiceUpdates.amount);
        if (invoiceUpdates.notes !== undefined) allowed.notes = invoiceUpdates.notes;
        if (invoiceUpdates.status !== undefined) allowed.status = invoiceUpdates.status;

        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from("iptv_payments")
          .update(allowed)
          .eq("user_id", user_id)
          .in("id", payment_ids)
          .eq("status", "pending")
          .select("id");
        if (updateError) throw updateError;
        result = { success: true, updated: updatedRows?.length || 0 };
        break;
      }
      case "bulk_add_scheduled_rates": {
        // Add the same scheduled rate to multiple users at once
        const { user_ids, new_monthly_value, effective_date, notes: bulkNotes } = data;
        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) throw new Error("user_ids é obrigatório");
        if (!new_monthly_value || !effective_date)
          throw new Error("new_monthly_value e effective_date são obrigatórios");

        const rows = user_ids.map((uid: string) => ({
          user_id: uid,
          new_monthly_value: Number(new_monthly_value),
          effective_date,
          notes: bulkNotes || "",
          created_by: caller.id,
        }));

        await supabaseAdmin.from("iptv_scheduled_rates").insert(rows);
        result = { success: true, count: rows.length };
        break;
      }
      case "regenerate_future_invoices": {
        // Delete all pending future invoices and regenerate 6 from last confirmed payment
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("iptv_monthly_value, iptv_connections, iptv_expiry")
          .eq("id", user_id)
          .single();
        if (!prof) throw new Error("Usuário não encontrado");

        // Delete all pending invoices for this user
        await supabaseAdmin.from("iptv_payments").delete().eq("user_id", user_id).eq("status", "pending");

        // Get ALL scheduled rate changes (including already applied)
        const { data: ratesForRegen } = await supabaseAdmin
          .from("iptv_scheduled_rates")
          .select("*")
          .eq("user_id", user_id)
          .order("effective_date", { ascending: true });

        // Find the latest confirmed payment
        const { data: lastConfirmed } = await supabaseAdmin
          .from("iptv_payments")
          .select("period_end")
          .eq("user_id", user_id)
          .eq("status", "confirmed")
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        let startFrom: Date;
        if (lastConfirmed?.period_end) {
          startFrom = new Date(lastConfirmed.period_end + "T00:00:00");
        } else if (prof.iptv_expiry) {
          startFrom = new Date(prof.iptv_expiry + "T00:00:00");
        } else {
          startFrom = new Date();
        }

        const baseVal = Number(prof.iptv_monthly_value);
        const conns = Number(prof.iptv_connections);
        const newInvoices: any[] = [];
        const appliedIds: string[] = [];

        for (let i = 0; i < 6; i++) {
          const pStart = new Date(startFrom);
          pStart.setMonth(pStart.getMonth() + i);
          const pEnd = new Date(startFrom);
          pEnd.setMonth(pEnd.getMonth() + i + 1);
          const pStartStr = pStart.toISOString().split("T")[0];

          let mv = baseVal;
          for (const rate of ratesForRegen || []) {
            if (rate.effective_date <= pStartStr) {
              mv = Number(rate.new_monthly_value);
              if (!appliedIds.includes(rate.id)) appliedIds.push(rate.id);
            }
          }

          newInvoices.push({
            user_id,
            amount: roundMoney(mv * conns),
            months: 1,
            period_start: pStartStr,
            period_end: pEnd.toISOString().split("T")[0],
            status: "pending",
            payment_method: "pix",
            notes: mv !== baseVal ? `Reajuste: R$ ${mv.toFixed(2)}/tela` : "Fatura gerada automaticamente",
          });
        }

        if (newInvoices.length > 0) {
          await supabaseAdmin.from("iptv_payments").insert(newInvoices);
        }

        // Only mark newly-applied rates (skip already applied ones)
        const newlyAppliedIds = appliedIds.filter((id) => {
          const r = (ratesForRegen || []).find((rate: any) => rate.id === id);
          return r && !r.applied;
        });
        if (newlyAppliedIds.length > 0) {
          await supabaseAdmin
            .from("iptv_scheduled_rates")
            .update({
              applied: true,
              applied_at: new Date().toISOString(),
            })
            .in("id", newlyAppliedIds);
        }

        if (appliedIds.length > 0) {
          const latestRate = (ratesForRegen || [])
            .filter((r: any) => appliedIds.includes(r.id))
            .sort((a: any, b: any) => (a.effective_date > b.effective_date ? -1 : 1))[0];
          if (latestRate) {
            await supabaseAdmin
              .from("profiles")
              .update({
                iptv_monthly_value: Number(latestRate.new_monthly_value),
              })
              .eq("id", user_id);
          }
        }

        result = { success: true, generated: newInvoices.length };
        break;
      }
      case "approve_trust_unlock": {
        const { request_id } = data;
        if (!request_id) throw new Error("request_id é obrigatório");

        const { data: trustReq } = await supabaseAdmin
          .from("iptv_trust_requests")
          .select("*")
          .eq("id", request_id)
          .eq("status", "pending")
          .single();
        if (!trustReq) throw new Error("Solicitação não encontrada ou já processada");

        const trustExpires = new Date();
        trustExpires.setDate(trustExpires.getDate() + 3);
        const trustExpiresStr = trustExpires.toISOString().split("T")[0];

        // Update trust request
        await supabaseAdmin
          .from("iptv_trust_requests")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: caller.id,
            trust_expires_at: trustExpiresStr,
          })
          .eq("id", request_id);

        // Update user status to trust_active (don't change iptv_expiry)
        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_status: "trust_active",
          })
          .eq("id", trustReq.user_id);

        // Notify user
        try {
          const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("name")
            .eq("id", trustReq.user_id)
            .single();
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id: trustReq.user_id,
              title: "✅ Confiança Aprovada",
              body: `Seu acesso foi liberado por 3 dias. Efetue o pagamento até ${trustExpiresStr.split("-").reverse().join("/")} para evitar o bloqueio definitivo.`,
              url: "/",
            }),
          });
        } catch (pushErr) {
          console.error("Failed to send trust approval push:", pushErr);
        }

        result = { success: true };
        break;
      }
      case "reject_trust_unlock": {
        const { request_id } = data;
        if (!request_id) throw new Error("request_id é obrigatório");

        await supabaseAdmin
          .from("iptv_trust_requests")
          .update({
            status: "rejected",
            approved_by: caller.id,
            notes: data.notes || "Rejeitado pelo administrador",
          })
          .eq("id", request_id)
          .eq("status", "pending");

        // Notify user
        try {
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id,
              title: "❌ Confiança Negada",
              body: "Sua solicitação de desbloqueio de confiança foi recusada. Entre em contato com o suporte.",
              url: "/",
            }),
          });
        } catch (pushErr) {
          console.error("Failed to send trust rejection push:", pushErr);
        }

        result = { success: true };
        break;
      }
      case "activate_server_event": {
        // Bulk change all active/trust_active users to maintenance or unstable
        const eventType = data.event_type; // "maintenance" or "unstable"
        if (!["maintenance", "unstable"].includes(eventType))
          throw new Error("event_type deve ser 'maintenance' ou 'unstable'");

        // Get all users whose status is NOT already maintenance/unstable/blocked/disabled
        const { data: affectedUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, name, iptv_status")
          .in("iptv_status", ["active", "trust_active", "awaiting_payment"]);

        let changed = 0;
        for (const u of affectedUsers || []) {
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_status_before_event: u.iptv_status,
              iptv_status: eventType,
            })
            .eq("id", u.id);
          changed++;
        }

        // Send push notification to all affected users
        const eventLabel = eventType === "maintenance" ? "Manutenção" : "Instabilidade";
        const durationText = data.duration_minutes ? ` Previsão: ${data.duration_minutes} minutos.` : "";
        try {
          for (const u of affectedUsers || []) {
            await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
              body: JSON.stringify({
                action: "send_to_user",
                user_id: u.id,
                title: eventType === "maintenance" ? "🔧 Servidor em Manutenção" : "⚠️ Instabilidade no Servidor",
                body: `O servidor está em ${eventLabel.toLowerCase()}.${durationText} Pedimos desculpas pelo inconveniente.`,
                url: "/",
              }),
            });
          }
        } catch (pushErr) {
          console.error("Failed to send server event push:", pushErr);
        }

        result = { success: true, affected_count: changed };
        break;
      }
      case "deactivate_server_event": {
        // Restore previous status for all users affected by maintenance/unstable
        const eventType = data.event_type; // "maintenance" or "unstable"
        if (!["maintenance", "unstable"].includes(eventType))
          throw new Error("event_type deve ser 'maintenance' ou 'unstable'");

        const { data: affectedUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, name, iptv_status_before_event")
          .eq("iptv_status", eventType);

        let restored = 0;
        for (const u of affectedUsers || []) {
          const previousStatus = u.iptv_status_before_event || "active";
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_status: previousStatus,
              iptv_status_before_event: "",
            })
            .eq("id", u.id);
          restored++;
        }

        // Send push notification
        const eventLabel = eventType === "maintenance" ? "Manutenção" : "Instabilidade";
        try {
          for (const u of affectedUsers || []) {
            await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
              body: JSON.stringify({
                action: "send_to_user",
                user_id: u.id,
                title: eventType === "maintenance" ? "✅ Manutenção Concluída" : "✅ Instabilidade Resolvida",
                body: `A ${eventLabel.toLowerCase()} foi finalizada. Seu acesso foi restabelecido. Obrigado pela compreensão!`,
                url: "/",
              }),
            });
          }
        } catch (pushErr) {
          console.error("Failed to send server event resolution push:", pushErr);
        }

        result = { success: true, restored_count: restored };
        break;
      }
      default:
        throw new Error("Ação desconhecida: " + action);
    }

    // Audit log geral. Os dados informativos da TV já possuem um registro próprio
    // e podem conter senha; por isso não são duplicados no histórico comum.
    if (action !== "get_client_tv_info" && action !== "update_client_tv_info") {
      await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: caller.id,
        action,
        target_table: "profiles",
        target_id: user_id,
        details: data || {},
      });
    }

    const financeActions = new Set([
      "update_profile",
      "confirm_payment",
      "register_manual_payment",
      "reverse_payment",
      "generate_future_invoices",
      "mark_invoice_paid",
      "confirm_activation",
      "remove_payment",
      "bulk_delete_invoices",
      "bulk_update_invoices",
      "regenerate_future_invoices",
      "add_scheduled_rate",
      "update_scheduled_rate",
      "delete_scheduled_rate",
      "adjust_balance",
      "process_withdrawal",
    ]);

    if (financeActions.has(action) && user_id) {
      await emitFinanceUpdated(supabaseAdmin, user_id, {
        action: result?.action || action,
        ...result,
        result,
        status: result?.status || result?.new_status || data?.status || data?.iptv_status,
        payment_id: result?.payment_id || data?.payment_id,
        profile_patch: result?.profile_patch,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || "Erro interno.");
    console.error("admin-manage-user:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
