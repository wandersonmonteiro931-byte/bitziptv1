import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    } = body;

    if (!name || !username) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: name, username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use provided email or generate one from username
    const userEmail = email || `${username}@iptv.bitz`;
    // Use provided password or iptv_password or username as fallback
    const userPassword = password || iptv_password || username;

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

    // Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      name,
      username,
      iptv_user: iptv_user || username,
      iptv_password: iptv_password || userPassword,
      iptv_server: iptv_server || "",
      iptv_app: iptv_app || "",
      iptv_expiry: iptv_expiry || null,
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
      await supabaseAdmin.from("referrals").insert({
        referrer_id: referredById,
        referred_id: userId,
        reward_amount: 0,
        status: "pending",
        reward_type: "free_month",
        reward_months: 1,
        notes: "Aguardando o primeiro pagamento do indicado",
      });
    }

    // Log action
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: caller.id,
      action: "create_user",
      target_table: "profiles",
      target_id: userId,
      details: { name, username, role: userRole, referred_by_code: cleanReferredCode || null },
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
