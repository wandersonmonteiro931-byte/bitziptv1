import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppBranding = {
  appName: string;
  appShortName: string;
  appDescription: string;
  logoUrl: string;
  faviconUrl: string;
};

export const APP_BRANDING_STORAGE_KEY = "wmcplayer_app_branding_v2";
const LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY = "wmcflix_app_branding_v2";
const LEGACY_APP_BRANDING_STORAGE_KEY = "bitz_app_branding";
export const APP_BRANDING_EVENT = "app-branding-updated";

const DEFAULT_LOGO = "/wmcplayer-icon-512-v3.png";

const DEFAULT_BRANDING: AppBranding = {
  appName: "WMCPLAYER",
  appShortName: "WMCPLAYER",
  appDescription: "WMCPLAYER - Programa Oficial de Fidelidade",
  logoUrl: DEFAULT_LOGO,
  faviconUrl: DEFAULT_LOGO,
};

const textOrDefault = (value: unknown, fallback: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

const isLegacyBitzBranding = (branding: AppBranding) => {
  const name = `${branding.appName || ""} ${branding.appShortName || ""}`.toLowerCase();
  return name.includes("bitz iptv") || name === "bitz";
};

export const getDefaultAppBranding = (): AppBranding => ({ ...DEFAULT_BRANDING });

export const normalizeAppBranding = (row?: any): AppBranding => {
  const appName = textOrDefault(row?.app_name ?? row?.appName, DEFAULT_BRANDING.appName);
  const appShortName = textOrDefault(row?.app_short_name ?? row?.appShortName, appName);
  const appDescription = textOrDefault(
    row?.app_description ?? row?.appDescription,
    `${appName} - Programa Oficial de Fidelidade`,
  );

  const logoUrl = textOrDefault(row?.app_logo_url ?? row?.logoUrl, DEFAULT_BRANDING.logoUrl);
  const faviconUrl = textOrDefault(row?.app_favicon_url ?? row?.faviconUrl, logoUrl || DEFAULT_BRANDING.faviconUrl);

  return { appName, appShortName, appDescription, logoUrl, faviconUrl };
};

const safeParseBranding = (value: string | null): AppBranding | null => {
  if (!value) return null;

  try {
    const branding = normalizeAppBranding(JSON.parse(value));
    if (isLegacyBitzBranding(branding)) return null;
    return branding;
  } catch {
    return null;
  }
};

export const readStoredAppBranding = (): AppBranding => {
  if (typeof window === "undefined") return getDefaultAppBranding();

  try {
    const stored = safeParseBranding(localStorage.getItem(APP_BRANDING_STORAGE_KEY));
    if (stored) return stored;

    // Migra branding salvo na chave antiga para não quebrar o PWA instalado.
    const legacyWmcflix = safeParseBranding(localStorage.getItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY));
    localStorage.removeItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY);
    if (legacyWmcflix) {
      localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(legacyWmcflix));
      return legacyWmcflix;
    }

    // Remove cache antigo do Bitz para não contaminar novas instalações PWA.
    const legacy = safeParseBranding(localStorage.getItem(LEGACY_APP_BRANDING_STORAGE_KEY));
    localStorage.removeItem(LEGACY_APP_BRANDING_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(legacy));
      return legacy;
    }

    const bootBranding = (window as any).__APP_BRANDING_BOOT__;
    if (bootBranding) {
      const normalized = normalizeAppBranding(bootBranding);
      if (!isLegacyBitzBranding(normalized)) return normalized;
    }
  } catch {
    localStorage.removeItem(APP_BRANDING_STORAGE_KEY);
    localStorage.removeItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY);
    localStorage.removeItem(LEGACY_APP_BRANDING_STORAGE_KEY);
  }

  return getDefaultAppBranding();
};

const getImageMime = (url: string) => {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".ico")) return "image/x-icon";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
};

const setMeta = (selector: string, attr: "content" | "href", value: string) => {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;

  if (!element) {
    if (selector.startsWith("meta")) {
      element = document.createElement("meta");
      const nameMatch = selector.match(/name="([^"]+)"/);
      const propertyMatch = selector.match(/property="([^"]+)"/);
      if (nameMatch) (element as HTMLMetaElement).name = nameMatch[1];
      if (propertyMatch) element.setAttribute("property", propertyMatch[1]);
    } else if (selector.startsWith("link")) {
      element = document.createElement("link");
      const relMatch = selector.match(/rel="([^"]+)"/);
      if (relMatch) (element as HTMLLinkElement).rel = relMatch[1];
    }

    if (element) document.head.appendChild(element);
  }

  if (element) element.setAttribute(attr, value);
};

const setIconType = (selector: string, iconUrl: string) => {
  const element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (element) element.type = getImageMime(iconUrl);
};

const isUsableIconUrl = (url?: string | null) => {
  const value = String(url || "").trim();
  if (!value) return false;
  if (value.startsWith("data:")) return true;
  if (value.startsWith("/")) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
};

const manifestIcon = (url: string, size: string, purpose: "any" | "maskable" = "any") => ({
  src: url,
  sizes: size,
  type: getImageMime(url),
  purpose,
});

export const buildDynamicManifest = (brandingInput: AppBranding) => {
  const branding = normalizeAppBranding(brandingInput);
  const iconUrl = isUsableIconUrl(branding.faviconUrl) ? branding.faviconUrl : DEFAULT_LOGO;
  const mainLogo = isUsableIconUrl(branding.logoUrl) ? branding.logoUrl : iconUrl;

  return {
    id: "/wmcplayer-pwa",
    name: branding.appName || "WMCPLAYER",
    short_name: branding.appShortName || branding.appName || "WMCPLAYER",
    description: branding.appDescription || "WMCPLAYER - Programa Oficial de Fidelidade",
    theme_color: "#000000",
    background_color: "#000000",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    orientation: "portrait",
    start_url: "/?source=pwa",
    scope: "/",
    categories: ["entertainment", "utilities"],
    icons: [
      manifestIcon(iconUrl, "192x192", "any"),
      manifestIcon(iconUrl, "512x512", "any"),
      manifestIcon(mainLogo, "512x512", "maskable"),
    ],
    shortcuts: [
      {
        name: "Início",
        short_name: "Início",
        description: "Abrir início do app",
        url: "/dashboard",
        icons: [manifestIcon(iconUrl, "192x192", "any")],
      },
      {
        name: "AO VIVO",
        short_name: "AO VIVO",
        description: "Abrir TV ao vivo",
        url: "/tv-guide",
        icons: [manifestIcon(iconUrl, "192x192", "any")],
      },
    ],
  };
};

let dynamicManifestUrl: string | null = null;

export const updateManifest = (brandingInput: AppBranding) => {
  if (typeof document === "undefined") return;

  const branding = normalizeAppBranding(brandingInput);
  const manifest = buildDynamicManifest(branding);

  if (dynamicManifestUrl) URL.revokeObjectURL(dynamicManifestUrl);
  dynamicManifestUrl = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
  );

  let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    document.head.appendChild(manifestLink);
  }

  manifestLink.href = dynamicManifestUrl;
  manifestLink.dataset.dynamicBranding = "true";
  manifestLink.dataset.appName = branding.appName;
};

const notifyServiceWorker = (branding: AppBranding) => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((registration) => {
      const worker = registration.active || registration.waiting || registration.installing;
      worker?.postMessage({ type: "APP_BRANDING_UPDATED", branding });
    })
    .catch(() => undefined);
};

export const applyAppBranding = (brandingInput: AppBranding) => {
  if (typeof document === "undefined") return;

  const branding = normalizeAppBranding(brandingInput);
  const iconUrl = branding.faviconUrl || branding.logoUrl || DEFAULT_LOGO;

  document.title = branding.appName;
  document.documentElement.setAttribute("data-app-name", branding.appName);

  setMeta('meta[name="description"]', "content", branding.appDescription);
  setMeta('meta[name="author"]', "content", branding.appName);
  setMeta('meta[name="application-name"]', "content", branding.appName);
  setMeta('meta[name="apple-mobile-web-app-title"]', "content", branding.appShortName);
  setMeta('meta[property="og:title"]', "content", branding.appName);
  setMeta('meta[property="og:description"]', "content", branding.appDescription);
  setMeta('meta[property="og:image"]', "content", branding.logoUrl || DEFAULT_LOGO);
  setMeta('meta[name="twitter:title"]', "content", branding.appName);
  setMeta('meta[name="twitter:description"]', "content", branding.appDescription);
  setMeta('meta[name="twitter:image"]', "content", branding.logoUrl || DEFAULT_LOGO);

  setMeta('link[rel="icon"]', "href", iconUrl);
  setMeta('link[rel="shortcut icon"]', "href", iconUrl);
  setMeta('link[rel="apple-touch-icon"]', "href", iconUrl);
  setIconType('link[rel="icon"]', iconUrl);
  setIconType('link[rel="shortcut icon"]', iconUrl);
  setIconType('link[rel="apple-touch-icon"]', iconUrl);

  updateManifest(branding);
  notifyServiceWorker(branding);
};

export const previewAppBranding = (brandingInput: Partial<AppBranding>) => {
  if (typeof window === "undefined") return;

  const branding = normalizeAppBranding({
    ...readStoredAppBranding(),
    ...brandingInput,
  });

  applyAppBranding(branding);
  window.dispatchEvent(new CustomEvent(APP_BRANDING_EVENT, { detail: branding }));
};

export const saveStoredAppBranding = (brandingInput: AppBranding) => {
  if (typeof window === "undefined") return;

  const branding = normalizeAppBranding(brandingInput);
  localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(branding));
  localStorage.removeItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY);
  localStorage.removeItem(LEGACY_APP_BRANDING_STORAGE_KEY);
  applyAppBranding(branding);
  window.dispatchEvent(new CustomEvent(APP_BRANDING_EVENT, { detail: branding }));
};

export const loadRemoteAppBranding = async (): Promise<AppBranding | null> => {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("app_name, app_short_name, app_description, app_logo_url, app_favicon_url" as any)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const branding = normalizeAppBranding(data);
    return isLegacyBitzBranding(branding) ? getDefaultAppBranding() : branding;
  } catch {
    return null;
  }
};

export const prepareBrandingForPwaInstall = async (): Promise<AppBranding> => {
  const remoteBranding = await loadRemoteAppBranding();
  const branding = remoteBranding || readStoredAppBranding();

  if (typeof window !== "undefined") {
    localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(branding));
    localStorage.removeItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY);
    localStorage.removeItem(LEGACY_APP_BRANDING_STORAGE_KEY);
  }

  applyAppBranding(branding);
  return branding;
};

export const useAppBranding = () => {
  const [branding, setBranding] = useState<AppBranding>(() => readStoredAppBranding());

  useEffect(() => {
    let cancelled = false;

    const apply = (nextBranding: AppBranding, persist = true) => {
      if (cancelled) return;

      const normalized = normalizeAppBranding(nextBranding);
      setBranding(normalized);
      if (persist) {
        localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(normalized));
        localStorage.removeItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY);
        localStorage.removeItem(LEGACY_APP_BRANDING_STORAGE_KEY);
      }
      applyAppBranding(normalized);
    };

    apply(readStoredAppBranding(), false);

    loadRemoteAppBranding().then((remoteBranding) => {
      if (remoteBranding) apply(remoteBranding, true);
    });

    const listener = (event: Event) => {
      const rawDetail = (event as CustomEvent<any>).detail;
      const detail = rawDetail?.branding || rawDetail;
      if (detail) apply(detail, true);
      else {
        loadRemoteAppBranding().then((remoteBranding) => {
          if (remoteBranding) apply(remoteBranding, true);
        });
      }
    };

    window.addEventListener(APP_BRANDING_EVENT, listener as EventListener);
    window.addEventListener("storage", listener as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener(APP_BRANDING_EVENT, listener as EventListener);
      window.removeEventListener("storage", listener as EventListener);
    };
  }, []);

  return branding;
};
