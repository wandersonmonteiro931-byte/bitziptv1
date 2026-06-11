import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/logo-bitz.jpg";

export type AppBranding = {
  appName: string;
  appShortName: string;
  appDescription: string;
  logoUrl: string;
  faviconUrl: string;
};

export const APP_BRANDING_STORAGE_KEY = "bitz_app_branding";
export const APP_BRANDING_EVENT = "app-branding-updated";

const DEFAULT_BRANDING: AppBranding = {
  appName: "Bitz IPTV",
  appShortName: "Bitz IPTV",
  appDescription: "Bitz IPTV - Programa de Fidelidade",
  logoUrl: defaultLogo,
  faviconUrl: defaultLogo,
};

const textOrDefault = (value: unknown, fallback: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

export const getDefaultAppBranding = (): AppBranding => ({ ...DEFAULT_BRANDING });

export const normalizeAppBranding = (row?: any): AppBranding => {
  const appName = textOrDefault(row?.app_name ?? row?.appName, DEFAULT_BRANDING.appName);
  const appShortName = textOrDefault(row?.app_short_name ?? row?.appShortName, appName);
  const appDescription = textOrDefault(
    row?.app_description ?? row?.appDescription,
    `${appName} - Programa de Fidelidade`,
  );
  const logoUrl = textOrDefault(row?.app_logo_url ?? row?.logoUrl, DEFAULT_BRANDING.logoUrl);
  const faviconUrl = textOrDefault(row?.app_favicon_url ?? row?.faviconUrl, logoUrl);

  return { appName, appShortName, appDescription, logoUrl, faviconUrl };
};

export const readStoredAppBranding = (): AppBranding => {
  if (typeof window === "undefined") return getDefaultAppBranding();

  try {
    const stored = localStorage.getItem(APP_BRANDING_STORAGE_KEY);
    if (stored) return normalizeAppBranding(JSON.parse(stored));

    const bootBranding = (window as any).__APP_BRANDING_BOOT__;
    if (bootBranding) return normalizeAppBranding(bootBranding);
  } catch {
    localStorage.removeItem(APP_BRANDING_STORAGE_KEY);
  }

  return getDefaultAppBranding();
};

const getImageMime = (url: string) => {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".ico")) return "image/x-icon";
  return "image/jpeg";
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

export const buildDynamicManifest = (branding: AppBranding) => {
  const iconUrl = branding.faviconUrl || branding.logoUrl;
  const iconType = getImageMime(iconUrl);

  return {
    name: branding.appName,
    short_name: branding.appShortName,
    description: branding.appDescription,
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    scope: "/",
    icons: [
      { src: iconUrl, sizes: "192x192", type: iconType, purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: iconType, purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: iconType, purpose: "maskable" },
    ],
  };
};

const updateManifest = (branding: AppBranding) => {
  if (typeof document === "undefined") return;

  document
    .querySelectorAll('link[rel="manifest"]:not([data-dynamic-branding="true"])')
    .forEach((link) => link.remove());

  let manifestLink = document.querySelector(
    'link[rel="manifest"][data-dynamic-branding="true"]',
  ) as HTMLLinkElement | null;

  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.setAttribute("data-dynamic-branding", "true");
    document.head.appendChild(manifestLink);
  }

  const oldBlobUrl = manifestLink.dataset.blobUrl;
  if (oldBlobUrl) URL.revokeObjectURL(oldBlobUrl);

  const blob = new Blob([JSON.stringify(buildDynamicManifest(branding))], { type: "application/manifest+json" });
  const blobUrl = URL.createObjectURL(blob);
  manifestLink.href = blobUrl;
  manifestLink.dataset.blobUrl = blobUrl;
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
  const iconUrl = branding.faviconUrl || branding.logoUrl;

  document.title = branding.appName;
  document.documentElement.setAttribute("data-app-name", branding.appName);

  setMeta('meta[name="description"]', "content", branding.appDescription);
  setMeta('meta[name="author"]', "content", branding.appName);
  setMeta('meta[name="application-name"]', "content", branding.appName);
  setMeta('meta[name="apple-mobile-web-app-title"]', "content", branding.appShortName);
  setMeta('meta[property="og:title"]', "content", branding.appName);
  setMeta('meta[property="og:description"]', "content", branding.appDescription);
  setMeta('meta[property="og:image"]', "content", branding.logoUrl);
  setMeta('meta[name="twitter:title"]', "content", branding.appName);
  setMeta('meta[name="twitter:description"]', "content", branding.appDescription);
  setMeta('meta[name="twitter:image"]', "content", branding.logoUrl);

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
    return normalizeAppBranding(data);
  } catch {
    return null;
  }
};

export const useAppBranding = () => {
  const [branding, setBranding] = useState<AppBranding>(() => readStoredAppBranding());

  useEffect(() => {
    let cancelled = false;

    const apply = (nextBranding: AppBranding, persist = true) => {
      if (cancelled) return;

      const normalized = normalizeAppBranding(nextBranding);
      setBranding(normalized);
      if (persist) localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(normalized));
      applyAppBranding(normalized);
    };

    apply(readStoredAppBranding(), false);

    loadRemoteAppBranding().then((remoteBranding) => {
      if (remoteBranding) apply(remoteBranding, true);
    });

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AppBranding>).detail;
      if (detail) apply(detail, false);
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
