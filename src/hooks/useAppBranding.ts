import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppBranding = {
  appName: string;
  appShortName: string;
  appDescription: string;
  logoUrl: string;
  faviconUrl: string;
};

const STORAGE_KEY = "app_branding_v1";

const DEFAULTS: AppBranding = {
  appName: "BITZ IPTV",
  appShortName: "BITZ",
  appDescription: "BITZ IPTV - Programa de Fidelidade",
  logoUrl: "",
  faviconUrl: "",
};

export function normalizeAppBranding(raw: any): AppBranding {
  if (!raw) return { ...DEFAULTS };
  const appName = (raw.app_name ?? raw.appName ?? DEFAULTS.appName).toString().trim() || DEFAULTS.appName;
  const appShortName = (raw.app_short_name ?? raw.appShortName ?? appName).toString().trim() || appName;
  const appDescription =
    (raw.app_description ?? raw.appDescription ?? `${appName} - Programa de Fidelidade`).toString().trim() ||
    `${appName} - Programa de Fidelidade`;
  const logoUrl = (raw.app_logo_url ?? raw.logoUrl ?? "").toString().trim();
  const faviconUrl = (raw.app_favicon_url ?? raw.faviconUrl ?? logoUrl).toString().trim();
  return { appName, appShortName, appDescription, logoUrl, faviconUrl };
}

export function getStoredAppBranding(): AppBranding {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return normalizeAppBranding(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveStoredAppBranding(branding: AppBranding) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));
    applyBrandingToDocument(branding);
  } catch {
    /* ignore */
  }
}

export function applyBrandingToDocument(branding: AppBranding) {
  if (typeof document === "undefined") return;
  if (branding.appName) document.title = branding.appName;

  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }

  if (branding.appDescription) {
    let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = branding.appDescription;
  }
}

export function useAppBranding(): AppBranding {
  const [branding, setBranding] = useState<AppBranding>(() => getStoredAppBranding());

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("platform_settings")
      .select("app_name, app_short_name, app_description, app_logo_url, app_favicon_url")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!mounted || !data) return;
        const next = normalizeAppBranding(data);
        setBranding(next);
        saveStoredAppBranding(next);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return branding;
}
