// PUSH NOTIFICATION HANDLERS
// WMCFLIX: notificação precisa funcionar mesmo com PWA fechado.
var DEFAULT_PUSH_ICON = "/pwa-512.png";
var DEFAULT_PUSH_BADGE = "/pwa-192.png";

var APP_BRANDING_CACHE = {
  appName: "WMCFLIX",
  appShortName: "WMCFLIX",
  appDescription: "WMCFLIX - Programa Oficial de Fidelidade",
  logoUrl: DEFAULT_PUSH_ICON,
  faviconUrl: DEFAULT_PUSH_ICON,
};

function isUsableNotificationImage(value) {
  if (!value || typeof value !== "string") return false;
  var url = value.trim();
  if (!url) return false;

  return (
    url.indexOf("/") === 0 ||
    url.indexOf("https://") === 0 ||
    url.indexOf("http://") === 0 ||
    url.indexOf("data:image/") === 0
  );
}

function pickNotificationIcon(data) {
  if (isUsableNotificationImage(data && data.icon)) return data.icon.trim();
  if (isUsableNotificationImage(APP_BRANDING_CACHE.faviconUrl)) return APP_BRANDING_CACHE.faviconUrl.trim();
  if (isUsableNotificationImage(APP_BRANDING_CACHE.logoUrl)) return APP_BRANDING_CACHE.logoUrl.trim();
  return DEFAULT_PUSH_ICON;
}

function pickNotificationBadge(data) {
  if (isUsableNotificationImage(data && data.badge)) return data.badge.trim();
  if (isUsableNotificationImage(APP_BRANDING_CACHE.faviconUrl)) return APP_BRANDING_CACHE.faviconUrl.trim();
  return DEFAULT_PUSH_BADGE;
}

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

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
    appName: branding.appName || branding.app_name || APP_BRANDING_CACHE.appName || "WMCFLIX",
    appShortName: branding.appShortName || branding.app_short_name || APP_BRANDING_CACHE.appShortName || "WMCFLIX",
    logoUrl: isUsableNotificationImage(branding.logoUrl || branding.app_logo_url)
      ? branding.logoUrl || branding.app_logo_url
      : APP_BRANDING_CACHE.logoUrl || DEFAULT_PUSH_ICON,
    faviconUrl: isUsableNotificationImage(branding.faviconUrl || branding.app_favicon_url)
      ? branding.faviconUrl || branding.app_favicon_url
      : APP_BRANDING_CACHE.faviconUrl || DEFAULT_PUSH_ICON,
  });
});

self.addEventListener("push", function (event) {
  event.waitUntil(
    (async function () {
      var data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (e) {
        data = { title: event.data ? event.data.text() : "Nova notificação" };
      }

      var title = data.title || APP_BRANDING_CACHE.appName || "WMCFLIX";
      var icon = pickNotificationIcon(data);
      var badge = pickNotificationBadge(data);

      var options = {
        body: data.body || "",
        icon: icon,
        badge: badge,
        image: isUsableNotificationImage(data.image) ? data.image.trim() : undefined,
        data: data.data || { url: data.url || "/" },
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

  var targetUrl = "/";
  try {
    targetUrl =
      (event.notification.data && (event.notification.data.url || event.notification.data.click_action)) || "/";
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
