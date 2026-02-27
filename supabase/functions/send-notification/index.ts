import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Profile {
  id: string;
  name: string;
  iptv_expiry: string | null;
  iptv_monthly_value: number;
  iptv_tv_app: string;
  iptv_server: string;
  iptv_status: string;
  iptv_due_day: number;
}

function resolveVariables(
  template: string,
  profile: Profile,
  extras: {
    supportName: string;
    livePrograms: Record<string, string>;
    dicaTarde: string;
    dicaSemana: string;
    customVars: { var_key: string; default_value: string }[];
  }
): string {
  const today = new Date();
  const firstName = (profile.name || "").split(" ")[0];
  const fullName = profile.name || "";

  // Format expiry
  const expiryDate = profile.iptv_expiry
    ? profile.iptv_expiry.split("-").reverse().join("/")
    : "";

  // Calculate days until expiry
  let faltaDias = "";
  if (profile.iptv_expiry) {
    const exp = new Date(profile.iptv_expiry + "T00:00:00");
    const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    faltaDias = String(diff);
  }

  // Current month name in Portuguese
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const mesAtual = meses[today.getMonth()];

  // Today formatted
  const hojeStr = today.toLocaleDateString("pt-BR");

  // Status translation
  const statusMap: Record<string, string> = {
    active: "Ativo",
    disabled: "Desativado",
    blocked: "Bloqueado",
    suspended: "Suspenso",
  };

  const vars: Record<string, string> = {
    "{nome}": firstName,
    "{user}": fullName,
    "{venc}": expiryDate,
    "{valor}": `R$ ${Number(profile.iptv_monthly_value || 0).toFixed(2).replace(".", ",")}`,
    "{app}": profile.iptv_tv_app || "",
    "{hoje}": hojeStr,
    "{mês}": mesAtual,
    "{serv}": profile.iptv_server || "",
    "{status}": statusMap[profile.iptv_status] || profile.iptv_status || "",
    "{próx}": expiryDate,
    "{sbt}": extras.livePrograms["SBT"] || "",
    "{globo}": extras.livePrograms["Globo"] || extras.livePrograms["TV Anhanguera"] || "",
    "{record}": extras.livePrograms["Record"] || extras.livePrograms["Record TV"] || "",
    "{band}": extras.livePrograms["Band"] || extras.livePrograms["Band TV"] || "",
    "{redetv}": extras.livePrograms["RedeTV!"] || extras.livePrograms["RedeTV"] || "",
    "{dicadatarde}": extras.dicaTarde,
    "{dicadasemana}": extras.dicaSemana,
    "{suporte}": extras.supportName,
    "{faltadias}": faltaDias,
  };

  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(key, val);
  }
  // Also handle {mês) typo variant
  result = result.replaceAll("{mês)", mesAtual);
  // Resolve custom variables
  for (const cv of extras.customVars) {
    result = result.replaceAll(`{${cv.var_key}}`, cv.default_value || "");
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { notification_id } = body;

    if (!notification_id) throw new Error("notification_id obrigatório");

    // Load notification
    const { data: notif, error: notifErr } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("id", notification_id)
      .single();

    if (notifErr || !notif) throw new Error("Notificação não encontrada");

    // Load target profiles
    let profilesQuery = supabase
      .from("profiles")
      .select("id, name, iptv_expiry, iptv_monthly_value, iptv_tv_app, iptv_server, iptv_status, iptv_due_day");

    if (notif.target_type === "specific" && notif.target_ids?.length > 0) {
      profilesQuery = profilesQuery.in("id", notif.target_ids);
    }

    const { data: profiles } = await profilesQuery;
    if (!profiles || profiles.length === 0) {
      await supabase.from("scheduled_notifications").update({ status: "sent", sent_at: new Date().toISOString(), sent_count: 0 }).eq("id", notification_id);
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load extras: support name, live programs, content highlights
    // Use BRT timezone (UTC-3) for correct TV schedule matching
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const currentTime = `${String(brt.getUTCHours()).padStart(2, "0")}:${String(brt.getUTCMinutes()).padStart(2, "0")}:00`;
    const todayStr = brt.toISOString().split("T")[0];
    
    console.log(`[SEND-NOTIF] BRT time: ${currentTime}, date: ${todayStr}`);

    const [supportRes, channelsRes, programsRes, nextProgramsRes, contentRes, customVarsRes] = await Promise.all([
      supabase.from("support_settings").select("support_name").limit(1).maybeSingle(),
      supabase.from("tv_channels").select("id, name").eq("is_active", true),
      // Current live programs (started before now)
      supabase.from("tv_programs").select("name, channel_id, start_time, end_time")
        .eq("program_date", todayStr)
        .eq("is_active", true)
        .lte("start_time", currentTime),
      // Next upcoming programs (starting after now) - fallback
      supabase.from("tv_programs").select("name, channel_id, start_time, end_time")
        .eq("program_date", todayStr)
        .eq("is_active", true)
        .gt("start_time", currentTime)
        .order("start_time", { ascending: true }),
      supabase.from("content").select("title, content_type, target_audience")
        .eq("is_active", true)
        .in("target_audience", ["all", "highlight_tarde", "highlight_semana"]),
      supabase.from("custom_variables").select("var_key, default_value").eq("is_active", true),
    ]);

    const supportName = supportRes.data?.support_name || "";

    // Build live programs map
    const channelMap: Record<string, string> = {};
    (channelsRes.data || []).forEach((ch: any) => { channelMap[ch.id] = ch.name; });

    const livePrograms: Record<string, string> = {};
    
    // First: currently airing programs
    (programsRes.data || []).forEach((p: any) => {
      const chName = channelMap[p.channel_id] || "";
      const endTime = p.end_time === "00:00:00" ? "24:00:00" : p.end_time;
      if (chName && endTime >= currentTime) {
        livePrograms[chName] = p.name;
      }
    });

    // Fallback: if a channel has no live program, use the next upcoming one
    (nextProgramsRes.data || []).forEach((p: any) => {
      const chName = channelMap[p.channel_id] || "";
      if (chName && !livePrograms[chName]) {
        livePrograms[chName] = p.name;
      }
    });
    
    console.log(`[SEND-NOTIF] Live programs found:`, JSON.stringify(livePrograms));

    // Content highlights
    let dicaTarde = "";
    let dicaSemana = "";
    (contentRes.data || []).forEach((c: any) => {
      if (c.target_audience === "highlight_tarde") dicaTarde = c.title;
      if (c.target_audience === "highlight_semana") dicaSemana = c.title;
    });

    const extras = { supportName, livePrograms, dicaTarde, dicaSemana, customVars: customVarsRes.data || [] };

    // Determine click URL — append notif_id for banner/popup deep-linking
    let clickUrl = notif.click_action || "/";
    if (notif.click_banner_id || notif.click_text_body) {
      const separator = clickUrl.includes("?") ? "&" : "?";
      clickUrl = `${clickUrl}${separator}notif_id=${notification_id}`;
    }

    // Send to each user
    let totalSent = 0;
    let totalFailed = 0;

    for (const profile of profiles) {
      const title = resolveVariables(notif.title_template, profile, extras);
      const bodyText = resolveVariables(notif.body_template, profile, extras);

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-key": serviceKey },
          body: JSON.stringify({
            action: "send_to_user",
            user_id: profile.id,
            title,
            body: bodyText,
            url: clickUrl,
          }),
        });
        const result = await resp.json();
        totalSent += result.sent || 0;
        totalFailed += result.failed || 0;
      } catch (err) {
        totalFailed++;
        console.error(`[SEND-NOTIF] Failed for ${profile.id}:`, err);
      }
    }

    // Update notification status
    await supabase.from("scheduled_notifications").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_count: totalSent,
      failed_count: totalFailed,
    }).eq("id", notification_id);

    console.log(`[SEND-NOTIF] Done: sent=${totalSent}, failed=${totalFailed}`);
    return new Response(JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[SEND-NOTIF] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
