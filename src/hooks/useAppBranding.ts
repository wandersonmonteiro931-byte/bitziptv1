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
export const APP_MANIFEST_ENDPOINT =
  "https://vywtzzrvpdjqpcnixskz.supabase.co/functions/v1/app-manifest";

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

const isLegacyBranding = (branding: AppBranding) => {
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
  const faviconUrl = textOrDefault(
    row?.app_favicon_url ?? row?.faviconUrl,
    logoUrl || DEFAULT_BRANDING.faviconUrl,
  );

  return { appName, appShortName, appDescription, logoUrl, faviconUrl };
};

const safeParseBranding = (value: string | null): AppBranding | null => {
  if (!value) return null;

  try {
    const branding = normalizeAppBranding(JSON.parse(value));
    return isLegacyBranding(branding) ? null : branding;
  } catch {
    return null;
  }
};

export const readStoredAppBranding = (): AppBranding => {
  if (typeof window === "undefined") return getDefaultAppBranding();

  try {
    const stored = safeParseBranding(localStorage.getItem(APP_BRANDING_STORAGE_KEY));
    if (stored) return stored;

    const legacyWmcflix = safeParseBranding(
      localStorage.getItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY),
    );
    localStorage.removeItem(LEGACY_WMCFLIX_APP_BRANDING_STORAGE_KEY);
    if (legacyWmcflix) {
      localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(legacyWmcflix));
      return legacyWmcflix;
    }

    // A chave antiga é apenas removida. Nenhuma identidade antiga volta a ser usada.
    localStorage.removeItem(LEGACY_APP_BRANDING_STORAGE_KEY);

    const bootBranding = (window as any).__APP_BRANDING_BOOT__;
    if (bootBranding) {
      const normalized = normalizeAppBranding(bootBranding);
      if (!isLegacyBranding(normalized)) return normalized;
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
    } else {
      element = document.createElement("link");
      const relMatch = selector.match(/rel="([^"]+)"/);
      if (relMatch) (element as HTMLLinkElement).rel = relMatch[1];
    }

    if (element) document.head.appendChild(element);
  }

  element?.setAttribute(attr, value);
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
  return /^https?:\/\//i.test(value);
};

const manifestIcon = (url: string, size: string, purpose: "any" | "maskable" = "any") => ({
  src: url,
  sizes: size,
  type: getImageMime(url),
  purpose,
});

export const buildDynamicManifest = (brandingInput: AppBranding) => {
  const branding = normalizeAppBranding(brandingInput);
  const iconUrl = isUsableIconUrl(branding.faviconUrl)
    ? branding.faviconUrl
    : isUsableIconUrl(branding.logoUrl)
      ? branding.logoUrl
      : DEFAULT_LOGO;

  return {
    id: "/",
    name: branding.appName,
    short_name: branding.appShortName,
    description: branding.appDescription,
    theme_color: "#000000",
    background_color: "#000000",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    orientation: "any",
    start_url: "/?source=pwa",
    scope: "/",
    categories: ["entertainment", "utilities"],
    icons: [
      manifestIcon(iconUrl, "192x192", "any"),
      manifestIcon(iconUrl, "512x512", "any"),
    ],
  };
};

const fingerprintBranding = (brandingInput: AppBranding) => {
  const branding = normalizeAppBranding(brandingInput);
  const source = [
    branding.appName,
    branding.appShortName,
    branding.appDescription,
    branding.logoUrl,
    branding.faviconUrl,
  ].join("|");

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const getAppManifestUrl = (brandingInput?: AppBranding) => {
  if (!brandingInput) return `${APP_MANIFEST_ENDPOINT}?v=admin`;
  return `${APP_MANIFEST_ENDPOINT}?v=${fingerprintBranding(brandingInput)}`;
};

export const updateManifest = (brandingInput: AppBranding) => {
  if (typeof document === "undefined") return;

  const branding = normalizeAppBranding(brandingInput);
  let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    document.head.appendChild(manifestLink);
  }

  manifestLink.crossOrigin = "anonymous";
  manifestLink.href = getAppManifestUrl(branding);
  manifestLink.dataset.dynamicBranding = "admin";
  manifestLink.dataset.appName = branding.appName;
};

let lastWorkerBrandingFingerprint = "";

const notifyServiceWorker = (branding: AppBranding) => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const fingerprint = fingerprintBranding(branding);
  if (fingerprint === lastWorkerBrandingFingerprint) return;
  lastWorkerBrandingFingerprint = fingerprint;

  navigator.serviceWorker.ready
    .then((registration) => {
      const worker = registration.active || registration.waiting || registration.installing;
      worker?.postMessage({ type: "APP_BRANDING_UPDATED", branding });
      return registration.update().catch(() => undefined);
    })
    .catch(() => undefined);
};

export const applyAppBranding = (brandingInput: AppBranding) => {
  if (typeof document === "undefined") return;

  const branding = normalizeAppBranding(brandingInput);
  const installIcon = branding.faviconUrl || branding.logoUrl || DEFAULT_LOGO;

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

  setMeta('link[rel="icon"]', "href", installIcon);
  setMeta('link[rel="shortcut icon"]', "href", installIcon);
  setMeta('link[rel="apple-touch-icon"]', "href", installIcon);
  setIconType('link[rel="icon"]', installIcon);
  setIconType('link[rel="shortcut icon"]', installIcon);
  setIconType('link[rel="apple-touch-icon"]', installIcon);

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

let remoteBrandingPromise: Promise<AppBranding | null> | null = null;
let remoteBrandingCache: AppBranding | null = null;

export const loadRemoteAppBranding = async (force = false): Promise<AppBranding | null> => {
  if (!force && remoteBrandingCache) return remoteBrandingCache;
  if (!force && remoteBrandingPromise) return remoteBrandingPromise;

  remoteBrandingPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("app_name, app_short_name, app_description, app_logo_url, app_favicon_url" as any)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      const branding = normalizeAppBranding(data);
      remoteBrandingCache = isLegacyBranding(branding) ? getDefaultAppBranding() : branding;
      return remoteBrandingCache;
    } catch {
      return null;
    } finally {
      remoteBrandingPromise = null;
    }
  })();

  return remoteBrandingPromise;
};

export const prepareBrandingForPwaInstall = async (): Promise<AppBranding> => {
  const remoteBranding = await loadRemoteAppBranding(true);
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
      remoteBrandingCache = normalized;
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
      if (detail) {
        apply(detail, true);
        return;
      }

      loadRemoteAppBranding(true).then((remoteBranding) => {
        if (remoteBranding) apply(remoteBranding, true);
      });
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
