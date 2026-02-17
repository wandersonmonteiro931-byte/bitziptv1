import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All possible prize keys for the scratch card grid
const ALL_PRIZE_KEYS = ["nada", "r1", "r5", "c1", "c3", "r30", "r50", "r100", "r500", "r1000"];

function generateScratchGrid(wonPrizeKey: string | null): string[] {
  const grid: string[] = [];

  if (wonPrizeKey && wonPrizeKey !== "nada") {
    // Place 3 of the winning prize
    grid.push(wonPrizeKey, wonPrizeKey, wonPrizeKey);
    // Fill remaining 7 with random non-matching (max 2 of any)
    const others = ALL_PRIZE_KEYS.filter((k) => k !== wonPrizeKey);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      let pick: string;
      do {
        pick = others[Math.floor(Math.random() * others.length)];
      } while ((counts[pick] || 0) >= 2);
      counts[pick] = (counts[pick] || 0) + 1;
      grid.push(pick);
    }
  } else {
    // No 3 matching — max 2 of each
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      let pick: string;
      do {
        pick = ALL_PRIZE_KEYS[Math.floor(Math.random() * ALL_PRIZE_KEYS.length)];
      } while ((counts[pick] || 0) >= 2);
      counts[pick] = (counts[pick] || 0) + 1;
      grid.push(pick);
    }
  }

  // Shuffle (Fisher-Yates)
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

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

      // ========== USER: Play challenge (Scratch Card) ==========
      case "play_challenge": {
        const { challenge_id } = data;
        const { data: profile } = await supabase.from("profiles").select("credits, user_level, balance, total_earned, level_points").eq("id", caller.id).single();
        if (!profile) throw new Error("Perfil não encontrado");

        const { data: challenge } = await supabase.from("credit_challenges").select("*").eq("id", challenge_id).eq("is_active", true).single();
        if (!challenge) throw new Error("Desafio não encontrado");

        // Check level requirement
        const levelOrder = ["bronze", "prata", "ouro", "diamante"];
        if (levelOrder.indexOf(profile.user_level) < levelOrder.indexOf(challenge.min_level)) {
          throw new Error(`Nível mínimo: ${challenge.min_level}`);
        }

        if (profile.credits < challenge.cost_credits) throw new Error("Créditos insuficientes");

        // Anti-fraud: rate limit - max 1 play per 3 seconds
        const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
        const { count: recentCount } = await supabase.from("challenge_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", caller.id).eq("challenge_id", challenge_id)
          .gte("created_at", threeSecondsAgo);
        if ((recentCount || 0) > 0) throw new Error("Aguarde alguns segundos entre jogadas");

        // Check daily limit for this challenge
        if (challenge.daily_limit > 0) {
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const { count } = await supabase.from("challenge_attempts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", caller.id).eq("challenge_id", challenge_id)
            .gte("created_at", todayStart.toISOString());
          if ((count || 0) >= challenge.daily_limit) throw new Error("Limite diário de tentativas atingido");
        }

        // Probabilistic result — backend decides win/loss first
        const probabilities = challenge.probabilities as Array<{ result: number; weight: number; label: string; reward_type?: string; prize_key?: string }>;
        const totalWeight = probabilities.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedResult = probabilities[0];
        for (const prob of probabilities) {
          random -= prob.weight;
          if (random <= 0) { selectedResult = prob; break; }
        }

        const prizeValue = selectedResult.result;
        const rewardType = selectedResult.reward_type || "credits";
        const prizeKey = selectedResult.prize_key || "nada";

        // Generate the 10-cell grid server-side
        const isWin = prizeValue > 0 && rewardType !== "none";
        const grid = generateScratchGrid(isWin ? prizeKey : null);

        // Deduct credits spent
        const newCredits = profile.credits - challenge.cost_credits + (rewardType === "credits" ? prizeValue : 0);
        const profileUpdates: any = { credits: newCredits };

        // If reward is balance (real money), add to balance
        let balanceWon = 0;
        if (rewardType === "balance" && prizeValue > 0) {
          balanceWon = prizeValue;
          profileUpdates.balance = Number(profile.balance) + prizeValue;
          profileUpdates.total_earned = Number(profile.total_earned) + prizeValue;
        }

        await supabase.from("profiles").update(profileUpdates).eq("id", caller.id);

        // Log attempt
        await supabase.from("challenge_attempts").insert({
          user_id: caller.id,
          challenge_id,
          credits_spent: challenge.cost_credits,
          credits_won: rewardType === "credits" ? prizeValue : 0,
          result_label: selectedResult.label,
          metadata: { 
            challenge_type: challenge.challenge_type, 
            reward_type: rewardType, 
            balance_won: balanceWon,
            prize_key: prizeKey,
            grid: grid,
          },
        });

        // Log credit transactions
        await logTransaction(caller.id, "challenge_bet", -challenge.cost_credits, profile.credits - challenge.cost_credits, `Desafio: ${challenge.name}`);
        if (rewardType === "credits" && prizeValue > 0) {
          await logTransaction(caller.id, "challenge_win", prizeValue, newCredits, `Prêmio: ${selectedResult.label} - ${challenge.name}`);
        }

        // If balance reward, also log in balance_history
        if (rewardType === "balance" && prizeValue > 0) {
          await supabase.from("balance_history").insert({
            user_id: caller.id,
            type: "credit",
            amount: prizeValue,
            description: `Prêmio em saldo: ${selectedResult.label} - ${challenge.name}`,
          });
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
            total_credits_won: existingRank.total_credits_won + (rewardType === "credits" ? prizeValue : 0),
          }).eq("id", existingRank.id);
        } else {
          await supabase.from("credit_rankings").insert({
            user_id: caller.id, month_year: monthYear,
            total_credits_used: challenge.cost_credits, total_credits_won: rewardType === "credits" ? prizeValue : 0,
          });
        }

        result = {
          success: true,
          credits_won: rewardType === "credits" ? prizeValue : 0,
          balance_won: balanceWon,
          reward_type: rewardType,
          label: selectedResult.label,
          prize_key: prizeKey,
          grid: grid,
          new_credits: newCredits,
          new_balance: Number(profile.balance) + balanceWon,
        };
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

      // ========== USER: Play Prize Box ==========
      case "play_prize_box": {
        const { challenge_id } = data;
        const { data: profile } = await supabase.from("profiles").select("credits, user_level, balance, total_earned, level_points").eq("id", caller.id).single();
        if (!profile) throw new Error("Perfil não encontrado");

        const { data: challenge } = await supabase.from("credit_challenges").select("*").eq("id", challenge_id).eq("is_active", true).single();
        if (!challenge) throw new Error("Desafio não encontrado");

        const levelOrder = ["bronze", "prata", "ouro", "diamante"];
        if (levelOrder.indexOf(profile.user_level) < levelOrder.indexOf(challenge.min_level)) {
          throw new Error(`Nível mínimo: ${challenge.min_level}`);
        }

        if (profile.credits < challenge.cost_credits) throw new Error("Créditos insuficientes");

        // Anti-fraud: rate limit
        const threeSecsAgo = new Date(Date.now() - 3000).toISOString();
        const { count: recentPlays } = await supabase.from("challenge_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", caller.id).eq("challenge_id", challenge_id)
          .gte("created_at", threeSecsAgo);
        if ((recentPlays || 0) > 0) throw new Error("Aguarde alguns segundos entre jogadas");

        // Check daily limit
        if (challenge.daily_limit > 0) {
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const { count } = await supabase.from("challenge_attempts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", caller.id).eq("challenge_id", challenge_id)
            .gte("created_at", todayStart.toISOString());
          if ((count || 0) >= challenge.daily_limit) throw new Error("Limite diário de tentativas atingido");
        }

        // Determine result from probabilities
        const probs = challenge.probabilities as Array<{ result: number; weight: number; label: string; reward_type?: string; prize_key?: string }>;
        const totalW = probs.reduce((s, p) => s + p.weight, 0);
        let rand = Math.random() * totalW;
        let sel = probs[0];
        for (const p of probs) {
          rand -= p.weight;
          if (rand <= 0) { sel = p; break; }
        }

        const prizeValue = sel.result;
        const rewardType = sel.reward_type || "credits";
        const prizeKey = sel.prize_key || "nada";
        const isWin = prizeValue > 0 && rewardType !== "none";

        // Determine what's in the chosen box and the other box
        // Chosen box = the prize the user won (or "nada")
        // Other box = a "near miss" or lesser/greater value for dramatic effect
        let otherBoxPrize = "nada";
        let otherBoxLabel = "Nada";
        let otherBoxValue = 0;
        let otherBoxRewardType = "none";
        if (isWin) {
          // Other box shows something worse (could be "nada" or smaller prize)
          const lesserPrizes = probs.filter(p => p.result < prizeValue && p.result >= 0);
          if (lesserPrizes.length > 0) {
            const other = lesserPrizes[Math.floor(Math.random() * lesserPrizes.length)];
            otherBoxPrize = other.prize_key || "nada";
            otherBoxLabel = other.label;
            otherBoxValue = other.result;
            otherBoxRewardType = other.reward_type || "none";
          }
        } else {
          // Lost - other box shows a prize (near miss effect)
          const betterPrizes = probs.filter(p => p.result > 0);
          if (betterPrizes.length > 0) {
            // Pick a small/medium prize for drama
            const sortedPrizes = [...betterPrizes].sort((a, b) => a.result - b.result);
            const other = sortedPrizes[Math.floor(Math.random() * Math.min(3, sortedPrizes.length))];
            otherBoxPrize = other.prize_key || "nada";
            otherBoxLabel = other.label;
            otherBoxValue = other.result;
            otherBoxRewardType = other.reward_type || "credits";
          }
        }

        // Deduct credits and apply rewards
        const newCredits = profile.credits - challenge.cost_credits + (rewardType === "credits" ? prizeValue : 0);
        const profileUpd: any = { credits: newCredits };

        let balanceWon = 0;
        if (rewardType === "balance" && prizeValue > 0) {
          balanceWon = prizeValue;
          profileUpd.balance = Number(profile.balance) + prizeValue;
          profileUpd.total_earned = Number(profile.total_earned) + prizeValue;
        }

        await supabase.from("profiles").update(profileUpd).eq("id", caller.id);

        // Log attempt
        await supabase.from("challenge_attempts").insert({
          user_id: caller.id,
          challenge_id,
          credits_spent: challenge.cost_credits,
          credits_won: rewardType === "credits" ? prizeValue : 0,
          result_label: sel.label,
          metadata: {
            challenge_type: "prize_box",
            reward_type: rewardType,
            balance_won: balanceWon,
            prize_key: prizeKey,
            other_box: { prize_key: otherBoxPrize, label: otherBoxLabel, value: otherBoxValue, reward_type: otherBoxRewardType },
          },
        });

        await logTransaction(caller.id, "challenge_bet", -challenge.cost_credits, profile.credits - challenge.cost_credits, `Caixa Premiada: ${challenge.name}`);
        if (rewardType === "credits" && prizeValue > 0) {
          await logTransaction(caller.id, "challenge_win", prizeValue, newCredits, `Prêmio: ${sel.label} - ${challenge.name}`);
        }
        if (rewardType === "balance" && prizeValue > 0) {
          await supabase.from("balance_history").insert({
            user_id: caller.id, type: "credit", amount: prizeValue,
            description: `Prêmio em saldo: ${sel.label} - ${challenge.name}`,
          });
        }

        await supabase.from("profiles").update({ level_points: (profile as any).level_points + 1 }).eq("id", caller.id);
        await updateLevel(caller.id);

        // Monthly ranking
        const my = new Date().toISOString().slice(0, 7);
        const { data: er } = await supabase.from("credit_rankings").select("*").eq("user_id", caller.id).eq("month_year", my).maybeSingle();
        if (er) {
          await supabase.from("credit_rankings").update({
            total_credits_used: er.total_credits_used + challenge.cost_credits,
            total_credits_won: er.total_credits_won + (rewardType === "credits" ? prizeValue : 0),
          }).eq("id", er.id);
        } else {
          await supabase.from("credit_rankings").insert({
            user_id: caller.id, month_year: my,
            total_credits_used: challenge.cost_credits, total_credits_won: rewardType === "credits" ? prizeValue : 0,
          });
        }

        result = {
          success: true,
          credits_won: rewardType === "credits" ? prizeValue : 0,
          balance_won: balanceWon,
          reward_type: rewardType,
          label: sel.label,
          prize_key: prizeKey,
          other_box: { prize_key: otherBoxPrize, label: otherBoxLabel, value: otherBoxValue, reward_type: otherBoxRewardType },
          new_credits: newCredits,
          new_balance: Number(profile.balance) + balanceWon,
        };
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
