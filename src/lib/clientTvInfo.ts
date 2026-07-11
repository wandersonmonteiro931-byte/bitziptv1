export type ClientTvInfo = {
  tv_username: string;
  tv_password: string;
  tv_code: string;
  tv_dns: string;
  tv_list_url: string;
  tv_app_name: string;
  tv_app_logo_url: string;
  next_expiry: string;
  support_name: string;
  support_whatsapp: string;
  client_since: string;
  tutorial_image_url: string;
  tutorial_youtube_url: string;
};

export const EMPTY_CLIENT_TV_INFO: ClientTvInfo = {
  tv_username: "",
  tv_password: "",
  tv_code: "",
  tv_dns: "",
  tv_list_url: "",
  tv_app_name: "",
  tv_app_logo_url: "",
  next_expiry: "",
  support_name: "",
  support_whatsapp: "",
  client_since: "",
  tutorial_image_url: "",
  tutorial_youtube_url: "",
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const normalizeClientTvInfo = (value: unknown): ClientTvInfo => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    tv_username: text(source.tv_username),
    tv_password: text(source.tv_password),
    tv_code: text(source.tv_code),
    tv_dns: text(source.tv_dns),
    tv_list_url: text(source.tv_list_url),
    tv_app_name: text(source.tv_app_name),
    tv_app_logo_url: text(source.tv_app_logo_url),
    next_expiry: text(source.next_expiry),
    support_name: text(source.support_name),
    support_whatsapp: text(source.support_whatsapp),
    client_since: text(source.client_since),
    tutorial_image_url: text(source.tutorial_image_url),
    tutorial_youtube_url: text(source.tutorial_youtube_url),
  };
};

export const formatDateOnlyBr = (value: string) => {
  const clean = text(value);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
