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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, user_id, data } = body;

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
      case "adjust_balance": {
        const { amount, description } = data;
        // Get current balance
        const { data: profile } = await supabaseAdmin.from("profiles").select("balance, total_earned").eq("id", user_id).single();
        if (!profile) throw new Error("Usuário não encontrado");

        const newBalance = Number(profile.balance) + Number(amount);
        const updates: any = { balance: newBalance };
        if (Number(amount) > 0) {
          updates.total_earned = Number(profile.total_earned) + Number(amount);
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

        // Check if user balance is frozen
        const { data: wProfile } = await supabaseAdmin.from("profiles").select("balance, balance_frozen").eq("id", withdrawal.user_id).single();
        if (status === "approved" && wProfile?.balance_frozen) {
          throw new Error("Saldo do usuário está congelado. Descongele antes de aprovar.");
        }

        await supabaseAdmin.from("withdrawals").update({
          status,
          admin_notes: admin_notes || "",
          processed_at: new Date().toISOString(),
        }).eq("id", withdrawal_id);

        if (status === "approved" && wProfile) {
          await supabaseAdmin.from("profiles").update({
            balance: Number(wProfile.balance) - Number(withdrawal.amount),
          }).eq("id", withdrawal.user_id);
          await supabaseAdmin.from("balance_history").insert({
            user_id: withdrawal.user_id,
            type: "withdrawal",
            amount: Number(withdrawal.amount),
            description: `Saque aprovado - PIX: ${withdrawal.pix_key}`,
            admin_id: caller.id,
          });
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
