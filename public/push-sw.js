// ═══════════════════════════════════════════════════════════════
// BITZ IPTV — PUSH NOTIFICATION HANDLERS
// This code is PREPENDED to sw.js by the build plugin,
// ensuring handlers are registered SYNCHRONOUSLY at the TOP LEVEL
// before any Workbox module loading (which is async).
// ═══════════════════════════════════════════════════════════════

self.addEventListener("push", function (event) {
  event.waitUntil(
    (function () {
      var title = "Bitz IPTV";
      var body = "Nova notificação";
      var icon = "/logo-bitz.jpg";
      var badge = "/logo-bitz.jpg";
      var url = "/";

      if (event.data) {
        try {
          var rawText = event.data.text();
          if (rawText) {
            try {
              var data = JSON.parse(rawText);
              title = data.title || title;
              body = data.body || data.message || body;
              icon = data.icon || icon;
              badge = data.badge || badge;
              if (data.data && data.data.url) url = data.data.url;
            } catch (e) {
              body = rawText;
            }
          }
        } catch (e) {
          // stream unavailable — show default notification
        }
      }

      return self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: badge,
        vibrate: [200, 100, 200],
        tag: "bitz-" + Date.now(),
        renotify: true,
        requireInteraction: true,
        data: { url: url }
      });
    })()
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ═══════════════════════════════════════════════════════════════
// END OF PUSH HANDLERS — Workbox code follows below
// ═══════════════════════════════════════════════════════════════

