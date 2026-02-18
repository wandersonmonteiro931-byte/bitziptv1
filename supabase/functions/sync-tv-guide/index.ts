import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Programação REAL 2025 - Dias úteis (segunda a sexta)
// Fonte: tv.sbt.com.br, meuguia.tv, portaldatv.com.br
const SCHEDULES: Record<string, Array<{ start: string; end: string; name: string; category: string; highlight?: boolean }>> = {
  "Globo": [
    { start: "04:00", end: "06:00", name: "Hora Um da Notícia", category: "Jornal" },
    { start: "06:00", end: "08:30", name: "Bom Dia Goiás / Bom Dia Brasil", category: "Jornal" },
    { start: "08:30", end: "09:45", name: "Mais Você", category: "Variedades" },
    { start: "09:45", end: "10:45", name: "Encontro com Patrícia Poeta", category: "Variedades" },
    { start: "10:45", end: "12:00", name: "Sessão da Manhã", category: "Filme" },
    { start: "12:00", end: "12:45", name: "Globo Esporte Goiás", category: "Esporte", highlight: true },
    { start: "12:45", end: "13:25", name: "Jornal Hoje", category: "Jornal" },
    { start: "13:25", end: "14:50", name: "Sessão da Tarde", category: "Filme" },
    { start: "14:50", end: "15:35", name: "Cabocla", category: "Novela" },
    { start: "15:35", end: "16:15", name: "Tieta", category: "Novela" },
    { start: "16:15", end: "17:05", name: "Malhação", category: "Série" },
    { start: "17:05", end: "17:50", name: "Garota do Momento", category: "Novela", highlight: true },
    { start: "17:50", end: "18:30", name: "Jornal Anhanguera 1ª Edição", category: "Jornal" },
    { start: "18:30", end: "19:15", name: "Família é Tudo", category: "Novela" },
    { start: "19:15", end: "19:45", name: "Jornal Anhanguera 2ª Edição", category: "Jornal" },
    { start: "19:45", end: "20:30", name: "Volta por Cima", category: "Novela", highlight: true },
    { start: "20:30", end: "21:15", name: "Jornal Nacional", category: "Jornal", highlight: true },
    { start: "21:15", end: "22:15", name: "Mania de Você", category: "Novela", highlight: true },
    { start: "22:15", end: "23:15", name: "Todas as Flores", category: "Novela", highlight: true },
    { start: "23:15", end: "00:00", name: "Jornal da Globo", category: "Jornal" },
    { start: "00:00", end: "00:45", name: "Conversa com Bial", category: "Variedades" },
  ],
  "SBT": [
    { start: "06:00", end: "07:30", name: "SBT Manhã", category: "Jornal" },
    { start: "07:30", end: "08:30", name: "SBT Manhã", category: "Jornal" },
    { start: "08:30", end: "11:00", name: "Primeiro Impacto", category: "Jornal" },
    { start: "11:00", end: "13:45", name: "Alô, Você", category: "Variedades" },
    { start: "13:45", end: "14:45", name: "Esmeralda", category: "Novela" },
    { start: "14:45", end: "15:30", name: "Meu Coração é Teu", category: "Novela" },
    { start: "15:30", end: "17:00", name: "Fofocalizando", category: "Variedades" },
    { start: "17:00", end: "18:30", name: "Coração Indomável", category: "Novela" },
    { start: "18:30", end: "19:45", name: "Aqui Agora", category: "Jornal", highlight: true },
    { start: "19:45", end: "21:00", name: "SBT Brasil", category: "Jornal", highlight: true },
    { start: "21:00", end: "22:00", name: "Presente de Amor", category: "Novela", highlight: true },
    { start: "22:00", end: "23:00", name: "Programa do Ratinho", category: "Variedades", highlight: true },
    { start: "23:00", end: "00:15", name: "Love Taste - Receita para o Amor", category: "Variedades" },
    { start: "00:15", end: "01:15", name: "The Noite com Danilo Gentili", category: "Variedades" },
    { start: "01:15", end: "01:45", name: "Operação Mesquita", category: "Variedades" },
  ],
  "Record": [
    { start: "05:00", end: "06:00", name: "Balanço Geral Manhã", category: "Jornal" },
    { start: "06:00", end: "08:45", name: "Fala Brasil", category: "Jornal" },
    { start: "08:45", end: "10:00", name: "Hoje em Dia", category: "Variedades" },
    { start: "10:00", end: "11:45", name: "Hoje em Dia", category: "Variedades" },
    { start: "11:45", end: "14:30", name: "Balanço Geral", category: "Jornal", highlight: true },
    { start: "14:30", end: "16:00", name: "A Hora da Venenosa", category: "Variedades" },
    { start: "16:00", end: "18:00", name: "Cidade Alerta", category: "Jornal", highlight: true },
    { start: "18:00", end: "19:00", name: "Cidade Alerta", category: "Jornal" },
    { start: "19:00", end: "19:50", name: "Jornal da Record", category: "Jornal", highlight: true },
    { start: "19:50", end: "20:45", name: "Gênesis", category: "Novela", highlight: true },
    { start: "20:45", end: "21:30", name: "Reis", category: "Novela", highlight: true },
    { start: "21:30", end: "22:15", name: "Força de Mulher", category: "Novela" },
    { start: "22:15", end: "23:00", name: "Câmera Record", category: "Jornal" },
    { start: "23:00", end: "00:00", name: "Jornal da Record 24h", category: "Jornal" },
  ],
  "Band": [
    { start: "07:00", end: "08:00", name: "Valor da Vida", category: "Novela" },
    { start: "08:00", end: "08:20", name: "Agro Band", category: "Jornal" },
    { start: "08:20", end: "11:00", name: "Bora Brasil", category: "Jornal" },
    { start: "11:00", end: "12:00", name: "Jogo Aberto", category: "Esporte", highlight: true },
    { start: "12:00", end: "13:30", name: "Os Donos da Bola", category: "Esporte" },
    { start: "13:30", end: "14:30", name: "Vem Com a Gente", category: "Variedades" },
    { start: "14:30", end: "16:00", name: "Melhor da Tarde", category: "Variedades" },
    { start: "16:00", end: "17:30", name: "Brasil Urgente", category: "Jornal", highlight: true },
    { start: "17:30", end: "18:40", name: "Brasil Urgente Local", category: "Jornal", highlight: true },
    { start: "18:40", end: "19:20", name: "Jornal Local", category: "Jornal" },
    { start: "19:20", end: "20:30", name: "Jornal da Band", category: "Jornal", highlight: true },
    { start: "20:30", end: "21:25", name: "Cruel Istambul", category: "Novela", highlight: true },
    { start: "21:25", end: "22:20", name: "Show da Fé", category: "Variedades" },
    { start: "22:20", end: "22:45", name: "Jornal da Noite", category: "Jornal" },
    { start: "22:45", end: "00:00", name: "Melhor da Noite", category: "Variedades" },
  ],
  "RedeTV!": [
    { start: "05:00", end: "08:30", name: "Igreja Internacional da Graça de Deus", category: "Religioso" },
    { start: "08:30", end: "10:00", name: "Igreja Universal do Reino de Deus", category: "Religioso" },
    { start: "10:00", end: "12:00", name: "Você na TV", category: "Variedades" },
    { start: "12:00", end: "13:00", name: "TV Fama", category: "Variedades" },
    { start: "13:00", end: "15:00", name: "Ultrafarma", category: "Variedades" },
    { start: "15:00", end: "17:00", name: "A Tarde é Sua", category: "Variedades", highlight: true },
    { start: "17:00", end: "18:00", name: "Igreja Universal do Reino de Deus", category: "Religioso" },
    { start: "18:00", end: "19:50", name: "Brasil do Povo", category: "Jornal", highlight: true },
    { start: "19:50", end: "20:30", name: "RedeTV News", category: "Jornal", highlight: true },
    { start: "20:30", end: "21:30", name: "Leitura Dinâmica", category: "Jornal" },
    { start: "21:30", end: "22:45", name: "Amaury Jr.", category: "Variedades" },
    { start: "22:45", end: "00:00", name: "SuperPop", category: "Variedades", highlight: true },
    { start: "00:00", end: "01:00", name: "Sensacional", category: "Variedades" },
  ],
};

// Grade de fim de semana
const WEEKEND_OVERRIDES: Record<string, Array<{ start: string; end: string; name: string; category: string; highlight?: boolean }>> = {
  "Globo": [
    { start: "06:00", end: "07:00", name: "Globo Rural", category: "Variedades" },
    { start: "07:00", end: "08:00", name: "Pequenas Empresas, Grandes Negócios", category: "Variedades" },
    { start: "08:00", end: "11:00", name: "Esporte Espetacular", category: "Esporte", highlight: true },
    { start: "11:00", end: "13:00", name: "Temperatura Máxima", category: "Filme", highlight: true },
    { start: "13:00", end: "14:00", name: "Globo Esporte", category: "Esporte" },
    { start: "14:00", end: "16:00", name: "Futebol", category: "Esporte", highlight: true },
    { start: "16:00", end: "18:00", name: "Caldeirão com Mion", category: "Variedades", highlight: true },
    { start: "18:00", end: "19:00", name: "Domingão com Huck", category: "Variedades", highlight: true },
    { start: "19:00", end: "20:00", name: "Fantástico (prévia)", category: "Jornal" },
    { start: "20:00", end: "20:30", name: "Jornal Nacional", category: "Jornal", highlight: true },
    { start: "20:30", end: "23:00", name: "Fantástico", category: "Jornal", highlight: true },
    { start: "23:00", end: "00:00", name: "Domingo Maior", category: "Filme" },
  ],
  "SBT": [
    { start: "06:00", end: "08:00", name: "SBT Manhã", category: "Jornal" },
    { start: "08:00", end: "10:00", name: "Primeiro Impacto", category: "Jornal" },
    { start: "10:00", end: "12:00", name: "Domingo Legal", category: "Variedades", highlight: true },
    { start: "12:00", end: "14:00", name: "Roda a Roda Jequiti", category: "Variedades" },
    { start: "14:00", end: "17:00", name: "Programa Silvio Santos", category: "Variedades", highlight: true },
    { start: "17:00", end: "19:00", name: "SBT Brasil", category: "Jornal" },
    { start: "19:00", end: "22:00", name: "Tele Sena", category: "Variedades", highlight: true },
    { start: "22:00", end: "00:00", name: "Filme de Domingo", category: "Filme" },
  ],
  "Record": [
    { start: "06:00", end: "08:00", name: "Missa", category: "Religioso" },
    { start: "08:00", end: "10:00", name: "Caminhos da Reportagem", category: "Jornal" },
    { start: "10:00", end: "12:00", name: "Hora do Faro", category: "Variedades", highlight: true },
    { start: "12:00", end: "14:00", name: "Domingo Espetacular", category: "Jornal", highlight: true },
    { start: "14:00", end: "17:00", name: "Hora do Faro", category: "Variedades", highlight: true },
    { start: "17:00", end: "19:00", name: "Câmera Record", category: "Jornal" },
    { start: "19:00", end: "20:30", name: "Gênesis", category: "Novela", highlight: true },
    { start: "20:30", end: "22:30", name: "Domingo Espetacular", category: "Jornal", highlight: true },
    { start: "22:30", end: "00:00", name: "Jornal da Record", category: "Jornal" },
  ],
  "Band": [
    { start: "06:00", end: "08:00", name: "Band Kids", category: "Infantil" },
    { start: "08:00", end: "09:30", name: "Gente da Band", category: "Variedades" },
    { start: "09:30", end: "11:00", name: "Band Esporte Clube", category: "Esporte", highlight: true },
    { start: "11:00", end: "12:00", name: "Band Esporte Clube", category: "Esporte" },
    { start: "12:00", end: "13:00", name: "Mundo dos Negócios", category: "Jornal" },
    { start: "13:00", end: "14:00", name: "Band Esporte Clube", category: "Esporte" },
    { start: "14:00", end: "17:00", name: "Futebol", category: "Esporte", highlight: true },
    { start: "17:00", end: "19:00", name: "Brasil Urgente", category: "Jornal", highlight: true },
    { start: "19:00", end: "20:00", name: "Jornal da Band", category: "Jornal" },
    { start: "20:00", end: "22:00", name: "Filme de Domingo", category: "Filme", highlight: true },
    { start: "22:00", end: "00:00", name: "Jornal da Noite", category: "Jornal" },
  ],
  "RedeTV!": [
    { start: "06:00", end: "10:00", name: "Igreja Internacional da Graça de Deus", category: "Religioso" },
    { start: "10:00", end: "12:00", name: "TV Fama", category: "Variedades" },
    { start: "12:00", end: "14:00", name: "A Tarde é Sua", category: "Variedades" },
    { start: "14:00", end: "17:00", name: "Encrenca", category: "Variedades", highlight: true },
    { start: "17:00", end: "19:00", name: "Leitura Dinâmica", category: "Jornal" },
    { start: "19:00", end: "21:00", name: "Programa do Gugu", category: "Variedades", highlight: true },
    { start: "21:00", end: "23:00", name: "SuperPop", category: "Variedades", highlight: true },
    { start: "23:00", end: "00:00", name: "Operação de Risco", category: "Jornal" },
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

    // Get all active channels
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

    // BRT date: today only
    const now = new Date();
    const brtOffset = -3 * 60 * 60 * 1000;
    const brtNow = new Date(now.getTime() + brtOffset + now.getTimezoneOffset() * 60 * 1000);
    const todayStr = brtNow.toISOString().split("T")[0];
    const dates = [todayStr];

    let totalInserted = 0;

    for (const channel of channels) {
      const schedule = SCHEDULES[channel.name];
      const weekendSchedule = WEEKEND_OVERRIDES[channel.name];
      if (!schedule) continue;

      for (const dateStr of dates) {
        // Check existing
        const { data: existing } = await supabase
          .from("tv_programs")
          .select("id")
          .eq("channel_id", channel.id)
          .eq("program_date", dateStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

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
