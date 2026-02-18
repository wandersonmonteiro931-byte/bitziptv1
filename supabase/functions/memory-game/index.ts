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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, duration_seconds, pairs_found } = body;

    if (action === "complete_game") {
      // Get settings
      const { data: settings } = await supabaseAdmin
        .from("game_memory_settings")
        .select("*")
        .limit(1)
        .single();

      if (!settings || !settings.is_active) {
        return new Response(JSON.stringify({ error: "Jogo desativado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Anti-fraud: check minimum time
      if (duration_seconds < settings.min_time_seconds) {
        return new Response(JSON.stringify({ error: "Tempo impossível detectado. Ação registrada." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const won = pairs_found === 25 && duration_seconds <= settings.time_limit_seconds;

      // Check daily limit
      let rewarded = false;
      if (won) {
        const today = new Date().toISOString().split("T")[0];
        const { data: todaySessions } = await supabaseAdmin
          .from("game_memory_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("won", true)
          .gt("reward_amount", 0)
          .gte("created_at", today + "T00:00:00Z")
          .lte("created_at", today + "T23:59:59Z");

        if (!todaySessions || todaySessions.length < settings.daily_limit) {
          rewarded = true;

          // Credit balance
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("balance, total_earned")
            .eq("id", user.id)
            .single();

          if (profile) {
            await supabaseAdmin.from("profiles").update({
              balance: Number(profile.balance) + Number(settings.reward_amount),
              total_earned: Number(profile.total_earned) + Number(settings.reward_amount),
            }).eq("id", user.id);

            await supabaseAdmin.from("balance_history").insert({
              user_id: user.id,
              type: "credit",
              amount: Number(settings.reward_amount),
              description: `🎮 Jogo da Memória – completou em ${duration_seconds}s`,
            });
          }
        }
      }

      // Record session
      await supabaseAdmin.from("game_memory_sessions").insert({
        user_id: user.id,
        duration_seconds,
        pairs_found,
        won,
        reward_amount: rewarded ? Number(settings.reward_amount) : 0,
      });

      return new Response(JSON.stringify({
        won,
        rewarded,
        reward_amount: rewarded ? settings.reward_amount : 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_daily") {
      const today = new Date().toISOString().split("T")[0];
      const { data: settings } = await supabaseAdmin
        .from("game_memory_settings")
        .select("*")
        .limit(1)
        .single();

      const { data: todayWins } = await supabaseAdmin
        .from("game_memory_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("won", true)
        .gt("reward_amount", 0)
        .gte("created_at", today + "T00:00:00Z")
        .lte("created_at", today + "T23:59:59Z");

      return new Response(JSON.stringify({
        already_won_today: (todayWins?.length || 0) >= (settings?.daily_limit || 1),
        settings,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin actions
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_settings") {
      const { data: existing } = await supabaseAdmin.from("game_memory_settings").select("id").limit(1).single();
      if (existing) {
        await supabaseAdmin.from("game_memory_settings").update(body.data).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_sessions") {
      const { data: sessions } = await supabaseAdmin
        .from("game_memory_sessions")
        .select("*, profiles!game_memory_sessions_user_id_fkey(name, username)")
        .order("created_at", { ascending: false })
        .limit(100);
      return new Response(JSON.stringify({ sessions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
