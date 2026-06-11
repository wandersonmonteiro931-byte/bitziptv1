import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Tv, ChevronLeft, ChevronRight, Radio, Clock, CheckCircle2, FastForward } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { nowBRT, todayBRT } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  logo_url: string;
  is_active: boolean;
  sort_order: number;
}

interface Program {
  id: string;
  channel_id: string;
  program_date: string;
  start_time: string;
  end_time: string;
  name: string;
  category: string;
  description: string;
  is_highlight: boolean;
}

type ProgramStatus = "live" | "next" | "ended" | "upcoming";

function getProgramStatus(program: Program, now: Date): ProgramStatus {
  const [sh, sm] = program.start_time.split(":").map(Number);
  const [eh, em] = program.end_time.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  // Check if today
  const todayStr = format(now, "yyyy-MM-dd");
  if (program.program_date !== todayStr) {
    return "upcoming";
  }

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return "live";
  if (currentMinutes < startMinutes) return "upcoming";
  return "ended";
}

function getProgress(program: Program, now: Date): number {
  const [sh, sm] = program.start_time.split(":").map(Number);
  const [eh, em] = program.end_time.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const total = endMinutes - startMinutes;
  if (total <= 0) return 0;
  const elapsed = currentMinutes - startMinutes;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function getMinutesUntil(program: Program, now: Date): number {
  const [sh, sm] = program.start_time.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return sh * 60 + sm - currentMinutes;
}

const categoryColors: Record<string, string> = {
  Jornal: "bg-blue-500/20 text-blue-400",
  Novela: "bg-pink-500/20 text-pink-400",
  Filme: "bg-red-500/20 text-red-400",
  Esporte: "bg-green-500/20 text-green-400",
  Série: "bg-orange-500/20 text-orange-400",
  Infantil: "bg-yellow-500/20 text-yellow-400",
  Variedades: "bg-cyan-500/20 text-cyan-400",
  Religioso: "bg-amber-500/20 text-amber-400",
};

const TvGuidePage = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [now, setNow] = useState(nowBRT());
  const [loading, setLoading] = useState(true);

  const todayStr = todayBRT();

  useEffect(() => {
    const interval = setInterval(() => setNow(nowBRT()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadChannels();
    loadPrograms();
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("tv-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tv_programs" }, () => loadPrograms())
      .on("postgres_changes", { event: "*", schema: "public", table: "tv_channels" }, () => loadChannels())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const loadChannels = async () => {
    const { data } = await supabase.from("tv_channels").select("*").eq("is_active", true).order("sort_order");
    setChannels((data as any[]) || []);
  };

  const loadPrograms = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tv_programs")
      .select("*")
      .eq("program_date", todayStr)
      .eq("is_active", true)
      .order("start_time");
    setPrograms((data as any[]) || []);
    setLoading(false);
  };

  const todayLabel = format(nowBRT(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  const filteredPrograms = useMemo(() => {
    if (selectedChannel === "all") return programs;
    return programs.filter((p) => p.channel_id === selectedChannel);
  }, [programs, selectedChannel]);

  const groupedByChannel = useMemo(() => {
    const map = new Map<string, Program[]>();
    filteredPrograms.forEach((p) => {
      if (!map.has(p.channel_id)) map.set(p.channel_id, []);
      map.get(p.channel_id)!.push(p);
    });
    return map;
  }, [filteredPrograms]);

  // Find next program for "next" label
  const findNextProgram = (channelPrograms: Program[]): string | null => {
    const todayStr = format(now, "yyyy-MM-dd");
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let nextId: string | null = null;
    let earliestStart = Infinity;
    for (const p of channelPrograms) {
      if (p.program_date !== todayStr) continue;
      const [sh, sm] = p.start_time.split(":").map(Number);
      const startMin = sh * 60 + sm;
      if (startMin > currentMinutes && startMin < earliestStart) {
        earliestStart = startMin;
        nextId = p.id;
      }
    }
    return nextId;
  };

  return (
    <AppLayout>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Tv className="text-primary" size={22} /> Programação da TV
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Veja o que está passando agora</p>
      </div>

      {/* Channel filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedChannel("all")}
          className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all ${
            selectedChannel === "all"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          Todos
        </button>
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setSelectedChannel(ch.id)}
            className={`flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all ${
              selectedChannel === ch.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {ch.logo_url && <img src={ch.logo_url} alt={ch.name} className="h-5 w-5 rounded-full object-contain" />}
            {ch.name}
          </button>
        ))}
      </div>

      {/* Today label */}
      <div className="mb-5 rounded-xl bg-muted/30 px-4 py-2 text-center">
        <span className="text-xs font-semibold capitalize text-muted-foreground">{todayLabel}</span>
      </div>

      {/* Programs */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : groupedByChannel.size === 0 ? (
        <div className="py-16 text-center">
          <Tv className="mx-auto mb-3 text-muted-foreground/30" size={48} />
          <p className="text-sm text-muted-foreground">Nenhuma programação para este dia</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByChannel.entries()).map(([channelId, channelPrograms]) => {
            const channel = channels.find((c) => c.id === channelId);
            if (!channel) return null;
            const nextProgramId = findNextProgram(channelPrograms);

            return (
              <motion.div
                key={channelId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* Channel header */}
                <div className="flex items-center gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
                  {channel.logo_url ? (
                    <img
                      src={channel.logo_url}
                      alt={channel.name}
                      className="h-10 w-10 rounded-xl object-contain shadow-md"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                      <Tv size={20} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{channel.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{channelPrograms.length} programas</p>
                  </div>
                </div>

                {/* Programs list */}
                <div className="divide-y divide-border/30">
                  {channelPrograms.map((program) => {
                    const status = getProgramStatus(program, now);
                    const isLive = status === "live";
                    const isNext = program.id === nextProgramId;
                    const progress = isLive ? getProgress(program, now) : 0;
                    const minutesUntil = isNext ? getMinutesUntil(program, now) : 0;

                    return (
                      <motion.div
                        key={program.id}
                        className={`relative px-4 py-3 transition-all ${
                          isLive
                            ? "bg-destructive/5 border-l-2 border-l-destructive"
                            : isNext
                              ? "bg-primary/5 border-l-2 border-l-primary"
                              : status === "ended"
                                ? "opacity-50"
                                : ""
                        }`}
                      >
                        {/* Live glow */}
                        {isLive && (
                          <div className="absolute inset-0 animate-pulse rounded-sm bg-destructive/5 pointer-events-none" />
                        )}

                        <div className="relative flex items-start gap-3">
                          {/* Time column */}
                          <div className="flex flex-col items-center gap-0.5 pt-0.5">
                            <span
                              className={`text-xs font-bold ${isLive ? "text-destructive" : isNext ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {program.start_time.slice(0, 5)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{program.end_time.slice(0, 5)}</span>
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">{program.name}</span>
                              {program.is_highlight && <span className="text-xs">⭐</span>}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {isLive && (
                                <span className="flex items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive animate-pulse">
                                  <Radio size={8} /> AO VIVO
                                </span>
                              )}
                              {isNext && (
                                <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                                  <FastForward size={8} /> EM SEGUIDA
                                  {minutesUntil > 0 && ` · ${minutesUntil}min`}
                                </span>
                              )}
                              {status === "ended" && (
                                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                  <CheckCircle2 size={8} /> ENCERRADO
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColors[program.category] || "bg-muted text-muted-foreground"}`}
                              >
                                {program.category}
                              </span>
                            </div>

                            {program.description && (
                              <p className="mt-1 text-[11px] leading-tight text-muted-foreground line-clamp-2">
                                {program.description}
                              </p>
                            )}

                            {/* Progress bar for live */}
                            {isLive && (
                              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className="h-full rounded-full bg-destructive"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 1 }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default TvGuidePage;
