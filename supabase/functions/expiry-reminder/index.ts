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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load all active expiry_approaching rules
    const { data: rules } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("trigger_event", "expiry_approaching")
      .eq("is_active", true);

    if (!rules || rules.length === 0) {
      console.log("[EXPIRY-REMINDER] No active expiry_approaching rules");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNotified = 0;
    let totalFailed = 0;

    // Process each rule (each may have different days_before_expiry)
    for (const rule of rules) {
      const daysBefore = rule.conditions?.days_before_expiry || 5;

      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      console.log(`[EXPIRY-REMINDER] Rule "${rule.name}": checking users expiring on ${targetDateStr} (${daysBefore} days)`);

      const { data: users } = await supabase
        .from("profiles")
        .select("id, name, iptv_expiry, iptv_server")
        .eq("iptv_status", "active")
        .eq("iptv_expiry", targetDateStr);

      if (!users || users.length === 0) {
        console.log(`[EXPIRY-REMINDER] No users for rule "${rule.name}"`);
        continue;
      }

      console.log(`[EXPIRY-REMINDER] Found ${users.length} users for rule "${rule.name}"`);

      for (const user of users) {
        try {
          const templateVars: Record<string, string> = {
            "{nome}": user.name || "",
            "{validade}": user.iptv_expiry ? user.iptv_expiry.split("-").reverse().join("/") : "",
            "{servidor}": user.iptv_server || "",
            "{valor}": "",
            "{plano_meses}": "",
            "{data_pagamento}": "",
          };

          let title = rule.title_template;
          let body = rule.body_template;
          for (const [key, val] of Object.entries(templateVars)) {
            title = title.replaceAll(key, val);
            body = body.replaceAll(key, val);
          }

          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": serviceKey },
            body: JSON.stringify({
              action: "send_to_user",
              user_id: user.id,
              title, body, url: rule.click_url || "/iptv",
            }),
          });

          totalNotified++;
        } catch (err) {
          totalFailed++;
          console.error(`[EXPIRY-REMINDER] Failed for user ${user.id}:`, err);
        }
      }
    }

    console.log(`[EXPIRY-REMINDER] Done: notified=${totalNotified}, failed=${totalFailed}`);
    return new Response(JSON.stringify({ success: true, notified: totalNotified, failed: totalFailed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[EXPIRY-REMINDER] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
