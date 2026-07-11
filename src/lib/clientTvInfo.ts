export type ClientTvInfo = {
  tv_username: string;
  tv_password: string;
  tv_connections: number;
  tv_code: string;
  tv_dns: string;
  tv_list_url: string;
  tv_app_name: string;
  tv_app_logo_url: string;
  next_expiry: string;
  support_name: string;
  support_whatsapp: string;
  client_since: string;
  tutorial_image_urls: string[];
  tutorial_youtube_urls: string[];
};

export const DEFAULT_SUPPORT_NAME = "Wanderson Camargo";
export const DEFAULT_SUPPORT_WHATSAPP = "(62) 99565-7915";

export const EMPTY_CLIENT_TV_INFO: ClientTvInfo = {
  tv_username: "",
  tv_password: "",
  tv_connections: 1,
  tv_code: "",
  tv_dns: "",
  tv_list_url: "",
  tv_app_name: "",
  tv_app_logo_url: "",
  next_expiry: "",
  support_name: DEFAULT_SUPPORT_NAME,
  support_whatsapp: DEFAULT_SUPPORT_WHATSAPP,
  client_since: "",
  tutorial_image_urls: [],
  tutorial_youtube_urls: [],
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const stringList = (value: unknown, legacyValue?: unknown) => {
  const source = Array.isArray(value) ? value : [];
  const result = source.map(text).filter(Boolean);
  const legacy = text(legacyValue);
  if (legacy && !result.includes(legacy)) result.push(legacy);
  return Array.from(new Set(result));
};

export const normalizeClientTvInfo = (value: unknown): ClientTvInfo => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const connections = Math.max(1, Math.floor(Number(source.tv_connections || 1)));

  return {
    tv_username: text(source.tv_username),
    tv_password: text(source.tv_password),
    tv_connections: Number.isFinite(connections) ? connections : 1,
    tv_code: text(source.tv_code),
    tv_dns: text(source.tv_dns),
    tv_list_url: text(source.tv_list_url),
    tv_app_name: text(source.tv_app_name),
    tv_app_logo_url: text(source.tv_app_logo_url),
    next_expiry: text(source.next_expiry),
    support_name: text(source.support_name) || DEFAULT_SUPPORT_NAME,
    support_whatsapp: text(source.support_whatsapp) || DEFAULT_SUPPORT_WHATSAPP,
    client_since: text(source.client_since),
    tutorial_image_urls: stringList(source.tutorial_image_urls, source.tutorial_image_url),
    tutorial_youtube_urls: stringList(source.tutorial_youtube_urls, source.tutorial_youtube_url),
  };
};

export const formatDateOnlyBr = (value: string) => {
  const clean = text(value);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return clean || "Não informado";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const getWhatsAppHref = (value: string) => {
  const digits = text(value).replace(/\D/g, "");
  if (!digits) return "";
  const international = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${international}`;
};

export const getYoutubeEmbedUrl = (value: string) => {
  const clean = text(value);
  if (!clean) return "";

  try {
    const url = new URL(clean);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    let videoId = "";

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      else {
        const parts = url.pathname.split("/").filter(Boolean);
        const markerIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
        if (markerIndex >= 0) videoId = parts[markerIndex + 1] || "";
      }
    }

    if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return "";
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return "";
  }
};
