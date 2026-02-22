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
  "Record": "rede_record",
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
  
  // Use global regex to find ALL <time> tags and extract nearby <span class="titulo">
  const timeRegex = /<time[^>]*>(\d{2}:\d{2})<\/time>/gi;
  let timeMatch;
  const timePositions: { time: string; index: number }[] = [];
  
  while ((timeMatch = timeRegex.exec(html)) !== null) {
    timePositions.push({ time: timeMatch[1], index: timeMatch.index });
  }
  
  for (let i = 0; i < timePositions.length; i++) {
    const startIdx = timePositions[i].index;
    const endIdx = i + 1 < timePositions.length ? timePositions[i + 1].index : startIdx + 2000;
    const segment = html.substring(startIdx, endIdx);
    
    const titleMatch = segment.match(/<span[^>]*class="titulo"[^>]*>([\s\S]*?)<\/span>/i);
    if (!titleMatch) continue;
    
    const time = timePositions[i].time;
    let name = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    if (!name || name.length < 2) continue;
    
    let category = "Geral";
    const smallMatch = segment.match(/<small>([\s\S]*?)<\/small>/i);
    if (smallMatch) {
      const smallText = smallMatch[1].replace(/<[^>]+>/g, "").trim();
      category = mapCategory(smallText);
    }
    
    const hour = parseInt(time.split(":")[0]);
    const isHighlight = (hour >= 19 && hour < 23) || 
                        category === "Esporte" ||
                        name.toLowerCase().includes("futebol");
    
    programs.push({ start: time, end: "00:00", name, category, highlight: isHighlight });
  }
  
  // If structured parsing failed, fall back to text-based parsing
  if (programs.length === 0) {
    return parseScheduleFromText(html);
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
  
  // Deduplicate
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

function parseScheduleFromText(html: string): Program[] {
  const programs: Program[] = [];
  const text = stripHtml(html);
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = line.match(/^(\d{2}:\d{2})(?:NO AR)?(?:\(\d{2}\/\d{2}\))?\s*$/);
    
    if (timeMatch) {
      const time = timeMatch[1];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      
      if (j < lines.length) {
        let text = lines[j].trim();
        
        if (!text || text === "•" || text === "&bull;" || text.length < 3 || /^\d+$/.test(text) || /^\(\d{2}\/\d{2}\)$/.test(text)) {
          continue;
        }
        if (/^\d{2}:\d{2}/.test(text)) continue;
        
        let category = "Geral";
        let name = text;
        
        const catPatterns = ["Variedades", "Filme", "Esporte", "Série", "Documentário", "Jornal", "Infantil", "Religioso"];
        for (const cat of catPatterns) {
          const regex = new RegExp(`([a-záàâãéèêíóôõúç])${cat}`, "i");
          const m = name.match(regex);
          if (m) {
            const idx = name.indexOf(m[0]);
            category = cat;
            name = name.substring(0, idx + 1).trim();
            break;
          }
        }
        
        name = name.replace(/\s*•.*$/, "").replace(/&bull;/g, "").trim();
        if (!name || name.length < 2) continue;
        
        const hour = parseInt(time.split(":")[0]);
        const isHighlight = (hour >= 19 && hour < 23) || 
                            category === "Esporte" ||
                            name.toLowerCase().includes("futebol");
        
        programs.push({ start: time, end: "00:00", name, category, highlight: isHighlight });
      }
    }
  }
  
  for (let k = 0; k < programs.length; k++) {
    if (k + 1 < programs.length) {
      programs[k].end = programs[k + 1].start;
    } else {
      const [h] = programs[k].start.split(":").map(Number);
      programs[k].end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:00`;
    }
  }
  
  const seen = new Set<string>();
  return programs.filter(p => {
    const key = `${p.start}-${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}



async function fetchScheduleFromWeb(channelName: string, slug: string): Promise<Program[]> {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const daySlug = DAY_SLUGS[brt.getUTCDay()];
  
  // Fetch today's page (has programs from ~06:00 to next day ~05:59)
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
  const programs = parseScheduleFromHTML(html);
  
  // Also fetch yesterday's page to get early morning programs (00:00-05:59) for today
  const yesterday = new Date(brt.getTime() - 24 * 60 * 60 * 1000);
  const yesterdaySlug = DAY_SLUGS[yesterday.getUTCDay()];
  const yesterdayUrl = `https://tvinside.com.br/programacao_tv/${slug}/${yesterdaySlug}`;
  
  try {
    console.log(`[SYNC] Fetching yesterday's page for early morning programs: ${yesterdayUrl}...`);
    const yesterdayResponse = await fetch(yesterdayUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    
    if (yesterdayResponse.ok) {
      const yesterdayHtml = await yesterdayResponse.text();
      const yesterdayPrograms = parseScheduleFromHTML(yesterdayHtml);
      
      console.log(`[SYNC] Yesterday's page parsed ${yesterdayPrograms.length} total programs for ${channelName}`);
      
      // Get programs with start time < 06:00 (early morning = next day programs from yesterday's page)
      const earlyMorning = yesterdayPrograms.filter(p => {
        const hour = parseInt(p.start.split(":")[0]);
        return hour < 6;
      });
      
      console.log(`[SYNC] Early morning programs (< 06:00): ${earlyMorning.length} -> ${earlyMorning.map(p => `${p.start} ${p.name}`).join(", ")}`);
      
      if (earlyMorning.length > 0) {
        const existingStarts = new Set(programs.map(p => p.start));
        for (const p of earlyMorning) {
          if (!existingStarts.has(p.start)) {
            programs.push(p);
          }
        }
      }
    }
  } catch (err) {
    console.log(`[SYNC] Could not fetch yesterday's page for ${channelName}: ${err.message}`);
  }
  
  // Sort by start time, putting early morning (00-05) after late night (22-23)
  programs.sort((a, b) => {
    const ha = parseInt(a.start.split(":")[0]);
    const hb = parseInt(b.start.split(":")[0]);
    const sortA = ha < 6 ? ha + 24 : ha;
    const sortB = hb < 6 ? hb + 24 : hb;
    return sortA - sortB || a.start.localeCompare(b.start);
  });
  
  // Fix end times after sort
  for (let k = 0; k < programs.length; k++) {
    if (k + 1 < programs.length) {
      programs[k].end = programs[k + 1].start;
    } else {
      const [h] = programs[k].start.split(":").map(Number);
      programs[k].end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:00`;
    }
  }
  
  if (programs.length === 0) {
    throw new Error(`No programs parsed for ${channelName} from tvinside`);
  }
  
  console.log(`[SYNC] Parsed ${programs.length} programs for ${channelName}: ${programs.map(p => p.name).join(", ")}`);
  return programs;
}

function stripHtml(html: string): string {
  return html
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
