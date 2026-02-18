import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known Brazilian TV schedules (realistic templates)
const SCHEDULES: Record<string, Array<{ start: string; end: string; name: string; category: string; highlight?: boolean }>> = {
  "Globo": [
    { start: "04:00", end: "05:00", name: "Hora Um", category: "Jornal" },
    { start: "05:00", end: "06:00", name: "Bom Dia Brasil (1ª Ed.)", category: "Jornal" },
    { start: "06:00", end: "08:30", name: "Bom Dia Brasil", category: "Jornal" },
    { start: "08:30", end: "09:30", name: "Mais Você", category: "Variedades" },
    { start: "09:30", end: "10:35", name: "Encontro com Patrícia Poeta", category: "Variedades" },
    { start: "10:35", end: "12:00", name: "TV Globinho / Sessão da Manhã", category: "Filme" },
    { start: "12:00", end: "12:45", name: "Globo Esporte", category: "Esporte", highlight: true },
    { start: "12:45", end: "13:30", name: "Jornal Hoje", category: "Jornal" },
    { start: "13:30", end: "14:15", name: "Sessão da Tarde", category: "Filme" },
    { start: "14:15", end: "15:00", name: "Sessão da Tarde", category: "Filme" },
    { start: "15:00", end: "16:00", name: "Sessão da Tarde", category: "Filme" },
    { start: "16:00", end: "17:00", name: "Vale a Pena Ver de Novo", category: "Novela" },
    { start: "17:00", end: "17:45", name: "Malhação", category: "Série" },
    { start: "17:45", end: "18:25", name: "Mania de Você", category: "Novela" },
    { start: "18:25", end: "19:10", name: "No Rancho Fundo", category: "Novela" },
    { start: "19:10", end: "19:55", name: "Volta por Cima", category: "Novela", highlight: true },
    { start: "19:55", end: "20:30", name: "Jornal Nacional", category: "Jornal", highlight: true },
    { start: "20:30", end: "21:20", name: "Mania de Você", category: "Novela", highlight: true },
    { start: "21:20", end: "22:15", name: "Renascer", category: "Novela", highlight: true },
    { start: "22:15", end: "23:00", name: "Globo Repórter", category: "Jornal" },
    { start: "23:00", end: "23:45", name: "Jornal da Globo", category: "Jornal" },
    { start: "23:45", end: "00:30", name: "Conversa com Bial", category: "Variedades" },
  ],
  "SBT": [
    { start: "06:00", end: "07:30", name: "Primeiro Impacto", category: "Jornal" },
    { start: "07:30", end: "08:30", name: "Bom Dia & Cia", category: "Infantil" },
    { start: "08:30", end: "11:45", name: "Carrossel / Chiquititas", category: "Novela" },
    { start: "11:45", end: "12:30", name: "Fofocalizando", category: "Variedades" },
    { start: "12:30", end: "14:00", name: "Tá na Hora", category: "Jornal" },
    { start: "14:00", end: "15:00", name: "Casos de Família", category: "Variedades" },
    { start: "15:00", end: "17:30", name: "Programa Silvio Santos", category: "Variedades", highlight: true },
    { start: "17:30", end: "18:30", name: "Roda a Roda Jequiti", category: "Variedades" },
    { start: "18:30", end: "19:15", name: "Cupom Premiado", category: "Variedades" },
    { start: "19:15", end: "19:45", name: "SBT Brasil", category: "Jornal", highlight: true },
    { start: "19:45", end: "22:00", name: "Programa do Ratinho", category: "Variedades", highlight: true },
    { start: "22:00", end: "23:00", name: "The Noite com Danilo Gentili", category: "Variedades" },
    { start: "23:00", end: "00:00", name: "Operação Mesquita", category: "Variedades" },
  ],
  "Record": [
    { start: "05:00", end: "06:00", name: "Balanço Geral Manhã", category: "Jornal" },
    { start: "06:00", end: "08:45", name: "Fala Brasil", category: "Jornal" },
    { start: "08:45", end: "10:00", name: "Hoje em Dia", category: "Variedades" },
    { start: "10:00", end: "11:30", name: "Hoje em Dia", category: "Variedades" },
    { start: "11:30", end: "12:00", name: "Hora do Faro", category: "Variedades" },
    { start: "12:00", end: "14:30", name: "Balanço Geral", category: "Jornal", highlight: true },
    { start: "14:30", end: "16:00", name: "A Hora da Venenosa", category: "Variedades" },
    { start: "16:00", end: "17:00", name: "Cidade Alerta", category: "Jornal", highlight: true },
    { start: "17:00", end: "18:00", name: "Cidade Alerta", category: "Jornal" },
    { start: "18:00", end: "19:00", name: "Jornal da Record", category: "Jornal" },
    { start: "19:00", end: "20:00", name: "Gênesis", category: "Novela", highlight: true },
    { start: "20:00", end: "21:00", name: "Reis", category: "Novela", highlight: true },
    { start: "21:00", end: "22:00", name: "Jornal da Record", category: "Jornal", highlight: true },
    { start: "22:00", end: "23:00", name: "Câmera Record", category: "Jornal" },
    { start: "23:00", end: "00:00", name: "Speak", category: "Religioso" },
  ],
  "Band": [
    { start: "06:00", end: "08:00", name: "Bora Brasil", category: "Jornal" },
    { start: "08:00", end: "10:00", name: "Morning Show", category: "Variedades" },
    { start: "10:00", end: "12:00", name: "Melhor da Tarde", category: "Variedades" },
    { start: "12:00", end: "14:00", name: "Brasil Urgente", category: "Jornal", highlight: true },
    { start: "14:00", end: "16:00", name: "Cozinha Band", category: "Variedades" },
    { start: "16:00", end: "17:30", name: "O Melhor da Tarde", category: "Variedades" },
    { start: "17:30", end: "19:15", name: "Brasil Urgente", category: "Jornal", highlight: true },
    { start: "19:15", end: "20:00", name: "Jornal da Band", category: "Jornal", highlight: true },
    { start: "20:00", end: "21:00", name: "MasterChef Brasil", category: "Variedades", highlight: true },
    { start: "21:00", end: "22:00", name: "Faustão na Band", category: "Variedades", highlight: true },
    { start: "22:00", end: "23:00", name: "Pepe", category: "Variedades" },
    { start: "23:00", end: "00:00", name: "Jornal da Noite", category: "Jornal" },
  ],
  "RedeTV!": [
    { start: "06:00", end: "09:00", name: "Leitura Dinâmica", category: "Jornal" },
    { start: "09:00", end: "10:00", name: "Bora Povo", category: "Variedades" },
    { start: "10:00", end: "12:00", name: "TV Fama", category: "Variedades" },
    { start: "12:00", end: "14:00", name: "A Tarde é Sua", category: "Variedades", highlight: true },
    { start: "14:00", end: "16:00", name: "Ultrafarma", category: "Variedades" },
    { start: "16:00", end: "18:00", name: "RedeTV News", category: "Jornal" },
    { start: "18:00", end: "19:00", name: "Alerta Nacional", category: "Jornal", highlight: true },
    { start: "19:00", end: "20:00", name: "Amaury Jr.", category: "Variedades" },
    { start: "20:00", end: "21:00", name: "Lenda Urbana", category: "Série" },
    { start: "21:00", end: "22:00", name: "SuperPop", category: "Variedades", highlight: true },
    { start: "22:00", end: "23:00", name: "Sensacional", category: "Variedades" },
    { start: "23:00", end: "00:00", name: "Operação de Risco", category: "Jornal" },
  ],
};

// Weekend variations
const WEEKEND_OVERRIDES: Record<string, Array<{ start: string; end: string; name: string; category: string; highlight?: boolean }>> = {
  "Globo": [
    { start: "06:00", end: "08:00", name: "Globo Rural", category: "Variedades" },
    { start: "08:00", end: "09:30", name: "Pequenas Empresas, Grandes Negócios", category: "Variedades" },
    { start: "09:30", end: "11:00", name: "Esporte Espetacular", category: "Esporte", highlight: true },
    { start: "11:00", end: "13:00", name: "Temperatura Máxima", category: "Filme", highlight: true },
    { start: "13:00", end: "14:00", name: "Globo Esporte", category: "Esporte" },
    { start: "14:00", end: "16:00", name: "Futebol", category: "Esporte", highlight: true },
    { start: "16:00", end: "18:00", name: "Caldeirão com Mion", category: "Variedades", highlight: true },
    { start: "18:00", end: "19:00", name: "Domingão com Huck", category: "Variedades", highlight: true },
    { start: "19:00", end: "19:55", name: "Fantástico (prévia)", category: "Jornal" },
    { start: "19:55", end: "20:30", name: "Jornal Nacional", category: "Jornal", highlight: true },
    { start: "20:30", end: "23:00", name: "Fantástico", category: "Jornal", highlight: true },
    { start: "23:00", end: "00:00", name: "Domingo Maior", category: "Filme" },
  ],
  "SBT": [
    { start: "07:00", end: "11:00", name: "Domingo Legal", category: "Variedades", highlight: true },
    { start: "11:00", end: "14:00", name: "Eliana", category: "Variedades", highlight: true },
    { start: "14:00", end: "17:00", name: "Programa Silvio Santos", category: "Variedades", highlight: true },
    { start: "17:00", end: "19:00", name: "Roda a Roda Jequiti", category: "Variedades" },
    { start: "19:00", end: "19:30", name: "SBT Brasil", category: "Jornal" },
    { start: "19:30", end: "22:00", name: "Tele Sena", category: "Variedades", highlight: true },
    { start: "22:00", end: "00:00", name: "Filme de Domingo", category: "Filme" },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all channels
    const { data: channels, error: chErr } = await supabase
      .from("tv_channels")
      .select("*")
      .eq("is_active", true);

    if (chErr) throw chErr;
    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No channels found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which dates to populate (today + next 6 days)
    const now = new Date();
    // Adjust to BRT (UTC-3)
    const brtOffset = -3 * 60 * 60 * 1000;
    const brtNow = new Date(now.getTime() + brtOffset + now.getTimezoneOffset() * 60 * 1000);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(brtNow);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    let totalInserted = 0;

    for (const channel of channels) {
      const schedule = SCHEDULES[channel.name];
      const weekendSchedule = WEEKEND_OVERRIDES[channel.name];
      if (!schedule) continue;

      for (const dateStr of dates) {
        // Check if programs already exist for this date/channel
        const { data: existing } = await supabase
          .from("tv_programs")
          .select("id")
          .eq("channel_id", channel.id)
          .eq("program_date", dateStr)
          .limit(1);

        if (existing && existing.length > 0) continue; // Already populated

        // Determine day of week (0=Sun, 6=Sat)
        const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const programs = (isWeekend && weekendSchedule) ? weekendSchedule : schedule;

        const rows = programs.map((p) => ({
          channel_id: channel.id,
          program_date: dateStr,
          start_time: p.start,
          end_time: p.end,
          name: p.name,
          category: p.category,
          is_highlight: p.highlight || false,
          is_active: true,
        }));

        const { error: insertErr } = await supabase.from("tv_programs").insert(rows);
        if (insertErr) {
          console.error(`Error inserting for ${channel.name} on ${dateStr}:`, insertErr);
        } else {
          totalInserted += rows.length;
        }
      }
    }

    console.log(`Sync complete. Inserted ${totalInserted} programs.`);

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted, dates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing TV guide:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
