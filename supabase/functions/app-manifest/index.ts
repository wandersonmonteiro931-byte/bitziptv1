import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_ORIGIN = "https://wmcplayer.pages.dev";
const APP_PATH = "/app";
const APP_ORIGIN = `${SITE_ORIGIN}${APP_PATH}`;
const DEFAULT_ICON_192 = `${APP_ORIGIN}/wmcplayer-icon-192-v3.png`;
const DEFAULT_ICON_512 = `${APP_ORIGIN}/wmcplayer-icon-512-v3.png`;
const DEFAULT_MASKABLE_512 = `${APP_ORIGIN}/wmcplayer-maskable-512-v3.png`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const manifestHeaders = {
  ...corsHeaders,
  "Content-Type": "application/manifest+json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Origin",
};

const textOrDefault = (value: unknown, fallback: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

const isUsableImageUrl = (value: unknown): value is string => {
  const url = typeof value === "string" ? value.trim() : "";
  return /^https:\/\//i.test(url) || /^data:image\//i.test(url);
};

const imageMime = (url: string) => {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".ico")) return "image/x-icon";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
};

const manifestIcon = (src: string, sizes: string, purpose: "any" | "maskable" = "any") => ({
  src,
  sizes,
  type: imageMime(src),
  purpose,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: manifestHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";

  let settings: Record<string, unknown> | null = null;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data } = await supabaseAdmin
        .from("platform_settings")
        .select("app_name, app_short_name, app_description, app_logo_url, app_favicon_url")
        .limit(1)
        .maybeSingle();

      settings = (data as Record<string, unknown> | null) || null;
    } catch {
      settings = null;
    }
  }

  const appName = textOrDefault(settings?.app_name, "WMCPLAYER");
  const shortName = textOrDefault(settings?.app_short_name, appName);
  const description = textOrDefault(
    settings?.app_description,
    `${appName} - Programa Oficial de Fidelidade`,
  );

  // O ícone de instalação é exclusivamente o favicon definido pelo administrador.
  // O logotipo principal fica reservado para cabeçalho, login e splash.
  const adminFavicon = isUsableImageUrl(settings?.app_favicon_url)
    ? String(settings?.app_favicon_url).trim()
    : "";
  const adminLogo = isUsableImageUrl(settings?.app_logo_url)
    ? String(settings?.app_logo_url).trim()
    : "";
  const installIcon = adminFavicon || adminLogo;

  const icons = installIcon
    ? [
        manifestIcon(installIcon, "192x192", "any"),
        manifestIcon(installIcon, "512x512", "any"),
      ]
    : [
        manifestIcon(DEFAULT_ICON_192, "192x192", "any"),
        manifestIcon(DEFAULT_ICON_512, "512x512", "any"),
        manifestIcon(DEFAULT_MASKABLE_512, "512x512", "maskable"),
      ];

  const manifest = {
    id: `${APP_ORIGIN}/`,
    name: appName,
    short_name: shortName,
    description,
    lang: "pt-BR",
    dir: "ltr",
    theme_color: "#000000",
    background_color: "#000000",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    orientation: "any",
    start_url: `${APP_ORIGIN}/?source=pwa`,
    scope: `${APP_ORIGIN}/`,
    categories: ["entertainment", "utilities"],
    prefer_related_applications: false,
    icons,
    shortcuts: [
      {
        name: "Início",
        short_name: "Início",
        description: "Abrir início do aplicativo",
        url: `${APP_ORIGIN}/dashboard`,
        icons: [icons[0]],
      },
      {
        name: "AO VIVO",
        short_name: "AO VIVO",
        description: "Abrir TV ao vivo",
        url: `${APP_ORIGIN}/tv-guide`,
        icons: [icons[0]],
      },
    ],
  };

  return new Response(JSON.stringify(manifest), { headers: manifestHeaders });
});
