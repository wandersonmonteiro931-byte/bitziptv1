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

// Map channel names to tvinside slugs
const CHANNEL_SLUGS: Record<string, string> = {
  "Globo": "globo",
  "SBT": "sbt",
  "Record": "record_tv",
  "Band": "band",
  "RedeTV!": "rede_tv",
};

const DAY_SLUGS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("jornal") || lower.includes("notícia")) return "Jornal";
  if (lower.includes("novela") || lower.includes("soap")) return "Novela";
  if (lower.includes("filme") || lower.includes("film")) return "Filme";
  if (lower.includes("série") || lower.includes("serie")) return "Série";
  if (lower.includes("esporte") || lower.includes("sport")) return "Esporte";
  if (lower.includes("infantil") || lower.includes("children")) return "Infantil";
  if (lower.includes("religios")) return "Religioso";
  if (lower.includes("documentário") || lower.includes("document")) return "Documentário";
  if (lower.includes("variedade") || lower.includes("variety")) return "Variedades";
  return "Geral";
}

function parseScheduleFromHTML(html: string): Program[] {
  const programs: Program[] = [];
  const lines = html.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match time patterns: "06:00" or "00:05(23/02)"
    const timeMatch = line.match(/^(\d{2}:\d{2})(?:\(\d{2}\/\d{2}\))?$/);
    
    if (timeMatch) {
      const time = timeMatch[1];
      // Next non-empty line should be the program info
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      
      if (j < lines.length) {
        let text = lines[j].trim();
        
        // Skip invalid entries
        if (!text || text === "•" || text === "&bull;" || text.length < 3 || /^\d+$/.test(text) || /^\(\d{2}\/\d{2}\)$/.test(text)) {
          continue;
        }
        
        // Skip lines that are just more times or date refs like "(23/02)"
        if (/^\d{2}:\d{2}/.test(text)) continue;
        
        let category = "Geral";
        let name = text;
        
        // Split name from category - tvinside concatenates like "Domingo LegalVariedades • Livre"
        // Only split if the category word is NOT part of the program name
        // Use a smarter approach: look for category words that follow a lowercase letter directly with uppercase
        const catPatterns = ["Variedades", "Filme", "Esporte", "Série", "Documentário", "Jornal", "Infantil", "Religioso"];
        for (const cat of catPatterns) {
          // Find category that appears after a lowercase letter (concatenated without space)
          const regex = new RegExp(`([a-záàâãéèêíóôõúç])${cat}`, "i");
          const match = name.match(regex);
          if (match) {
            const idx = name.indexOf(match[0]);
            category = cat;
            name = name.substring(0, idx + 1).trim(); // keep the last char of the name
            break;
          }
        }
        
        // Clean up classification info like "• Livre", "• 10 anos"  
        name = name.replace(/\s*•.*$/, "").replace(/&bull;/g, "").trim();
        
        // Skip if name ended up empty or too short
        if (!name || name.length < 2) continue;
        
        const hour = parseInt(time.split(":")[0]);
        const isHighlight = (hour >= 19 && hour < 23) || 
                            category === "Esporte" ||
                            name.toLowerCase().includes("futebol");
        
        programs.push({
          start: time,
          end: "00:00", // fixed below
          name,
          category,
          highlight: isHighlight,
        });
      }
    }
  }
  
  // Fix end times
  for (let k = 0; k < programs.length; k++) {
    if (k + 1 < programs.length) {
      programs[k].end = programs[k + 1].start;
    } else {
      const [h] = programs[k].start.split(":").map(Number);
      programs[k].end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:00`;
    }
  }
  
  // Deduplicate by start time (keep first occurrence)
  const seen = new Set<string>();
  const unique: Program[] = [];
  for (const p of programs) {
    const key = `${p.start}-${p.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  
  return unique;
}



async function fetchScheduleFromWeb(channelName: string, slug: string): Promise<Program[]> {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const daySlug = DAY_SLUGS[brt.getUTCDay()];
  
  const url = `https://tvinside.com.br/programacao_tv/${slug}/${daySlug}`;
  console.log(`[SYNC] Fetching real schedule from ${url}...`);
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tvinside for ${channelName}: ${response.status}`);
  }

  const html = await response.text();
  
  // Remove HTML tags but keep structure
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(div|p|h[1-6]|li|tr|td|th|section|article|header|footer|nav|span|a|img|ul|ol|table|tbody|thead)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&bull;/g, "•")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n{3,}/g, "\n\n");
  
  const programs = parseScheduleFromHTML(text);
  
  if (programs.length === 0) {
    throw new Error(`No programs parsed for ${channelName} from tvinside`);
  }
  
  console.log(`[SYNC] Parsed ${programs.length} programs for ${channelName}: ${programs.map(p => p.name).join(", ")}`);
  return programs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let forceResync = false;
    try {
      const body = await req.json();
      forceResync = body?.force === true;
    } catch { /* no body */ }

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

    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = brt.toISOString().split("T")[0];
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayOfWeekName = dayNames[brt.getUTCDay()];

    let totalInserted = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    for (const channel of channels) {
      try {
        const slug = CHANNEL_SLUGS[channel.name];
        if (!slug) {
          console.log(`[SYNC] No slug for ${channel.name}, skipping.`);
          continue;
        }

        const { data: existing } = await supabase
          .from("tv_programs")
          .select("id")
          .eq("channel_id", channel.id)
          .eq("program_date", todayStr)
          .limit(1);

        if (!forceResync && existing && existing.length > 0) {
          console.log(`[SYNC] ${channel.name} already synced for ${todayStr}, skipping.`);
          continue;
        }

        if (forceResync && existing && existing.length > 0) {
          const { error: delErr, count } = await supabase
            .from("tv_programs")
            .delete()
            .eq("channel_id", channel.id)
            .eq("program_date", todayStr);
          if (delErr) console.error(`[SYNC] Error deleting ${channel.name}:`, delErr);
          else totalDeleted += count || 0;
        }

        const programs = await fetchScheduleFromWeb(channel.name, slug);

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
          console.log(`[SYNC] ${channel.name}: ${rows.length} REAL programs inserted.`);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[SYNC] Failed for ${channel.name}:`, err);
        errors.push(`${channel.name}: ${err.message}`);
      }
    }

    console.log(`[SYNC] Complete. Inserted: ${totalInserted}, Deleted: ${totalDeleted}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ success: true, date: todayStr, day: dayOfWeekName, inserted: totalInserted, deleted: totalDeleted, errors: errors.length > 0 ? errors : undefined }),
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
