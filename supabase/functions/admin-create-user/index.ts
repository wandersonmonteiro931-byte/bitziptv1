import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const addDaysToDateOnly = (dateOnly: string, days: number) => {
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  const base = new Date(year, (month || 1) - 1, day || 1);
  base.setDate(base.getDate() + Number(days || 0));
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isDateOnly = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

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

    // Verify the caller is admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!;

    const supabaseAuth = createClient(supabaseUrl, (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      email,
      password,
      name,
      username,
      role,
      iptv_user,
      iptv_server,
      iptv_app,
      iptv_expiry,
      iptv_password,
      iptv_connections,
      iptv_monthly_value,
      iptv_status,
      referred_by_code,
      admin_notes,
      billing_due_date_id,
      billing_proportional_enabled,
      trial_enabled,
      trial_duration_days,
      trial_ends_at,
    } = body;

    if (!name || !username) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: name, username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanIptvUser = String(iptv_user || username || "").trim();
    const loginIdentifier = cleanIptvUser;

    if (!loginIdentifier) {
      return new Response(JSON.stringify({ error: "Usuário TV/Login é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Login do cliente deve ser sempre Usuário TV + senha.
    // O campo "email" não é usado como login.
    const userEmail = loginIdentifier.includes("@") ? loginIdentifier : `${loginIdentifier}@iptv.bitz`;
    const userPassword = String(password || iptv_password || loginIdentifier);

    let referredById: string | null = null;
    let referredByName: string | null = null;
    let referralRewardMonths = 1;
    const cleanReferredCode = String(referred_by_code || "")
      .trim()
      .toUpperCase();

    if (cleanReferredCode) {
      const { data: referralSettings, error: settingsError } = await supabaseAdmin
        .from("referral_settings")
        .select("is_active, default_reward_months")
        .eq("id", 1)
        .maybeSingle();

      if (settingsError) {
        return new Response(JSON.stringify({ error: settingsError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (referralSettings?.is_active === false) {
        return new Response(JSON.stringify({ error: "Promoção encerrada." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      referralRewardMonths = Math.max(1, Number(referralSettings?.default_reward_months || 1));

      const { data: referrer, error: referrerError } = await supabaseAdmin
        .from("profiles")
        .select("id, name, username, referral_code, status, iptv_status, trial_enabled")
        .ilike("referral_code", cleanReferredCode)
        .maybeSingle();

      if (referrerError) {
        return new Response(JSON.stringify({ error: referrerError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const referrerIsActive =
        !!referrer &&
        String(referrer.status || "").trim().toLowerCase() === "active" &&
        String(referrer.iptv_status || "").trim().toLowerCase() === "active" &&
        referrer.trial_enabled !== true;

      if (!referrerIsActive) {
        return new Response(JSON.stringify({ error: "Código inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      referredById = referrer.id;
      referredByName = referrer.name || referrer.username || null;
    }

    // Create auth user somente depois de validar integralmente o código de indicação.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    if (referredById === userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "O cliente não pode indicar a si mesmo." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let billingDueDateId = billing_due_date_id || null;
    let selectedDueDay = Number(body.iptv_due_day || 0);

    if (billingDueDateId) {
      const { data: selectedDue } = await supabaseAdmin
        .from("billing_due_dates")
        .select("id, day_of_month")
        .eq("id", billingDueDateId)
        .maybeSingle();

      if (selectedDue) selectedDueDay = Number(selectedDue.day_of_month);
      else billingDueDateId = null;
    }

    if (!billingDueDateId) {
      const { data: defaultDue } = await supabaseAdmin
        .from("billing_due_dates")
        .select("id, day_of_month")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("day_of_month", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultDue) {
        billingDueDateId = defaultDue.id;
        selectedDueDay = Number(defaultDue.day_of_month);
      }
    }

    if (!selectedDueDay || selectedDueDay < 1) selectedDueDay = 10;

    const makeDueDate = (from: Date, day: number) => {
      const y = from.getFullYear();
      const m = from.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      let due = new Date(y, m, Math.min(day, lastDay));

      if (due < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
        const next = new Date(y, m + 1, 1);
        const nextLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        due = new Date(next.getFullYear(), next.getMonth(), Math.min(day, nextLastDay));
      }

      return due.toISOString().split("T")[0];
    };

    const billingStart = brDateOnly(new Date());
    const explicitExpiry = /^\d{4}-\d{2}-\d{2}$/.test(String(iptv_expiry || "")) ? String(iptv_expiry) : "";
    if (explicitExpiry) {
      selectedDueDay = Math.max(1, Math.min(31, Number(explicitExpiry.split("-")[2] || selectedDueDay || 10)));
    }

    // O primeiro proporcional começa no dia do cadastro do usuário em data comercial do Brasil.
    const calculatedExpiry = explicitExpiry || makeDueDate(new Date(billingStart + "T00:00:00"), selectedDueDay);

    const trialEnabled = Boolean(trial_enabled);
    const trialDurationDays = Math.max(1, Math.min(365, Number(trial_duration_days || 1)));
    const trialStartedAt = trialEnabled ? billingStart : null;
    const trialEndsAt = trialEnabled
      ? (isDateOnly(trial_ends_at) ? String(trial_ends_at) : addDaysToDateOnly(billingStart, trialDurationDays))
      : null;
    const trialFinished = Boolean(trialEndsAt) && String(trialEndsAt) < billingStart;
    const effectiveExpiry = trialEnabled && trialEndsAt ? trialEndsAt : calculatedExpiry;
    const effectiveDueDay = Math.max(1, Math.min(31, Number(String(effectiveExpiry).split("-")[2] || selectedDueDay || 10)));
    const effectiveIptvStatus = trialEnabled ? (trialFinished ? "blocked" : "active") : (iptv_status || "active");

    // Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      name,
      username: loginIdentifier,
      iptv_user: loginIdentifier,
      iptv_password: iptv_password || userPassword,
      iptv_server: iptv_server || "",
      iptv_app: iptv_app || "",
      iptv_expiry: effectiveExpiry,
      billing_due_date_id: trialEnabled ? null : billingDueDateId,
      billing_cycle_started_at: billingStart,
      billing_first_cycle_paid: false,
      billing_proportional_enabled: Boolean(billing_proportional_enabled),
      iptv_due_day: effectiveDueDay,
      iptv_connections: iptv_connections || 1,
      iptv_monthly_value: iptv_monthly_value || 0,
      iptv_status: effectiveIptvStatus,
      trial_enabled: trialEnabled,
      trial_duration_days: trialEnabled ? trialDurationDays : null,
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      trial_expired_at: trialFinished ? new Date().toISOString() : null,
      trial_expired_notice_sent_at: null,
      trial_payment_confirmed: false,
      referred_by: referredById,
      admin_notes: admin_notes || "",
    });

    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    const userRole = role === "admin" ? "admin" : "client";
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: userRole });

    if (referredById) {
      const { data: existingReferral } = await supabaseAdmin
        .from("referrals")
        .select("id")
        .eq("referred_id", userId)
        .neq("status", "rejected")
        .maybeSingle();

      if (!existingReferral) {
        const { error: referralInsertError } = await supabaseAdmin.from("referrals").insert({
          referrer_id: referredById,
          referred_id: userId,
          reward_amount: 0,
          status: "pending",
          reward_type: "free_month",
          reward_months: referralRewardMonths,
          notes: "Aguardando o primeiro pagamento do indicado",
        });

        if (referralInsertError) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return new Response(
            JSON.stringify({ error: `Erro ao registrar indicação: ${referralInsertError.message}` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // Log action
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: caller.id,
      action: "create_user",
      target_table: "profiles",
      target_id: userId,
      details: { name, username: loginIdentifier, role: userRole, referred_by_code: cleanReferredCode || null, trial_enabled: trialEnabled, trial_ends_at: trialEndsAt },
    });

    const { data: createdProfile } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        referral_code: createdProfile?.referral_code || null,
        login_email: userEmail,
        referral_registered: !!referredById,
        referrer_name: referredByName,
        referred_by_code: cleanReferredCode || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
