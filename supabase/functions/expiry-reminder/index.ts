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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Calculate the date 5 days from now
    const today = new Date();
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const targetDate = fiveDaysFromNow.toISOString().split("T")[0];

    console.log(`[EXPIRY-REMINDER] Checking users expiring on ${targetDate}`);

    // Find active users whose iptv_expiry is exactly 5 days from now
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, name, iptv_expiry")
      .eq("iptv_status", "active")
      .eq("iptv_expiry", targetDate);

    if (error) throw error;

    if (!users || users.length === 0) {
      console.log("[EXPIRY-REMINDER] No users expiring in 5 days");
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[EXPIRY-REMINDER] Found ${users.length} users expiring on ${targetDate}`);

    let notified = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const expiryParts = user.iptv_expiry?.split("-");
        const expiryFormatted = expiryParts ? `${expiryParts[2]}/${expiryParts[1]}/${expiryParts[0]}` : user.iptv_expiry;

        await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-key": serviceKey },
          body: JSON.stringify({
            action: "send_to_user",
            user_id: user.id,
            title: "⚠️ Vencimento Próximo!",
            body: `Seu plano vence em ${expiryFormatted}. Renove agora para não perder o acesso!`,
            url: "/iptv",
          }),
        });

        notified++;
        console.log(`[EXPIRY-REMINDER] Notified user ${user.name} (${user.id})`);
      } catch (err) {
        failed++;
        console.error(`[EXPIRY-REMINDER] Failed for user ${user.id}:`, err);
      }
    }

    console.log(`[EXPIRY-REMINDER] Done: notified=${notified}, failed=${failed}`);
    return new Response(JSON.stringify({ success: true, notified, failed }), {
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
