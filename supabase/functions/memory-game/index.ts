import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prevent floating-point precision errors on monetary values
const roundMoney = (v: number) => Math.round(v * 100) / 100;

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

    if (action === "start_game") {
      // Deduct credits to start a game
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

      const cost = Number(settings.cost_per_game || 0);

      if (cost > 0) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        if (!profile || Number(profile.credits) < cost) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes", required: cost }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Deduct credits
        await supabaseAdmin.from("profiles").update({
          credits: Number(profile.credits) - cost,
        }).eq("id", user.id);

        await supabaseAdmin.from("credit_transactions").insert({
          user_id: user.id,
          type: "challenge_bet",
          amount: -cost,
          balance_after: Number(profile.credits) - cost,
          description: `🎮 Jogo da Memória – entrada`,
        });
      }

      return new Response(JSON.stringify({ success: true, cost, settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete_game") {
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
        return new Response(JSON.stringify({ error: "Tempo impossível detectado." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const won = pairs_found === 10 && duration_seconds <= settings.time_limit_seconds;

      let rewarded = false;
      if (won) {
        // Use Brazil timezone (UTC-3) so daily limit resets at 0h BRT
        const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const todayBRT = nowBRT.toISOString().split("T")[0];
        const dayStartUTC = todayBRT + "T03:00:00Z"; // 0h BRT = 03h UTC
        const tomorrowBRT = new Date(nowBRT.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const dayEndUTC = tomorrowBRT + "T03:00:00Z";
        const { data: todaySessions } = await supabaseAdmin
          .from("game_memory_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("won", true)
          .gt("reward_amount", 0)
          .gte("created_at", dayStartUTC)
          .lt("created_at", dayEndUTC);

        if (!todaySessions || todaySessions.length < settings.daily_limit) {
          rewarded = true;

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("balance, total_earned")
            .eq("id", user.id)
            .single();

          if (profile) {
            await supabaseAdmin.from("profiles").update({
              balance: roundMoney(Number(profile.balance) + Number(settings.reward_amount)),
              total_earned: roundMoney(Number(profile.total_earned) + Number(settings.reward_amount)),
            }).eq("id", user.id);

            await supabaseAdmin.from("balance_history").insert({
              user_id: user.id,
              type: "credit",
              amount: Number(settings.reward_amount),
              description: `🎮 Jogo da Memória – vitória em ${duration_seconds}s`,
            });
          }
        }
      }

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
      // Use Brazil timezone (UTC-3) so daily limit resets at 0h BRT
      const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const todayBRT = nowBRT.toISOString().split("T")[0];
      const { data: settings } = await supabaseAdmin
        .from("game_memory_settings")
        .select("*")
        .limit(1)
        .single();

      const dayStartUTC = todayBRT + "T03:00:00Z"; // 0h BRT = 03h UTC
      const tomorrowBRT = new Date(nowBRT.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const dayEndUTC = tomorrowBRT + "T03:00:00Z";
      const { data: todayWins } = await supabaseAdmin
        .from("game_memory_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("won", true)
        .gt("reward_amount", 0)
        .gte("created_at", dayStartUTC)
        .lt("created_at", dayEndUTC);

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
