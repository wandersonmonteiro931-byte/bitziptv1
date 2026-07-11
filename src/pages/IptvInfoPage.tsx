import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  Code2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  MessageCircle,
  PlayCircle,
  Server,
  ShieldCheck,
  Smartphone,
  Tv,
  User,
  UserRoundCheck,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { invokeAuthenticatedFunction } from "@/lib/edgeFunctions";
import {
  ClientTvInfo,
  EMPTY_CLIENT_TV_INFO,
  formatDateOnlyBr,
  getWhatsAppHref,
  getYoutubeEmbedUrl,
  normalizeClientTvInfo,
} from "@/lib/clientTvInfo";

function CopyValueButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-red-500/30 hover:text-red-400 disabled:cursor-default disabled:opacity-30"
      title="Copiar"
    >
      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
    </button>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
  secret = false,
  href = "",
}: {
  label: string;
  value: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  secret?: boolean;
  href?: string;
}) {
  const [visible, setVisible] = useState(!secret);
  const safeValue = value || "Não informado";
  const displayValue = secret && !visible && value ? "••••••••" : safeValue;

  return (
    <div className="rounded-2xl border border-white/8 bg-black/65 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon size={15} className="text-red-400" />
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {href && value ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 break-all text-sm font-semibold text-foreground underline decoration-red-500/40 underline-offset-4"
          >
            {displayValue}
          </a>
        ) : (
          <p className="min-w-0 flex-1 break-all text-sm font-semibold text-foreground">{displayValue}</p>
        )}
        {secret && value && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground"
            title={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <CopyValueButton value={value} />
      </div>
    </div>
  );
}

const IptvInfoPage = () => {
  const { user } = useAuth();
  const [info, setInfo] = useState<ClientTvInfo>(EMPTY_CLIENT_TV_INFO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInfo = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    try {
      const result = await invokeAuthenticatedFunction<any>("admin-manage-user", {
        action: "client_get_tv_info",
        user_id: user.id,
        data: {},
      });
      setInfo(normalizeClientTvInfo(result?.info));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados da TV.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    const onInfoUpdated = (event: Event) => {
      const payload = (event as CustomEvent)?.detail;
      if (!payload || (payload.user_id && payload.user_id !== user?.id)) return;
      setInfo(normalizeClientTvInfo(payload.info || payload.data || payload));
      setError("");
      setLoading(false);
    };

    window.addEventListener("wmcplayer-client-tv-info-updated", onInfoUpdated);
    return () => window.removeEventListener("wmcplayer-client-tv-info-updated", onInfoUpdated);
  }, [user?.id]);

  const firstName = String(user?.name || "cliente").trim().split(/\s+/)[0] || "cliente";
  const youtubeEmbedUrl = useMemo(() => getYoutubeEmbedUrl(info.tutorial_youtube_url), [info.tutorial_youtube_url]);
  const supportHref = useMemo(() => getWhatsAppHref(info.support_whatsapp), [info.support_whatsapp]);

  const optionalConnectionItems = [
    info.tv_code ? { label: "Código", value: info.tv_code, icon: Code2 } : null,
    info.tv_dns ? { label: "DNS", value: info.tv_dns, icon: Server } : null,
    info.tv_list_url ? { label: "Lista", value: info.tv_list_url, icon: Link2, href: info.tv_list_url } : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    href?: string;
  }>;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-red-500/20 bg-[radial-gradient(circle_at_top_right,rgba(239,35,42,0.12),transparent_38%),rgba(255,255,255,0.025)] p-5 sm:p-7"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
              <Tv size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
                Olá, {firstName}!
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                AQUI VOCÊ PODE CONFERIR OS DADOS DE LOGIN PARA CONECTAR NA SUA TV.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} />
            <p className="text-xs leading-5 text-white/55">
              Estes dados são apenas para configurar o aplicativo instalado na sua TV. Eles são informados pelo seu
              suporte e não alteram o login deste aplicativo.
            </p>
          </div>
        </motion.section>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.02]">
            <Loader2 size={28} className="animate-spin text-red-500" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/25 bg-red-500/5 p-6 text-center">
            <p className="text-sm font-semibold text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadInfo()}
              className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <KeyRound size={18} className="text-red-400" />
                <h2 className="text-base font-bold text-white">Dados para conectar na TV</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Usuário" value={info.tv_username} icon={User} />
                <InfoCard label="Senha" value={info.tv_password} icon={KeyRound} secret />
                {optionalConnectionItems.map((item) => (
                  <InfoCard key={item.label} {...item} />
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <Smartphone size={18} className="text-red-400" />
                <h2 className="text-base font-bold text-white">Aplicativo instalado na sua TV</h2>
              </div>

              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/8 bg-black/60 p-5 text-center sm:flex-row sm:text-left">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-red-500/20 bg-black p-2">
                  {info.tv_app_logo_url ? (
                    <img src={info.tv_app_logo_url} alt={info.tv_app_name || "Aplicativo TV"} className="h-full w-full object-contain" />
                  ) : (
                    <Tv size={30} className="text-red-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Aplicativo TV</p>
                  <p className="mt-1 break-words text-xl font-black text-white">{info.tv_app_name || "Não informado"}</p>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={18} className="text-red-400" />
                <h2 className="text-base font-bold text-white">Validade e suporte</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Próxima validade" value={info.next_expiry ? formatDateOnlyBr(info.next_expiry) : ""} icon={CalendarDays} />
                <InfoCard label="Cliente desde" value={info.client_since ? formatDateOnlyBr(info.client_since) : ""} icon={UserRoundCheck} />
                <InfoCard label="Nome do suporte" value={info.support_name} icon={UserRoundCheck} />
                <InfoCard
                  label="WhatsApp do suporte"
                  value={info.support_whatsapp}
                  icon={MessageCircle}
                  href={supportHref}
                />
              </div>

              {supportHref && (
                <a
                  href={supportHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  <MessageCircle size={17} /> Falar com o suporte no WhatsApp
                </a>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-2">
                <PlayCircle size={18} className="text-red-400" />
                <h2 className="text-base font-bold text-white">Como conectar na sua TV</h2>
              </div>

              {youtubeEmbedUrl && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <div className="aspect-video w-full">
                    <iframe
                      src={youtubeEmbedUrl}
                      title="Tutorial para conectar na TV"
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {info.tutorial_image_url && (
                <div className={`${youtubeEmbedUrl ? "mt-4" : ""} flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black p-2`}>
                  <img
                    src={info.tutorial_image_url}
                    alt="Instruções para conectar na TV"
                    className="h-auto max-h-[78vh] w-auto max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}

              {!youtubeEmbedUrl && !info.tutorial_image_url && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/40 p-7 text-center">
                  <PlayCircle size={30} className="mx-auto text-white/25" />
                  <p className="mt-3 text-sm text-white/45">O suporte ainda não cadastrou uma imagem ou vídeo tutorial.</p>
                </div>
              )}

              {info.tutorial_youtube_url && !youtubeEmbedUrl && (
                <a
                  href={info.tutorial_youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-300"
                >
                  <ExternalLink size={16} /> Abrir vídeo tutorial
                </a>
              )}
            </motion.section>

            <div className="flex items-start gap-3 rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4 text-xs leading-5 text-white/45">
              <ClipboardCopy size={16} className="mt-0.5 shrink-0 text-blue-400" />
              Toque no botão de copiar ao lado de cada informação para evitar erros ao digitar na TV.
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default IptvInfoPage;
