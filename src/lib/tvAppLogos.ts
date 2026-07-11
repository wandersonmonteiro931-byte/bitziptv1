import appAssistPlus from "@/assets/app-assist-plus.png";
import appBlessedPlayer from "@/assets/app-blessed-player.png";
import appMaxPlayer from "@/assets/app-max-player.png";
import appSmarters from "@/assets/app-smarters-pro.png";
import appWmcplayer from "@/assets/app-wmcplayer.png";

const normalizeAppName = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const APP_LOGOS: Array<{ aliases: string[]; logo: string }> = [
  { aliases: ["wmcplayer", "wmc player", "wmcflix", "wmc flix"], logo: appWmcplayer },
  { aliases: ["max player", "maxplayer"], logo: appMaxPlayer },
  { aliases: ["blessed player", "blessedplayer"], logo: appBlessedPlayer },
  { aliases: ["smarters pro", "smarters iptv", "iptv smarters", "smarters"], logo: appSmarters },
  { aliases: ["assist plus", "assist+", "assist"], logo: appAssistPlus },
];

export const getBuiltInTvAppLogo = (appName: unknown): string => {
  const normalized = normalizeAppName(appName);
  if (!normalized) return "";

  const match = APP_LOGOS.find((item) =>
    item.aliases.some((alias) => {
      const normalizedAlias = normalizeAppName(alias);
      return normalized === normalizedAlias || normalized.includes(normalizedAlias);
    }),
  );

  return match?.logo || "";
};

export const resolveTvAppLogo = (appName: unknown, configuredLogo?: unknown): string => {
  const builtInLogo = getBuiltInTvAppLogo(appName);
  if (builtInLogo) return builtInLogo;
  return String(configuredLogo || "").trim();
};
