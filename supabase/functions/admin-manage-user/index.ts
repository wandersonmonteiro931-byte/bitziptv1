import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

        // When admin activates a user (sets status to active), also confirm pending activation payments
        if (data.iptv_status === "active") {
          await supabaseAdmin
            .from("iptv_payments")
            .update({ status: "confirmed", admin_id: caller.id })
            .eq("user_id", user_id)
            .eq("status", "paid_pending_activation");
        }

        // Send push notification when admin manually blocks or activates a user
        if (data.iptv_status === "blocked" || data.iptv_status === "active") {
          try {
            const triggerEvent = data.iptv_status === "blocked" ? "user_blocked" : "activation_confirmed";
            const { data: userProfile } = await supabaseAdmin.from("profiles").select("name, iptv_server, iptv_expiry").eq("id", user_id).single();
            const { data: rules } = await supabaseAdmin.from("notification_rules").select("*").eq("trigger_event", triggerEvent).eq("is_active", true);

            if (rules && rules.length > 0) {
              const templateVars: Record<string, string> = {
                "{nome}": userProfile?.name || "",
                "{validade}": userProfile?.iptv_expiry ? userProfile.iptv_expiry.split("-").reverse().join("/") : "",
                "{servidor}": userProfile?.iptv_server || "",
                "{valor}": "", "{plano_meses}": "", "{data_pagamento}": "",
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
                  body: JSON.stringify({ action: "send_to_user", user_id, title: t, body: b, url: rule.click_url || "/" }),
                });
              }
              console.log(`Manual ${data.iptv_status} push sent to user ${user_id} (${rules.length} rules)`);
            }
          } catch (pushErr) {
            console.error("Failed to send manual status push:", pushErr);
          }
        }

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
          .select("id, name, iptv_expiry, iptv_server")
          .lt("iptv_expiry", today)
          .eq("iptv_status", "active");

        const blocked: string[] = [];

        // Load user_blocked rules
        const { data: blockRules } = await supabaseAdmin.from("notification_rules").select("*").eq("trigger_event", "user_blocked").eq("is_active", true);

        for (const u of (expiredUsers || [])) {
          await supabaseAdmin.from("profiles").update({ iptv_status: "blocked" }).eq("id", u.id);
          blocked.push(u.id);

          // Send block notification
          if (blockRules && blockRules.length > 0) {
            try {
              const templateVars: Record<string, string> = {
                "{nome}": u.name || "",
                "{validade}": u.iptv_expiry ? u.iptv_expiry.split("-").reverse().join("/") : "",
                "{servidor}": u.iptv_server || "",
                "{valor}": "", "{plano_meses}": "", "{data_pagamento}": "",
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
                  body: JSON.stringify({ action: "send_to_user", user_id: u.id, title: t, body: b, url: rule.click_url || "/iptv" }),
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
      case "reverse_payment": {
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin
          .from("iptv_payments")
          .select("*")
          .eq("id", payment_id)
          .single();
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

          await supabaseAdmin.from("profiles").update({
            iptv_expiry: newExpiry,
            iptv_status: isExpired ? "blocked" : "active",
          }).eq("id", user_id);

          await supabaseAdmin.from("balance_history").insert({
            user_id,
            type: "reversal",
            amount: Number(payment.amount),
            description: `Pagamento revertido pelo admin — R$ ${Number(payment.amount).toFixed(2)}`,
            admin_id: caller.id,
          });
        } else {
          // Re-confirming: restore expiry from this payment
          await supabaseAdmin.from("profiles").update({
            iptv_expiry: payment.period_end,
            iptv_status: "active",
          }).eq("id", user_id);

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
        const { data: prof } = await supabaseAdmin.from("profiles").select("iptv_monthly_value, iptv_connections, iptv_expiry").eq("id", user_id).single();
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
          .neq("status", "reversed")
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
          for (const rate of (scheduledRates || [])) {
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
            notes: monthlyValue !== baseMonthlyValue ? `Reajuste: R$ ${monthlyValue.toFixed(2)}/tela` : "Fatura gerada automaticamente",
          });
        }

        // Only insert invoices that don't overlap with existing ones
        const { data: existing } = await supabaseAdmin
          .from("iptv_payments")
          .select("period_start, period_end")
          .eq("user_id", user_id)
          .neq("status", "reversed");

        const existingPeriods = (existing || []).map((e: any) => `${e.period_start}_${e.period_end}`);
        const newInvoices = invoices.filter((inv) => !existingPeriods.includes(`${inv.period_start}_${inv.period_end}`));

        if (newInvoices.length > 0) {
          await supabaseAdmin.from("iptv_payments").insert(newInvoices);
        }

        // Mark applied rates and update profile monthly value
        if (appliedRateIds.length > 0) {
          await supabaseAdmin.from("iptv_scheduled_rates").update({
            applied: true,
            applied_at: new Date().toISOString(),
          }).in("id", appliedRateIds);

          // Update the profile monthly value to the latest applied rate
          const latestApplied = (scheduledRates || [])
            .filter((r: any) => appliedRateIds.includes(r.id))
            .sort((a: any, b: any) => a.effective_date > b.effective_date ? -1 : 1)[0];
          if (latestApplied) {
            await supabaseAdmin.from("profiles").update({
              iptv_monthly_value: Number(latestApplied.new_monthly_value),
            }).eq("id", user_id);
          }
        }

        result = { success: true, generated: newInvoices.length, rates_applied: appliedRateIds.length };
        break;
      }
      case "mark_invoice_paid": {
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: invoice } = await supabaseAdmin
          .from("iptv_payments")
          .select("*")
          .eq("id", payment_id)
          .single();
        if (!invoice) throw new Error("Fatura não encontrada");

        // Mark as confirmed
        await supabaseAdmin.from("iptv_payments").update({
          status: "confirmed",
          admin_id: caller.id,
          payment_date: new Date().toISOString(),
        }).eq("id", payment_id);

        // Update expiry to this payment's period_end if it's further than current
        const { data: profile } = await supabaseAdmin.from("profiles").select("iptv_expiry").eq("id", user_id).single();
        const currentExpiry = profile?.iptv_expiry || "1970-01-01";
        if (invoice.period_end > currentExpiry) {
          await supabaseAdmin.from("profiles").update({
            iptv_expiry: invoice.period_end,
            iptv_status: "active",
          }).eq("id", user_id);
        }

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
        // Admin confirms a specific paid_pending_activation payment
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin
          .from("iptv_payments")
          .select("*")
          .eq("id", payment_id)
          .eq("status", "paid_pending_activation")
          .single();
        if (!payment) throw new Error("Pagamento não encontrado ou já confirmado");

        // Update payment status to confirmed (just update the existing row, no new lines)
        await supabaseAdmin.from("iptv_payments").update({
          status: "confirmed",
          admin_id: caller.id,
        }).eq("id", payment_id);

        // Set profile to active AND update expiry date from the payment's period_end
        await supabaseAdmin.from("profiles").update({
          iptv_status: "active",
          iptv_expiry: payment.period_end,
        }).eq("id", user_id);

        // Send push notifications based on DB rules for activation_confirmed
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          const { data: userProfile } = await supabaseAdmin.from("profiles").select("name, iptv_server, iptv_expiry").eq("id", user_id).single();
          const { data: rules } = await supabaseAdmin.from("notification_rules").select("*").eq("trigger_event", "activation_confirmed").eq("is_active", true);

          const templateVars: Record<string, string> = {
            "{nome}": userProfile?.name || "",
            "{validade}": payment.period_end ? payment.period_end.split("-").reverse().join("/") : "",
            "{valor}": Number(payment.amount).toFixed(2),
            "{servidor}": userProfile?.iptv_server || "",
            "{plano_meses}": String(payment.months || 1),
            "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),
          };

          for (const rule of (rules || [])) {
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

        result = { success: true };
        break;
      }
      case "remove_payment": {
        // Admin soft-removes a payment (hides from client, recalculates expiry)
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin
          .from("iptv_payments")
          .select("*")
          .eq("id", payment_id)
          .single();
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

        await supabaseAdmin.from("profiles").update({
          iptv_expiry: newExpiry,
          iptv_status: isExpired ? "blocked" : "active",
        }).eq("id", user_id);

        result = { success: true, new_status: newStatus };
        break;
      }
      case "add_scheduled_rate": {
        const { new_monthly_value, effective_date, notes: rateNotes } = data;
        if (!new_monthly_value || !effective_date) throw new Error("new_monthly_value e effective_date são obrigatórios");

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

        // Only delete pending invoices
        await supabaseAdmin.from("iptv_payments").delete().in("id", payment_ids).eq("status", "pending");
        result = { success: true, deleted: payment_ids.length };
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

        await supabaseAdmin.from("iptv_payments").update(allowed).in("id", payment_ids).eq("status", "pending");
        result = { success: true, updated: payment_ids.length };
        break;
      }
      case "bulk_add_scheduled_rates": {
        // Add the same scheduled rate to multiple users at once
        const { user_ids, new_monthly_value, effective_date, notes: bulkNotes } = data;
        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) throw new Error("user_ids é obrigatório");
        if (!new_monthly_value || !effective_date) throw new Error("new_monthly_value e effective_date são obrigatórios");

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
        const { data: prof } = await supabaseAdmin.from("profiles").select("iptv_monthly_value, iptv_connections, iptv_expiry").eq("id", user_id).single();
        if (!prof) throw new Error("Usuário não encontrado");

        // Delete all pending invoices for this user
        await supabaseAdmin.from("iptv_payments").delete().eq("user_id", user_id).eq("status", "pending");

        // Get scheduled rate changes
        const { data: ratesForRegen } = await supabaseAdmin
          .from("iptv_scheduled_rates")
          .select("*")
          .eq("user_id", user_id)
          .eq("applied", false)
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
          for (const rate of (ratesForRegen || [])) {
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

        if (appliedIds.length > 0) {
          await supabaseAdmin.from("iptv_scheduled_rates").update({
            applied: true,
            applied_at: new Date().toISOString(),
          }).in("id", appliedIds);

          const latestRate = (ratesForRegen || [])
            .filter((r: any) => appliedIds.includes(r.id))
            .sort((a: any, b: any) => a.effective_date > b.effective_date ? -1 : 1)[0];
          if (latestRate) {
            await supabaseAdmin.from("profiles").update({
              iptv_monthly_value: Number(latestRate.new_monthly_value),
            }).eq("id", user_id);
          }
        }

        result = { success: true, generated: newInvoices.length };
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
