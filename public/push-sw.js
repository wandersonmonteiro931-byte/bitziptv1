// PUSH NOTIFICATION HANDLERS
// Mantém título/ícone das notificações compatíveis com a identidade configurável do app.
var APP_BRANDING_CACHE = {
  appName: "Bitz IPTV",
  appShortName: "Bitz IPTV",
  appDescription: "Bitz IPTV - Programa de Fidelidade",
  logoUrl: "/logo-bitz.jpg",
  faviconUrl: "/logo-bitz.jpg",
};

self.addEventListener("message", function (event) {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data.type !== "APP_BRANDING_UPDATED") return;
  APP_BRANDING_CACHE = Object.assign({}, APP_BRANDING_CACHE, event.data.branding || {});
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : "Nova notificação" };
  }

  var title = data.title || APP_BRANDING_CACHE.appName || "Nova notificação";
  var icon = data.icon || APP_BRANDING_CACHE.faviconUrl || APP_BRANDING_CACHE.logoUrl || "/logo-bitz.jpg";
  var badge = data.badge || APP_BRANDING_CACHE.faviconUrl || APP_BRANDING_CACHE.logoUrl || "/logo-bitz.jpg";

  var options = {
    body: data.body || "",
    icon: icon,
    badge: badge,
    data: data.data || { url: data.url || "/" },
    vibrate: [100, 50, 100],
    requireInteraction: !!data.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(title, options));
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

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING" || type === "FORCE_UPDATE") {
    self.skipWaiting();
  }
});
