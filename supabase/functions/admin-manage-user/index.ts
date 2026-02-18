import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, user_id, data } = body;

    // request_withdrawal does NOT require admin role — it's called by the user
    if (action === "request_withdrawal") {
      const { amount, pix_key } = data;
      if (!amount || !pix_key) throw new Error("amount e pix_key são obrigatórios");

      const { data: profile } = await supabaseAdmin.from("profiles").select("balance, balance_frozen").eq("id", user_id).single();
      if (!profile) throw new Error("Usuário não encontrado");
      if (profile.balance_frozen) throw new Error("Saldo congelado. Saques bloqueados.");
      if (Number(profile.balance) < Number(amount)) throw new Error("Saldo insuficiente");
      if (Number(amount) < 30) throw new Error("Valor mínimo de R$ 30,00");

      await supabaseAdmin.from("profiles").update({
        balance: roundMoney(Number(profile.balance) - Number(amount)),
      }).eq("id", user_id);

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

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action e user_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (action) {
      case "update_profile": {
        const { error } = await supabaseAdmin.from("profiles").update(data).eq("id", user_id);
        if (error) throw new Error(error.message);
        result = { success: true };
        break;
      }
      case "confirm_payment": {
        // Admin confirms a payment and renews the plan
        const { amount, months, notes, period_start, period_end } = data;
        if (!amount || !months || !period_start || !period_end) {
          throw new Error("amount, months, period_start e period_end são obrigatórios");
        }

        // Insert payment record
        await supabaseAdmin.from("iptv_payments").insert({
          user_id,
          amount: Number(amount),
          months: Number(months),
          period_start,
          period_end,
          status: "confirmed",
          payment_method: "pix",
          admin_id: caller.id,
          notes: notes || "",
        });

        // Update user profile: set new expiry date + activate
        await supabaseAdmin.from("profiles").update({
          iptv_expiry: period_end,
          iptv_status: "active",
        }).eq("id", user_id);

        // Log in balance_history for client visibility
        await supabaseAdmin.from("balance_history").insert({
          user_id,
          type: "payment",
          amount: Number(amount),
          description: `Mensalidade confirmada - ${months} mês(es) até ${period_end}`,
          admin_id: caller.id,
        });

        result = { success: true };
        break;
      }
      case "auto_block_expired": {
        // Block all expired users automatically
        const today = new Date().toISOString().split("T")[0];
        const { data: expiredUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, name, iptv_expiry")
          .lt("iptv_expiry", today)
          .eq("iptv_status", "active");

        const blocked: string[] = [];
        for (const u of (expiredUsers || [])) {
          await supabaseAdmin.from("profiles").update({ iptv_status: "blocked" }).eq("id", u.id);
          blocked.push(u.id);
        }

        result = { success: true, blocked_count: blocked.length, blocked_ids: blocked };
        break;
      }
      case "adjust_balance": {
        const { amount, description } = data;
        const { data: profile } = await supabaseAdmin.from("profiles").select("balance, total_earned").eq("id", user_id).single();
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
      case "delete_user": {
        await supabaseAdmin.auth.admin.deleteUser(user_id);
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
        const { data: withdrawal } = await supabaseAdmin.from("withdrawals").select("*").eq("id", withdrawal_id).single();
        if (!withdrawal) throw new Error("Saque não encontrado");
        if (withdrawal.status !== "pending") throw new Error("Saque já foi processado");

        await supabaseAdmin.from("withdrawals").update({
          status,
          admin_notes: admin_notes || "",
          processed_at: new Date().toISOString(),
        }).eq("id", withdrawal_id);

        if (status === "approved") {
          await supabaseAdmin.from("balance_history").insert({
            user_id: withdrawal.user_id,
            type: "withdrawal",
            amount: Number(withdrawal.amount),
            description: `Saque aprovado - PIX: ${withdrawal.pix_key}`,
            admin_id: caller.id,
          });
        } else if (status === "rejected") {
          const { data: wProfile } = await supabaseAdmin.from("profiles").select("balance").eq("id", withdrawal.user_id).single();
          if (wProfile) {
            await supabaseAdmin.from("profiles").update({
              balance: roundMoney(Number(wProfile.balance) + Number(withdrawal.amount)),
            }).eq("id", withdrawal.user_id);
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
      default:
        throw new Error("Ação desconhecida: " + action);
    }

    // Audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: caller.id,
      action,
      target_table: "profiles",
      target_id: user_id,
      details: data || {},
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
