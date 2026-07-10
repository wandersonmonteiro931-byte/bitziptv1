import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

const roundMoney = (v: number) => Math.round(v * 100) / 100;

const emitClientProfileUpdated = async (supabaseAdmin: any, userId: string, profilePatch: Record<string, any>) => {
  try {
    const channel = supabaseAdmin.channel(`wmcplayer-client-profile-${userId}`, {
      config: { broadcast: { self: true } },
    });

    await channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: "client-profile-updated",
          payload: {
            user_id: userId,
            sentAt: Date.now(),
            profile: profilePatch,
          },
        });

        await supabaseAdmin.removeChannel(channel);
      }
    });
  } catch (err) {
    console.warn("Falha ao enviar broadcast de perfil:", err instanceof Error ? err.message : String(err));
  }
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!;

    const supabaseAuth = createClient(supabaseUrl, (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, user_id, data } = body;

    // request_withdrawal does NOT require admin role — it's called by the user
    if (action === "request_withdrawal") {
      const { amount, pix_key } = data;
      if (!amount || !pix_key) throw new Error("amount e pix_key são obrigatórios");

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("balance, balance_frozen")
        .eq("id", user_id)
        .single();
      if (!profile) throw new Error("Usuário não encontrado");
      if (profile.balance_frozen) throw new Error("Saldo congelado. Saques bloqueados.");
      if (Number(profile.balance) < Number(amount)) throw new Error("Saldo insuficiente");
      if (Number(amount) < 30) throw new Error("Valor mínimo de R$ 30,00");

      await supabaseAdmin
        .from("profiles")
        .update({
          balance: roundMoney(Number(profile.balance) - Number(amount)),
        })
        .eq("id", user_id);

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

    // request_trust_unlock — called by the user (no admin role needed)
    if (action === "request_trust_unlock") {
      if (!user_id || user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check 30-day cooldown
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recentTrust } = await supabaseAdmin
        .from("iptv_trust_requests")
        .select("id")
        .eq("user_id", user_id)
        .in("status", ["approved", "expired"])
        .gte("requested_at", thirtyDaysAgo.toISOString())
        .limit(1)
        .maybeSingle();
      if (recentTrust) {
        return new Response(
          JSON.stringify({ error: "Você já utilizou o desbloqueio de confiança nos últimos 30 dias." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Check if there's already a pending request
      const { data: pendingReq } = await supabaseAdmin
        .from("iptv_trust_requests")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      if (pendingReq) {
        return new Response(JSON.stringify({ error: "Já existe uma solicitação pendente." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create trust request
      await supabaseAdmin.from("iptv_trust_requests").insert({
        user_id,
        status: "pending",
      });

      // Notify admins via push
      try {
        const { data: userProfile } = await supabaseAdmin.from("profiles").select("name").eq("id", user_id).single();
        const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
        for (const admin of adminRoles || []) {
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id: admin.user_id,
              title: "🤝 Solicitação de Confiança",
              body: `${userProfile?.name || "Cliente"} solicitou desbloqueio de confiança.`,
              url: "/admin/iptv",
            }),
          });
        }
      } catch (pushErr) {
        console.error("Failed to send trust request push:", pushErr);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (action) {
      case "update_profile": {
        // Fetch current profile to detect actual status changes
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles")
          .select("iptv_status, iptv_user, username")
          .eq("id", user_id)
          .single();
        const previousStatus = currentProfile?.iptv_status;

        const updateData = { ...(data || {}) };

        if (updateData.billing_due_date_id === "") {
          updateData.billing_due_date_id = null;
        }

        // REGRA FIXA: username/login sempre igual ao Usuário TV.
        if (typeof updateData.iptv_user === "string" && updateData.iptv_user.trim()) {
          const loginIdentifier = updateData.iptv_user.trim();
          updateData.username = loginIdentifier;

          const loginEmail = loginIdentifier.includes("@") ? loginIdentifier : `${loginIdentifier}@iptv.bitz`;
          const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            email: loginEmail,
            email_confirm: true,
          } as any);

          if (authEmailError) {
            throw new Error(`Erro ao atualizar login do cliente: ${authEmailError.message}`);
          }
        }

        const normalizeDateOnly = (value: any) => {
          const text = String(value || "").trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
          return text;
        };

        const getDayFromDateOnly = (value: string) => {
          const day = Number(String(value).split("-")[2] || 0);
          return Math.max(1, Math.min(31, day || 10));
        };

        const makeDueDate = (from: Date, dueDay: number) => {
          const y = from.getFullYear();
          const m = from.getMonth();
          const lastDay = new Date(y, m + 1, 0).getDate();
          let due = new Date(y, m, Math.min(dueDay, lastDay));

          if (due < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
            const next = new Date(y, m + 1, 1);
            const nextLastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
            due = new Date(next.getFullYear(), next.getMonth(), Math.min(dueDay, nextLastDay));
          }

          return due.toISOString().split("T")[0];
        };

        const explicitExpiry = normalizeDateOnly(updateData.iptv_expiry);

        // REGRA PRINCIPAL:
        // Se o admin digitou uma data exata, ela manda em todo o sistema.
        // Isso vale usando "padrão" ou uma data fixa selecionada.
        if (explicitExpiry) {
          updateData.iptv_expiry = explicitExpiry;
          updateData.iptv_due_day = getDayFromDateOnly(explicitExpiry);
        } else if (updateData.billing_due_date_id) {
          const { data: selectedDue } = await supabaseAdmin
            .from("billing_due_dates")
            .select("id, day_of_month")
            .eq("id", updateData.billing_due_date_id)
            .maybeSingle();

          if (selectedDue) {
            const day = Number(selectedDue.day_of_month);
            updateData.iptv_due_day = day;

            const now = new Date(`${brDateOnly(new Date())}T00:00:00`);
            const { data: profileBillingBase } = await supabaseAdmin
              .from("profiles")
              .select("iptv_expiry, billing_cycle_started_at, created_at")
              .eq("id", user_id)
              .maybeSingle();

            const baseDate = profileBillingBase?.iptv_expiry
              ? new Date(`${profileBillingBase.iptv_expiry}T00:00:00`)
              : profileBillingBase?.billing_cycle_started_at
                ? new Date(`${profileBillingBase.billing_cycle_started_at}T00:00:00`)
                : profileBillingBase?.created_at
                  ? new Date(profileBillingBase.created_at)
                  : now;

            updateData.iptv_expiry = makeDueDate(baseDate, day);
          }
        } else if (updateData.billing_due_date_id === "" || updateData.billing_due_date_id === undefined) {
          updateData.billing_due_date_id = null;
          if (updateData.iptv_due_day) {
            updateData.iptv_expiry = makeDueDate(new Date(`${brDateOnly(new Date())}T00:00:00`), Number(updateData.iptv_due_day));
          }
        }

        // REGRA FIXA: senha de login sempre igual à Senha TV.
        if (typeof updateData.iptv_password === "string" && updateData.iptv_password.trim()) {
          const { error: authPwdError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            password: updateData.iptv_password.trim(),
          });
          if (authPwdError) {
            throw new Error(`Erro ao atualizar senha do cliente: ${authPwdError.message}`);
          }
        }

        if (updateData.iptv_expiry) {
          updateData.billing_cycle_started_at = updateData.billing_cycle_started_at || brDateOnly(new Date());
        }

        const { error } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user_id);
        if (error) throw new Error(error.message);

        await emitClientProfileUpdated(supabaseAdmin, user_id, {
          iptv_expiry: updateData.iptv_expiry,
          iptv_due_day: updateData.iptv_due_day,
          billing_due_date_id: updateData.billing_due_date_id,
          billing_cycle_started_at: updateData.billing_cycle_started_at,
          billing_proportional_enabled: updateData.billing_proportional_enabled,
          iptv_monthly_value: updateData.iptv_monthly_value,
          iptv_connections: updateData.iptv_connections,
          iptv_status: updateData.iptv_status,
        });

        // When admin activates a user (sets status to active), also confirm pending activation payments
        if (data.iptv_status === "active") {
          await supabaseAdmin
            .from("iptv_payments")
            .update({ status: "confirmed", admin_id: caller.id })
            .eq("user_id", user_id)
            .eq("status", "paid_pending_activation");
        }

        // Send push notification ONLY when the status actually changed (not on regular edits)
        const statusActuallyChanged = data.iptv_status && data.iptv_status !== previousStatus;
        if (statusActuallyChanged && (data.iptv_status === "blocked" || data.iptv_status === "active")) {
          try {
            const triggerEvent = data.iptv_status === "blocked" ? "user_blocked" : "activation_confirmed";
            const { data: userProfile } = await supabaseAdmin
              .from("profiles")
              .select("name, iptv_server, iptv_expiry")
              .eq("id", user_id)
              .single();
            const { data: rules } = await supabaseAdmin
              .from("notification_rules")
              .select("*")
              .eq("trigger_event", triggerEvent)
              .eq("is_active", true);

            if (rules && rules.length > 0) {
              const templateVars: Record<string, string> = {
                "{nome}": userProfile?.name || "",
                "{validade}": userProfile?.iptv_expiry ? userProfile.iptv_expiry.split("-").reverse().join("/") : "",
                "{servidor}": userProfile?.iptv_server || "",
                "{valor}": "",
                "{plano_meses}": "",
                "{data_pagamento}": "",
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
                  body: JSON.stringify({
                    action: "send_to_user",
                    user_id,
                    title: t,
                    body: b,
                    url: rule.click_url || "/",
                  }),
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
      case "set_referrer_by_code": {
        const cleanCode = String(data?.referred_by_code || "")
          .trim()
          .toUpperCase();
        if (!cleanCode) throw new Error("Informe o código de indicação.");

        const { data: targetProfile, error: targetError } = await supabaseAdmin
          .from("profiles")
          .select("id, name, username, referred_by")
          .eq("id", user_id)
          .maybeSingle();

        if (targetError) throw new Error(targetError.message);
        if (!targetProfile) throw new Error("Cliente não encontrado.");

        const { data: referrer, error: referrerError } = await supabaseAdmin
          .from("profiles")
          .select("id, name, username, referral_code")
          .ilike("referral_code", cleanCode)
          .maybeSingle();

        if (referrerError) throw new Error(referrerError.message);
        if (!referrer) throw new Error("Código de indicação não encontrado.");
        if (referrer.id === user_id) throw new Error("O cliente não pode indicar ele mesmo.");

        const { data: existingBefore } = await supabaseAdmin
          .from("referrals")
          .select("id, status, referrer_id")
          .eq("referred_id", user_id)
          .neq("status", "rejected")
          .maybeSingle();

        if (targetProfile.referred_by || existingBefore) {
          result = {
            success: true,
            already_linked: true,
            referrer_id: targetProfile.referred_by || existingBefore?.referrer_id || null,
            message: "Este cliente já possui uma indicação vinculada.",
          };
          break;
        }

        // Atualiza o profile. Se o trigger SQL existir, ele já cria a linha em referrals automaticamente.
        const { error: updateErr } = await supabaseAdmin
          .from("profiles")
          .update({ referred_by: referrer.id })
          .eq("id", user_id);

        if (updateErr) throw new Error(updateErr.message);

        // Confere se o trigger criou a indicação. Se não criou, insere manualmente.
        const { data: existingAfter } = await supabaseAdmin
          .from("referrals")
          .select("id, status, referrer_id")
          .eq("referred_id", user_id)
          .neq("status", "rejected")
          .maybeSingle();

        if (!existingAfter) {
          const { error: referralErr } = await supabaseAdmin.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: user_id,
            reward_amount: 0,
            status: "pending",
            reward_type: "free_month",
            reward_months: 1,
            notes: "Indicação vinculada manualmente pelo admin. Aguardando o primeiro pagamento do indicado.",
          });

          if (referralErr) throw new Error(referralErr.message);
        }

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "set_referrer_by_code",
          target_table: "profiles",
          target_id: user_id,
          details: {
            referred_by_code: cleanCode,
            referrer_id: referrer.id,
            referrer_name: referrer.name || referrer.username || "",
          },
        });

        result = {
          success: true,
          referrer_id: referrer.id,
          referrer_name: referrer.name || referrer.username || "",
          referred_by_code: referrer.referral_code,
        };
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
        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_expiry: period_end,
            iptv_status: "active",
          })
          .eq("id", user_id);

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
          .in("iptv_status", ["active"]);

        // Also block trust_active users whose trust period expired
        const { data: expiredTrustUsers } = await supabaseAdmin
          .from("iptv_trust_requests")
          .select("user_id")
          .eq("status", "approved")
          .lt("trust_expires_at", today);

        const trustUserIds = (expiredTrustUsers || []).map((t: any) => t.user_id);
        if (trustUserIds.length > 0) {
          // Block these users and mark trust as expired
          for (const tuid of trustUserIds) {
            await supabaseAdmin
              .from("profiles")
              .update({ iptv_status: "blocked" })
              .eq("id", tuid)
              .eq("iptv_status", "trust_active");
            await supabaseAdmin
              .from("iptv_trust_requests")
              .update({ status: "expired" })
              .eq("user_id", tuid)
              .eq("status", "approved")
              .lt("trust_expires_at", today);
          }
        }

        const blocked: string[] = [];

        // Load user_blocked rules
        const { data: blockRules } = await supabaseAdmin
          .from("notification_rules")
          .select("*")
          .eq("trigger_event", "user_blocked")
          .eq("is_active", true);

        for (const u of expiredUsers || []) {
          await supabaseAdmin.from("profiles").update({ iptv_status: "blocked" }).eq("id", u.id);
          blocked.push(u.id);

          // Send block notification
          if (blockRules && blockRules.length > 0) {
            try {
              const templateVars: Record<string, string> = {
                "{nome}": u.name || "",
                "{validade}": u.iptv_expiry ? u.iptv_expiry.split("-").reverse().join("/") : "",
                "{servidor}": u.iptv_server || "",
                "{valor}": "",
                "{plano_meses}": "",
                "{data_pagamento}": "",
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
                  body: JSON.stringify({
                    action: "send_to_user",
                    user_id: u.id,
                    title: t,
                    body: b,
                    url: rule.click_url || "/iptv",
                  }),
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
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("balance, total_earned")
          .eq("id", user_id)
          .single();
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
      case "archive_user": {
        // Archive: set status to archived and ban auth user (force logout)
        await supabaseAdmin.from("profiles").update({ status: "archived", iptv_status: "disabled" }).eq("id", user_id);
        // Ban auth user to force logout
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "archive_user",
          target_table: "profiles",
          target_id: user_id,
          details: { archived_at: new Date().toISOString() },
        });

        result = { success: true };
        break;
      }
      case "reactivate_user": {
        // Reactivate: set status back to active and unban auth user
        await supabaseAdmin.from("profiles").update({ status: "active", iptv_status: "active" }).eq("id", user_id);
        // Unban auth user
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "reactivate_user",
          target_table: "profiles",
          target_id: user_id,
          details: { reactivated_at: new Date().toISOString() },
        });

        result = { success: true };
        break;
      }
      case "delete_user": {
        // Nunca deixar perfil excluído aparecendo nas telas administrativas de TV.
        await supabaseAdmin
          .from("profiles")
          .update({ status: "deleted", iptv_status: "disabled" })
          .eq("id", user_id);

        try {
          await supabaseAdmin.auth.admin.deleteUser(user_id);
        } catch (deleteError) {
          console.warn("Auth delete falhou, mas perfil foi marcado como deleted:", deleteError);
        }

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "delete_user",
          target_table: "profiles",
          target_id: user_id,
          details: { deleted_at: new Date().toISOString() },
        });

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
        const { data: withdrawal } = await supabaseAdmin
          .from("withdrawals")
          .select("*")
          .eq("id", withdrawal_id)
          .single();
        if (!withdrawal) throw new Error("Saque não encontrado");
        if (withdrawal.status !== "pending") throw new Error("Saque já foi processado");

        await supabaseAdmin
          .from("withdrawals")
          .update({
            status,
            admin_notes: admin_notes || "",
            processed_at: new Date().toISOString(),
          })
          .eq("id", withdrawal_id);

        if (status === "approved") {
          await supabaseAdmin.from("balance_history").insert({
            user_id: withdrawal.user_id,
            type: "withdrawal",
            amount: Number(withdrawal.amount),
            description: `Saque aprovado - PIX: ${withdrawal.pix_key}`,
            admin_id: caller.id,
          });
        } else if (status === "rejected") {
          const { data: wProfile } = await supabaseAdmin
            .from("profiles")
            .select("balance")
            .eq("id", withdrawal.user_id)
            .single();
          if (wProfile) {
            await supabaseAdmin
              .from("profiles")
              .update({
                balance: roundMoney(Number(wProfile.balance) + Number(withdrawal.amount)),
              })
              .eq("id", withdrawal.user_id);
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
      case "register_manual_payment": {
        // Register a historical/manual payment record WITHOUT changing iptv_expiry or iptv_status
        const {
          amount: manualAmount,
          payment_date: manualDate,
          notes: manualNotes,
          period_start: manualStart,
          period_end: manualEnd,
        } = data;
        if (!manualAmount || !manualDate || !manualStart || !manualEnd) {
          throw new Error("amount, payment_date, period_start e period_end são obrigatórios");
        }

        await supabaseAdmin.from("iptv_payments").insert({
          user_id,
          amount: roundMoney(Number(manualAmount)),
          months: 1,
          period_start: manualStart,
          period_end: manualEnd,
          status: "confirmed",
          payment_method: "manual",
          payment_date: `${manualDate}T12:00:00`,
          admin_id: caller.id,
          notes: manualNotes || "Registro manual",
        });

        await supabaseAdmin.from("balance_history").insert({
          user_id,
          type: "payment",
          amount: roundMoney(Number(manualAmount)),
          description: `Pagamento registrado manualmente — R$ ${roundMoney(Number(manualAmount)).toFixed(2)} (${manualStart} a ${manualEnd})`,
          admin_id: caller.id,
        });

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: caller.id,
          action: "register_manual_payment",
          target_table: "iptv_payments",
          target_id: user_id,
          details: {
            amount: manualAmount,
            payment_date: manualDate,
            period_start: manualStart,
            period_end: manualEnd,
            notes: manualNotes,
          },
        });

        result = { success: true };
        break;
      }
      case "reverse_payment": {
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: payment } = await supabaseAdmin.from("iptv_payments").select("*").eq("id", payment_id).single();
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

          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_expiry: newExpiry,
              iptv_status: isExpired ? "blocked" : "active",
            })
            .eq("id", user_id);

          await supabaseAdmin.from("balance_history").insert({
            user_id,
            type: "reversal",
            amount: Number(payment.amount),
            description: `Pagamento revertido pelo admin — R$ ${Number(payment.amount).toFixed(2)}`,
            admin_id: caller.id,
          });
        } else {
          // Re-confirming: restore expiry from this payment
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_expiry: payment.period_end,
              iptv_status: "active",
            })
            .eq("id", user_id);

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
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("iptv_monthly_value, iptv_connections, iptv_expiry")
          .eq("id", user_id)
          .single();
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
          .not("status", "in", "(reversed,removed,pix_pending)")
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
          for (const rate of scheduledRates || []) {
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
            notes:
              monthlyValue !== baseMonthlyValue
                ? `Reajuste: R$ ${monthlyValue.toFixed(2)}/tela`
                : "Fatura gerada automaticamente",
          });
        }

        // Only insert invoices that don't overlap with existing ones
        const { data: existing } = await supabaseAdmin
          .from("iptv_payments")
          .select("period_start, period_end")
          .eq("user_id", user_id)
          .not("status", "in", "(reversed,removed,pix_pending)");

        const existingPeriods = (existing || []).map((e: any) => `${e.period_start}_${e.period_end}`);
        const newInvoices = invoices.filter(
          (inv) => !existingPeriods.includes(`${inv.period_start}_${inv.period_end}`),
        );

        if (newInvoices.length > 0) {
          await supabaseAdmin.from("iptv_payments").insert(newInvoices);
        }

        // Mark applied rates and update profile monthly value
        if (appliedRateIds.length > 0) {
          await supabaseAdmin
            .from("iptv_scheduled_rates")
            .update({
              applied: true,
              applied_at: new Date().toISOString(),
            })
            .in("id", appliedRateIds);

          // Update the profile monthly value to the latest applied rate
          const latestApplied = (scheduledRates || [])
            .filter((r: any) => appliedRateIds.includes(r.id))
            .sort((a: any, b: any) => (a.effective_date > b.effective_date ? -1 : 1))[0];
          if (latestApplied) {
            await supabaseAdmin
              .from("profiles")
              .update({
                iptv_monthly_value: Number(latestApplied.new_monthly_value),
              })
              .eq("id", user_id);
          }
        }

        result = { success: true, generated: newInvoices.length, rates_applied: appliedRateIds.length };
        break;
      }
      case "mark_invoice_paid": {
        const { payment_id } = data;
        if (!payment_id) throw new Error("payment_id é obrigatório");

        const { data: invoice } = await supabaseAdmin.from("iptv_payments").select("*").eq("id", payment_id).single();
        if (!invoice) throw new Error("Fatura não encontrada");

        // Mark as confirmed
        await supabaseAdmin
          .from("iptv_payments")
          .update({
            status: "confirmed",
            admin_id: caller.id,
            payment_date: new Date().toISOString(),
          })
          .eq("id", payment_id);

        // Update profile every time the admin gives baixa, so admin/client panels refresh immediately.
        const { data: profile } = await supabaseAdmin.from("profiles").select("iptv_expiry").eq("id", user_id).single();
        const currentExpiry = profile?.iptv_expiry || "1970-01-01";
        const nextExpiry = invoice.period_end > currentExpiry ? invoice.period_end : currentExpiry;
        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_expiry: nextExpiry,
            iptv_status: "active",
          })
          .eq("id", user_id);

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
        await supabaseAdmin
          .from("iptv_payments")
          .update({
            status: "confirmed",
            admin_id: caller.id,
          })
          .eq("id", payment_id);

        // Set profile to active AND update expiry date from the payment's period_end
        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_status: "active",
            iptv_expiry: payment.period_end,
          })
          .eq("id", user_id);

        // Send push notifications based on DB rules for activation_confirmed
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!;

          const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("name, iptv_server, iptv_expiry")
            .eq("id", user_id)
            .single();
          const { data: rules } = await supabaseAdmin
            .from("notification_rules")
            .select("*")
            .eq("trigger_event", "activation_confirmed")
            .eq("is_active", true);

          const templateVars: Record<string, string> = {
            "{nome}": userProfile?.name || "",
            "{validade}": payment.period_end ? payment.period_end.split("-").reverse().join("/") : "",
            "{valor}": Number(payment.amount).toFixed(2),
            "{servidor}": userProfile?.iptv_server || "",
            "{plano_meses}": String(payment.months || 1),
            "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),
          };

          for (const rule of rules || []) {
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

        const { data: payment } = await supabaseAdmin.from("iptv_payments").select("*").eq("id", payment_id).single();
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

        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_expiry: newExpiry,
            iptv_status: isExpired ? "blocked" : "active",
          })
          .eq("id", user_id);

        result = { success: true, new_status: newStatus };
        break;
      }
      case "add_scheduled_rate": {
        const { new_monthly_value, effective_date, notes: rateNotes } = data;
        if (!new_monthly_value || !effective_date)
          throw new Error("new_monthly_value e effective_date são obrigatórios");

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

        // Only delete real pending invoices for this user (not hidden PIX charges)
        const { data: deletedRows, error: deleteError } = await supabaseAdmin
          .from("iptv_payments")
          .delete()
          .eq("user_id", user_id)
          .in("id", payment_ids)
          .eq("status", "pending")
          .select("id");
        if (deleteError) throw deleteError;
        result = { success: true, deleted: deletedRows?.length || 0 };
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

        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from("iptv_payments")
          .update(allowed)
          .eq("user_id", user_id)
          .in("id", payment_ids)
          .eq("status", "pending")
          .select("id");
        if (updateError) throw updateError;
        result = { success: true, updated: updatedRows?.length || 0 };
        break;
      }
      case "bulk_add_scheduled_rates": {
        // Add the same scheduled rate to multiple users at once
        const { user_ids, new_monthly_value, effective_date, notes: bulkNotes } = data;
        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) throw new Error("user_ids é obrigatório");
        if (!new_monthly_value || !effective_date)
          throw new Error("new_monthly_value e effective_date são obrigatórios");

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
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("iptv_monthly_value, iptv_connections, iptv_expiry")
          .eq("id", user_id)
          .single();
        if (!prof) throw new Error("Usuário não encontrado");

        // Delete all pending invoices for this user
        await supabaseAdmin.from("iptv_payments").delete().eq("user_id", user_id).eq("status", "pending");

        // Get ALL scheduled rate changes (including already applied)
        const { data: ratesForRegen } = await supabaseAdmin
          .from("iptv_scheduled_rates")
          .select("*")
          .eq("user_id", user_id)
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
          for (const rate of ratesForRegen || []) {
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

        // Only mark newly-applied rates (skip already applied ones)
        const newlyAppliedIds = appliedIds.filter((id) => {
          const r = (ratesForRegen || []).find((rate: any) => rate.id === id);
          return r && !r.applied;
        });
        if (newlyAppliedIds.length > 0) {
          await supabaseAdmin
            .from("iptv_scheduled_rates")
            .update({
              applied: true,
              applied_at: new Date().toISOString(),
            })
            .in("id", newlyAppliedIds);
        }

        if (appliedIds.length > 0) {
          const latestRate = (ratesForRegen || [])
            .filter((r: any) => appliedIds.includes(r.id))
            .sort((a: any, b: any) => (a.effective_date > b.effective_date ? -1 : 1))[0];
          if (latestRate) {
            await supabaseAdmin
              .from("profiles")
              .update({
                iptv_monthly_value: Number(latestRate.new_monthly_value),
              })
              .eq("id", user_id);
          }
        }

        result = { success: true, generated: newInvoices.length };
        break;
      }
      case "approve_trust_unlock": {
        const { request_id } = data;
        if (!request_id) throw new Error("request_id é obrigatório");

        const { data: trustReq } = await supabaseAdmin
          .from("iptv_trust_requests")
          .select("*")
          .eq("id", request_id)
          .eq("status", "pending")
          .single();
        if (!trustReq) throw new Error("Solicitação não encontrada ou já processada");

        const trustExpires = new Date();
        trustExpires.setDate(trustExpires.getDate() + 3);
        const trustExpiresStr = trustExpires.toISOString().split("T")[0];

        // Update trust request
        await supabaseAdmin
          .from("iptv_trust_requests")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: caller.id,
            trust_expires_at: trustExpiresStr,
          })
          .eq("id", request_id);

        // Update user status to trust_active (don't change iptv_expiry)
        await supabaseAdmin
          .from("profiles")
          .update({
            iptv_status: "trust_active",
          })
          .eq("id", trustReq.user_id);

        // Notify user
        try {
          const { data: userProfile } = await supabaseAdmin
            .from("profiles")
            .select("name")
            .eq("id", trustReq.user_id)
            .single();
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id: trustReq.user_id,
              title: "✅ Confiança Aprovada",
              body: `Seu acesso foi liberado por 3 dias. Efetue o pagamento até ${trustExpiresStr.split("-").reverse().join("/")} para evitar o bloqueio definitivo.`,
              url: "/",
            }),
          });
        } catch (pushErr) {
          console.error("Failed to send trust approval push:", pushErr);
        }

        result = { success: true };
        break;
      }
      case "reject_trust_unlock": {
        const { request_id } = data;
        if (!request_id) throw new Error("request_id é obrigatório");

        await supabaseAdmin
          .from("iptv_trust_requests")
          .update({
            status: "rejected",
            approved_by: caller.id,
            notes: data.notes || "Rejeitado pelo administrador",
          })
          .eq("id", request_id)
          .eq("status", "pending");

        // Notify user
        try {
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id,
              title: "❌ Confiança Negada",
              body: "Sua solicitação de desbloqueio de confiança foi recusada. Entre em contato com o suporte.",
              url: "/",
            }),
          });
        } catch (pushErr) {
          console.error("Failed to send trust rejection push:", pushErr);
        }

        result = { success: true };
        break;
      }
      case "activate_server_event": {
        // Bulk change all active/trust_active users to maintenance or unstable
        const eventType = data.event_type; // "maintenance" or "unstable"
        if (!["maintenance", "unstable"].includes(eventType))
          throw new Error("event_type deve ser 'maintenance' ou 'unstable'");

        // Get all users whose status is NOT already maintenance/unstable/blocked/disabled
        const { data: affectedUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, name, iptv_status")
          .in("iptv_status", ["active", "trust_active", "awaiting_payment"]);

        let changed = 0;
        for (const u of affectedUsers || []) {
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_status_before_event: u.iptv_status,
              iptv_status: eventType,
            })
            .eq("id", u.id);
          changed++;
        }

        // Send push notification to all affected users
        const eventLabel = eventType === "maintenance" ? "Manutenção" : "Instabilidade";
        const durationText = data.duration_minutes ? ` Previsão: ${data.duration_minutes} minutos.` : "";
        try {
          for (const u of affectedUsers || []) {
            await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
              body: JSON.stringify({
                action: "send_to_user",
                user_id: u.id,
                title: eventType === "maintenance" ? "🔧 Servidor em Manutenção" : "⚠️ Instabilidade no Servidor",
                body: `O servidor está em ${eventLabel.toLowerCase()}.${durationText} Pedimos desculpas pelo inconveniente.`,
                url: "/",
              }),
            });
          }
        } catch (pushErr) {
          console.error("Failed to send server event push:", pushErr);
        }

        result = { success: true, affected_count: changed };
        break;
      }
      case "deactivate_server_event": {
        // Restore previous status for all users affected by maintenance/unstable
        const eventType = data.event_type; // "maintenance" or "unstable"
        if (!["maintenance", "unstable"].includes(eventType))
          throw new Error("event_type deve ser 'maintenance' ou 'unstable'");

        const { data: affectedUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, name, iptv_status_before_event")
          .eq("iptv_status", eventType);

        let restored = 0;
        for (const u of affectedUsers || []) {
          const previousStatus = u.iptv_status_before_event || "active";
          await supabaseAdmin
            .from("profiles")
            .update({
              iptv_status: previousStatus,
              iptv_status_before_event: "",
            })
            .eq("id", u.id);
          restored++;
        }

        // Send push notification
        const eventLabel = eventType === "maintenance" ? "Manutenção" : "Instabilidade";
        try {
          for (const u of affectedUsers || []) {
            await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-key": supabaseServiceKey },
              body: JSON.stringify({
                action: "send_to_user",
                user_id: u.id,
                title: eventType === "maintenance" ? "✅ Manutenção Concluída" : "✅ Instabilidade Resolvida",
                body: `A ${eventLabel.toLowerCase()} foi finalizada. Seu acesso foi restabelecido. Obrigado pela compreensão!`,
                url: "/",
              }),
            });
          }
        } catch (pushErr) {
          console.error("Failed to send server event resolution push:", pushErr);
        }

        result = { success: true, restored_count: restored };
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
