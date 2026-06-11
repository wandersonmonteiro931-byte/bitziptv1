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

export const getDefaultAppBranding = () => ({ ...DEFAULT_BRANDING });

export const normalizeAppBranding = (row?: any): AppBranding => {
  const appName = textOrDefault(row?.app_name, DEFAULT_BRANDING.appName);
  const appShortName = textOrDefault(row?.app_short_name, appName);
  const appDescription = textOrDefault(row?.app_description, `${appName} - Programa de Fidelidade`);
  const logoUrl = textOrDefault(row?.app_logo_url, DEFAULT_BRANDING.logoUrl);
  const faviconUrl = textOrDefault(row?.app_favicon_url, logoUrl);

  return { appName, appShortName, appDescription, logoUrl, faviconUrl };
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

export const applyAppBranding = (branding: AppBranding) => {
  if (typeof document === "undefined") return;

  document.title = branding.appName;

  setMeta('meta[name="description"]', "content", branding.appDescription);
  setMeta('meta[name="author"]', "content", branding.appName);
  setMeta('meta[name="apple-mobile-web-app-title"]', "content", branding.appShortName);
  setMeta('meta[property="og:title"]', "content", branding.appName);
  setMeta('meta[property="og:description"]', "content", branding.appDescription);
  setMeta('meta[property="og:image"]', "content", branding.logoUrl);
  setMeta('meta[name="twitter:image"]', "content", branding.logoUrl);

  setMeta('link[rel="icon"]', "href", branding.faviconUrl);
  setMeta('link[rel="apple-touch-icon"]', "href", branding.faviconUrl);

  const iconUrl = branding.faviconUrl || branding.logoUrl;
  const iconType = getImageMime(iconUrl);
  const manifest = {
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

  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  const blobUrl = URL.createObjectURL(blob);
  manifestLink.href = blobUrl;
  manifestLink.dataset.blobUrl = blobUrl;
};

export const saveStoredAppBranding = (branding: AppBranding) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(branding));
  applyAppBranding(branding);
  window.dispatchEvent(new CustomEvent("app-branding-updated", { detail: branding }));
};

export const useAppBranding = () => {
  const [branding, setBranding] = useState<AppBranding>(() => {
    if (typeof window === "undefined") return getDefaultAppBranding();
    try {
      const stored = localStorage.getItem(APP_BRANDING_STORAGE_KEY);
      if (stored) return normalizeAppBranding(JSON.parse(stored));
    } catch {}
    return getDefaultAppBranding();
  });

  useEffect(() => {
    let cancelled = false;

    const apply = (nextBranding: AppBranding) => {
      if (cancelled) return;
      setBranding(nextBranding);
      localStorage.setItem(APP_BRANDING_STORAGE_KEY, JSON.stringify(nextBranding));
      applyAppBranding(nextBranding);
    };

    apply(branding);

    const load = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("app_name, app_short_name, app_description, app_logo_url, app_favicon_url" as any)
        .limit(1)
        .maybeSingle();

      apply(normalizeAppBranding(data));
    };

    load();

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AppBranding>).detail;
      if (detail) apply(normalizeAppBranding(detail));
      else load();
    };

    window.addEventListener("app-branding-updated", listener as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("app-branding-updated", listener as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return branding;
};
