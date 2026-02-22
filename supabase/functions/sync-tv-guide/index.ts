import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Program {
  start: string;
  end: string;
  name: string;
  category: string;
  highlight: boolean;
}

async function fetchScheduleFromAI(
  channelName: string,
  dateStr: string,
  dayOfWeekName: string,
  apiKey: string
): Promise<Program[]> {
  const prompt = `Você é um especialista em programação de TV aberta brasileira. Retorne a grade de programação REAL e ATUAL do canal "${channelName}" para ${dayOfWeekName}, dia ${dateStr}.

IMPORTANTE:
- Use a programação REAL e ATUALIZADA de 2025/2026 do canal
- Para a Globo, considere a afiliada de Goiás (TV Anhanguera)
- Inclua TODOS os programas do dia, desde o primeiro da madrugada/manhã até o último da noite
- Horários no formato HH:MM (24h)
- Categorias: Jornal, Novela, Variedades, Filme, Série, Esporte, Religioso, Infantil, Documentário
- Marque como highlight os programas mais populares/importantes do horário nobre e esportes ao vivo

Responda APENAS com um JSON array, sem markdown, sem explicação:
[{"start":"HH:MM","end":"HH:MM","name":"Nome do Programa","category":"Categoria","highlight":false}]`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error for ${channelName}: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  // Extract JSON from response (handle possible markdown wrapping)
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }
  
  const programs: Program[] = JSON.parse(jsonStr);
  
  if (!Array.isArray(programs) || programs.length === 0) {
    throw new Error(`No programs returned for ${channelName}`);
  }
  
  return programs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse optional body for force resync
    let forceResync = false;
    try {
      const body = await req.json();
      forceResync = body?.force === true;
    } catch { /* no body */ }

    // Get all active channels
    const { data: channels, error: chErr } = await supabase
      .from("tv_channels")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (chErr) throw chErr;
    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No channels found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BRT date
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = brt.toISOString().split("T")[0];

    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayOfWeek = brt.getUTCDay();
    const dayOfWeekName = dayNames[dayOfWeek];

    let totalInserted = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    for (const channel of channels) {
      try {
        // Check existing programs for today
        const { data: existing } = await supabase
          .from("tv_programs")
          .select("id")
          .eq("channel_id", channel.id)
          .eq("program_date", todayStr)
          .limit(1);

        // Skip if already synced (unless force)
        if (!forceResync && existing && existing.length > 0) {
          console.log(`[SYNC] ${channel.name} already synced for ${todayStr}, skipping.`);
          continue;
        }

        // Delete existing programs for this date if forcing resync
        if (forceResync && existing && existing.length > 0) {
          const { error: delErr, count } = await supabase
            .from("tv_programs")
            .delete()
            .eq("channel_id", channel.id)
            .eq("program_date", todayStr);
          
          if (delErr) console.error(`[SYNC] Error deleting ${channel.name}:`, delErr);
          else totalDeleted += count || 0;
        }

        console.log(`[SYNC] Fetching AI schedule for ${channel.name} (${dayOfWeekName}, ${todayStr})...`);
        
        const programs = await fetchScheduleFromAI(channel.name, todayStr, dayOfWeekName, apiKey);

        const rows = programs.map((p) => ({
          channel_id: channel.id,
          program_date: todayStr,
          start_time: p.start.length === 5 ? p.start + ":00" : p.start,
          end_time: p.end.length === 5 ? p.end + ":00" : p.end,
          name: p.name,
          category: p.category || "Geral",
          is_highlight: p.highlight || false,
          is_active: true,
        }));

        const { error: insertErr } = await supabase.from("tv_programs").insert(rows);
        if (insertErr) {
          console.error(`[SYNC] Error inserting for ${channel.name}:`, insertErr);
          errors.push(`${channel.name}: ${insertErr.message}`);
        } else {
          totalInserted += rows.length;
          console.log(`[SYNC] ${channel.name}: ${rows.length} programs inserted.`);
        }

        // Small delay between AI calls to avoid rate limits
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`[SYNC] Failed for ${channel.name}:`, err);
        errors.push(`${channel.name}: ${err.message}`);
      }
    }

    console.log(`[SYNC] Complete. Inserted: ${totalInserted}, Deleted: ${totalDeleted}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: todayStr,
        day: dayOfWeekName,
        inserted: totalInserted, 
        deleted: totalDeleted,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SYNC] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
