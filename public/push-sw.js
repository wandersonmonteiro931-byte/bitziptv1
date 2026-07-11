// PUSH NOTIFICATION HANDLERS
// WMCPLAYER: ícone oficial fixo, sem logotipo antigo/cache Bitz.
var DEFAULT_PUSH_ICON = "/app/wmcplayer-icon-512-v4.png";
var DEFAULT_PUSH_BADGE = "/app/wmcplayer-icon-192-v4.png";

var APP_BRANDING_CACHE = {
  appName: "WMCPLAYER",
  appShortName: "WMCPLAYER",
  appDescription: "WMCPLAYER - Programa Oficial de Fidelidade",
  logoUrl: DEFAULT_PUSH_ICON,
  faviconUrl: DEFAULT_PUSH_ICON,
};


var BRANDING_CACHE_NAME = "wmcplayer-branding-v2";
var BRANDING_CACHE_KEY = "/app/__wmcplayer_branding__";

async function persistBrandingCache() {
  try {
    var cache = await caches.open(BRANDING_CACHE_NAME);
    await cache.put(
      BRANDING_CACHE_KEY,
      new Response(JSON.stringify(APP_BRANDING_CACHE), { headers: { "Content-Type": "application/json" } }),
    );
  } catch (e) {}
}

async function restoreBrandingCache() {
  try {
    var cache = await caches.open(BRANDING_CACHE_NAME);
    var response = await cache.match(BRANDING_CACHE_KEY);
    if (!response) return;
    var saved = await response.json();
    APP_BRANDING_CACHE = Object.assign({}, APP_BRANDING_CACHE, saved || {});
    APP_BRANDING_CACHE.logoUrl = normalizeNotificationImage(APP_BRANDING_CACHE.logoUrl, DEFAULT_PUSH_ICON);
    APP_BRANDING_CACHE.faviconUrl = normalizeNotificationImage(APP_BRANDING_CACHE.faviconUrl, DEFAULT_PUSH_ICON);
  } catch (e) {}
}

function isOldBitzIcon(value) {
  if (!value || typeof value !== "string") return false;
  var lower = value.toLowerCase();
  return lower.indexOf("bitz") >= 0 || lower.indexOf("logo-bitz") >= 0 || lower.indexOf("bitziptv") >= 0;
}

function isLegacyWmcplayerIcon(value) {
  if (!value || typeof value !== "string") return false;
  return /(?:wmcplayer-(?:icon-(?:192|512)-v3|maskable-512-v3|apple-touch-v3|favicon-v3)\.(?:png|ico))(?:[?#].*)?$/i.test(value.trim());
}

function normalizeNotificationImage(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  var normalized = value.trim();
  return isLegacyWmcplayerIcon(normalized) ? fallback : normalized;
}

function isUsableNotificationImage(value) {
  if (!value || typeof value !== "string") return false;
  var url = value.trim();
  if (!url || isOldBitzIcon(url)) return false;

  return (
    url.indexOf("/") === 0 ||
    url.indexOf("https://") === 0 ||
    url.indexOf("http://") === 0 ||
    url.indexOf("data:image/") === 0
  );
}

function pickNotificationIcon(data) {
  // Nunca usa data.icon se vier com logo antigo.
  if (isUsableNotificationImage(data && data.icon)) return normalizeNotificationImage(data.icon, DEFAULT_PUSH_ICON);
  if (isUsableNotificationImage(APP_BRANDING_CACHE.faviconUrl)) return normalizeNotificationImage(APP_BRANDING_CACHE.faviconUrl, DEFAULT_PUSH_ICON);
  if (isUsableNotificationImage(APP_BRANDING_CACHE.logoUrl)) return normalizeNotificationImage(APP_BRANDING_CACHE.logoUrl, DEFAULT_PUSH_ICON);
  return DEFAULT_PUSH_ICON;
}

function pickNotificationBadge(data) {
  if (isUsableNotificationImage(data && data.badge)) return normalizeNotificationImage(data.badge, DEFAULT_PUSH_BADGE);
  if (isUsableNotificationImage(APP_BRANDING_CACHE.faviconUrl)) return normalizeNotificationImage(APP_BRANDING_CACHE.faviconUrl, DEFAULT_PUSH_BADGE);
  return DEFAULT_PUSH_BADGE;
}

self.addEventListener("message", function (event) {
  if (!event.data) return;

  var type = event.data.type;

  if (type === "SKIP_WAITING" || type === "FORCE_UPDATE") {
    self.skipWaiting();
    return;
  }

  if (type !== "APP_BRANDING_UPDATED") return;

  var branding = event.data.branding || {};
  APP_BRANDING_CACHE = Object.assign({}, APP_BRANDING_CACHE, branding, {
    appName: branding.appName || branding.app_name || "WMCPLAYER",
    appShortName: branding.appShortName || branding.app_short_name || "WMCPLAYER",
    logoUrl: isUsableNotificationImage(branding.logoUrl || branding.app_logo_url)
      ? normalizeNotificationImage(branding.logoUrl || branding.app_logo_url, DEFAULT_PUSH_ICON)
      : DEFAULT_PUSH_ICON,
    faviconUrl: isUsableNotificationImage(branding.faviconUrl || branding.app_favicon_url)
      ? normalizeNotificationImage(branding.faviconUrl || branding.app_favicon_url, DEFAULT_PUSH_ICON)
      : DEFAULT_PUSH_ICON,
  });
  event.waitUntil(persistBrandingCache());
});

self.addEventListener("push", function (event) {
  event.waitUntil(
    (async function () {
      await restoreBrandingCache();
      var data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (e) {
        data = { title: event.data ? event.data.text() : "Nova notificação" };
      }

      var title = data.title || APP_BRANDING_CACHE.appName || "WMCPLAYER";
      var icon = pickNotificationIcon(data);
      var badge = pickNotificationBadge(data);

      var options = {
        body: data.body || "",
        icon: icon,
        badge: badge,
        image: isUsableNotificationImage(data.image) ? data.image.trim() : undefined,
        data: data.data || { url: data.url || "/app/" },
        vibrate: [120, 60, 120],
        requireInteraction: !!data.requireInteraction,
        silent: false,
      };

      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var targetUrl = "/app/";
  try {
    targetUrl =
      (event.notification.data && (event.notification.data.url || event.notification.data.click_action)) || "/app/";
  } catch (e) {}

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i];
        if (client.url && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
