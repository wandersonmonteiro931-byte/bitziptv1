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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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
      return new Response(JSON.stringify({ error: "Usuário IPTV/Login é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Login do cliente deve ser sempre Usuário IPTV + senha.
    // O campo "email" não é usado como login.
    const userEmail = loginIdentifier.includes("@") ? loginIdentifier : `${loginIdentifier}@iptv.bitz`;
    const userPassword = String(password || iptv_password || loginIdentifier);

    // Create auth user
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

    let referredById: string | null = null;
    const cleanReferredCode = String(referred_by_code || "")
      .trim()
      .toUpperCase();
    if (cleanReferredCode) {
      const { data: referrer, error: referrerError } = await supabaseAdmin
        .from("profiles")
        .select("id, name, username, referral_code")
        .ilike("referral_code", cleanReferredCode)
        .maybeSingle();

      if (referrerError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: referrerError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!referrer) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: "Código de indicação não encontrado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      referredById = referrer.id;
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
    // O primeiro proporcional começa no dia do cadastro do usuário em data comercial do Brasil.
    const calculatedExpiry = makeDueDate(new Date(billingStart + "T00:00:00"), selectedDueDay);

    // Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      name,
      username: loginIdentifier,
      iptv_user: loginIdentifier,
      iptv_password: iptv_password || userPassword,
      iptv_server: iptv_server || "",
      iptv_app: iptv_app || "",
      iptv_expiry: iptv_expiry || calculatedExpiry,
      billing_due_date_id: billingDueDateId,
      billing_cycle_started_at: billingStart,
      billing_first_cycle_paid: false,
      billing_proportional_enabled: Boolean(billing_proportional_enabled),
      iptv_due_day: selectedDueDay,
      iptv_connections: iptv_connections || 1,
      iptv_monthly_value: iptv_monthly_value || 0,
      iptv_status: iptv_status || "active",
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
          reward_months: 1,
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
      details: { name, username: loginIdentifier, role: userRole, referred_by_code: cleanReferredCode || null },
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
