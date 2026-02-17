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

    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action, data } = body;

    // Helper: check admin
    const isAdmin = async () => {
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
      return !!roleData;
    };

    // Helper: log transaction
    const logTransaction = async (userId: string, type: string, amount: number, balanceAfter: number, description: string, metadata: any = {}, adminId?: string) => {
      await supabase.from("credit_transactions").insert({
        user_id: userId, type, amount, balance_after: balanceAfter, description, metadata, admin_id: adminId || null,
      });
    };

    // Helper: update level
    const updateLevel = async (userId: string) => {
      const { data: profile } = await supabase.from("profiles").select("level_points").eq("id", userId).single();
      if (!profile) return;
      const { data: settings } = await supabase.from("credit_settings").select("level_thresholds, vip_threshold").limit(1).single();
      if (!settings) return;
      const thresholds = settings.level_thresholds as Record<string, number>;
      let level = "bronze";
      const pts = profile.level_points;
      if (pts >= (thresholds.diamante || 2000)) level = "diamante";
      else if (pts >= (thresholds.ouro || 500)) level = "ouro";
      else if (pts >= (thresholds.prata || 100)) level = "prata";
      const vip = pts >= (settings.vip_threshold || 200);
      await supabase.from("profiles").update({ user_level: level, vip_badge: vip }).eq("id", userId);
    };

    let result: any = {};

    switch (action) {
      // ========== USER: Purchase credits ==========
      case "purchase_credits": {
        const { package_id } = data;
        const { data: profile } = await supabase.from("profiles").select("credits, credit_purchases_blocked, daily_credits_purchased, daily_purchase_date").eq("id", caller.id).single();
        if (!profile) throw new Error("Perfil não encontrado");
        if (profile.credit_purchases_blocked) throw new Error("Compra de créditos bloqueada para sua conta");

        const { data: pkg } = await supabase.from("credit_packages").select("*").eq("id", package_id).eq("is_active", true).single();
        if (!pkg) throw new Error("Pacote não encontrado");

        // Check daily limit
        const { data: settings } = await supabase.from("credit_settings").select("daily_purchase_limit").limit(1).single();
        const today = new Date().toISOString().slice(0, 10);
        let dailyPurchased = profile.daily_purchase_date === today ? profile.daily_credits_purchased : 0;
        if (settings && settings.daily_purchase_limit > 0 && dailyPurchased + pkg.credits > settings.daily_purchase_limit) {
          throw new Error(`Limite diário de ${settings.daily_purchase_limit} créditos atingido`);
        }

        // Check active promotions
        let bonusFromPromo = 0;
        const { data: promos } = await supabase.from("credit_promotions")
          .select("bonus_percentage").eq("is_active", true)
          .lte("starts_at", new Date().toISOString())
          .gte("ends_at", new Date().toISOString());
        if (promos && promos.length > 0) {
          const maxBonus = Math.max(...promos.map(p => p.bonus_percentage));
          bonusFromPromo = Math.floor(pkg.credits * maxBonus / 100);
        }

        const totalBonus = pkg.bonus_credits + bonusFromPromo;
        const totalCredits = pkg.credits + totalBonus;

        // Create purchase record (pending payment)
        const pixCode = `BITZ-${Date.now()}-${caller.id.slice(0,8)}`;
        await supabase.from("credit_purchases").insert({
          user_id: caller.id,
          package_id,
          credits_amount: pkg.credits,
          bonus_amount: totalBonus,
          price: pkg.price,
          status: "pending",
          pix_code: pixCode,
        });

        result = { success: true, pix_code: pixCode, total_credits: totalCredits, price: pkg.price };
        break;
      }

      // ========== USER: Play challenge ==========
      case "play_challenge": {
        const { challenge_id } = data;
        const { data: profile } = await supabase.from("profiles").select("credits, user_level").eq("id", caller.id).single();
        if (!profile) throw new Error("Perfil não encontrado");

        const { data: challenge } = await supabase.from("credit_challenges").select("*").eq("id", challenge_id).eq("is_active", true).single();
        if (!challenge) throw new Error("Desafio não encontrado");

        // Check level requirement
        const levelOrder = ["bronze", "prata", "ouro", "diamante"];
        if (levelOrder.indexOf(profile.user_level) < levelOrder.indexOf(challenge.min_level)) {
          throw new Error(`Nível mínimo: ${challenge.min_level}`);
        }

        if (profile.credits < challenge.cost_credits) throw new Error("Créditos insuficientes");

        // Check daily limit for this challenge
        if (challenge.daily_limit > 0) {
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const { count } = await supabase.from("challenge_attempts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", caller.id).eq("challenge_id", challenge_id)
            .gte("created_at", todayStart.toISOString());
          if ((count || 0) >= challenge.daily_limit) throw new Error("Limite diário de tentativas atingido");
        }

        // Probabilistic result
        const probabilities = challenge.probabilities as Array<{ result: number; weight: number; label: string }>;
        const totalWeight = probabilities.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedResult = probabilities[0];
        for (const prob of probabilities) {
          random -= prob.weight;
          if (random <= 0) { selectedResult = prob; break; }
        }

        const creditsWon = selectedResult.result;
        const newBalance = profile.credits - challenge.cost_credits + creditsWon;

        // Update balance
        await supabase.from("profiles").update({ credits: newBalance }).eq("id", caller.id);

        // Log attempt
        await supabase.from("challenge_attempts").insert({
          user_id: caller.id,
          challenge_id,
          credits_spent: challenge.cost_credits,
          credits_won: creditsWon,
          result_label: selectedResult.label,
          metadata: { challenge_type: challenge.challenge_type },
        });

        // Log transactions
        await logTransaction(caller.id, "challenge_bet", -challenge.cost_credits, profile.credits - challenge.cost_credits, `Desafio: ${challenge.name}`);
        if (creditsWon > 0) {
          await logTransaction(caller.id, "challenge_win", creditsWon, newBalance, `Prêmio: ${selectedResult.label} - ${challenge.name}`);
        }

        // Update level points
        await supabase.from("profiles").update({ level_points: (profile as any).level_points + 1 }).eq("id", caller.id);
        await updateLevel(caller.id);

        // Update monthly ranking
        const monthYear = new Date().toISOString().slice(0, 7);
        const { data: existingRank } = await supabase.from("credit_rankings")
          .select("*").eq("user_id", caller.id).eq("month_year", monthYear).maybeSingle();
        if (existingRank) {
          await supabase.from("credit_rankings").update({
            total_credits_used: existingRank.total_credits_used + challenge.cost_credits,
            total_credits_won: existingRank.total_credits_won + creditsWon,
          }).eq("id", existingRank.id);
        } else {
          await supabase.from("credit_rankings").insert({
            user_id: caller.id, month_year: monthYear,
            total_credits_used: challenge.cost_credits, total_credits_won: creditsWon,
          });
        }

        result = { success: true, credits_won: creditsWon, label: selectedResult.label, new_balance: newBalance };
        break;
      }

      // ========== ADMIN: Confirm purchase ==========
      case "confirm_purchase": {
        if (!(await isAdmin())) throw new Error("Apenas administradores");
        const { purchase_id } = data;
        const { data: purchase } = await supabase.from("credit_purchases").select("*").eq("id", purchase_id).single();
        if (!purchase) throw new Error("Compra não encontrada");
        if (purchase.status !== "pending") throw new Error("Compra já processada");

        const totalCredits = purchase.credits_amount + purchase.bonus_amount;
        const { data: profile } = await supabase.from("profiles").select("credits, level_points").eq("id", purchase.user_id).single();
        if (!profile) throw new Error("Usuário não encontrado");

        const newBalance = profile.credits + totalCredits;
        const newPoints = profile.level_points + purchase.credits_amount;

        await supabase.from("profiles").update({
          credits: newBalance, level_points: newPoints,
          daily_credits_purchased: purchase.credits_amount,
          daily_purchase_date: new Date().toISOString().slice(0, 10),
        }).eq("id", purchase.user_id);

        await supabase.from("credit_purchases").update({
          status: "confirmed", confirmed_at: new Date().toISOString(), admin_id: caller.id,
        }).eq("id", purchase_id);

        await logTransaction(purchase.user_id, "purchase", totalCredits, newBalance, `Compra confirmada: ${purchase.credits_amount} + ${purchase.bonus_amount} bônus`, { purchase_id }, caller.id);

        // Update monthly ranking
        const monthYear = new Date().toISOString().slice(0, 7);
        const { data: rank } = await supabase.from("credit_rankings")
          .select("*").eq("user_id", purchase.user_id).eq("month_year", monthYear).maybeSingle();
        if (rank) {
          await supabase.from("credit_rankings").update({ total_purchased: rank.total_purchased + purchase.credits_amount }).eq("id", rank.id);
        } else {
          await supabase.from("credit_rankings").insert({ user_id: purchase.user_id, month_year: monthYear, total_purchased: purchase.credits_amount });
        }

        await updateLevel(purchase.user_id);
        result = { success: true, new_balance: newBalance };
        break;
      }

      // ========== ADMIN: Cancel purchase ==========
      case "cancel_purchase": {
        if (!(await isAdmin())) throw new Error("Apenas administradores");
        const { purchase_id } = data;
        await supabase.from("credit_purchases").update({
          status: "cancelled", admin_id: caller.id,
        }).eq("id", purchase_id);
        result = { success: true };
        break;
      }

      // ========== ADMIN: Adjust credits ==========
      case "admin_adjust_credits": {
        if (!(await isAdmin())) throw new Error("Apenas administradores");
        const { user_id, amount, description } = data;
        const { data: profile } = await supabase.from("profiles").select("credits").eq("id", user_id).single();
        if (!profile) throw new Error("Usuário não encontrado");

        const newBalance = profile.credits + Number(amount);
        if (newBalance < 0) throw new Error("Saldo resultante não pode ser negativo");
        await supabase.from("profiles").update({ credits: newBalance }).eq("id", user_id);
        await logTransaction(user_id, "admin_adjust", Number(amount), newBalance, description || "Ajuste manual pelo admin", {}, caller.id);
        result = { success: true, new_balance: newBalance };
        break;
      }

      // ========== ADMIN: Block/unblock purchases ==========
      case "toggle_purchase_block": {
        if (!(await isAdmin())) throw new Error("Apenas administradores");
        const { user_id, blocked } = data;
        await supabase.from("profiles").update({ credit_purchases_blocked: blocked }).eq("id", user_id);
        result = { success: true };
        break;
      }

      default:
        throw new Error("Ação desconhecida: " + action);
    }

    // Audit log for admin actions
    if (["confirm_purchase", "cancel_purchase", "admin_adjust_credits", "toggle_purchase_block"].includes(action)) {
      await supabase.from("admin_audit_logs").insert({
        admin_id: caller.id, action: `credit_${action}`, target_table: "credits", target_id: data.user_id || data.purchase_id || "",
        details: data || {},
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
