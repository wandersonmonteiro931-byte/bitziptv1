// Push notification service worker (imported into PWA SW via importScripts)
self.addEventListener("push", function (event) {
  // CRITICAL: event.waitUntil MUST be called synchronously (not inside async/await)
  // and MUST always result in showNotification, or Android will say "no notifications posted"
  event.waitUntil(
    (async function () {
      try {
        var title = "Bitz IPTV";
        var body = "Nova notificação";
        var icon = "/logo-bitz.jpg";
        var badge = "/logo-bitz.jpg";
        var url = "/";

        if (event.data) {
          try {
            var data = event.data.json();
            title = data.title || title;
            body = data.body || data.message || body;
            icon = data.icon || icon;
            badge = data.badge || badge;
            if (data.data && data.data.url) url = data.data.url;
          } catch (e) {
            // JSON parse failed, try plain text
            try {
              body = event.data.text() || body;
            } catch (e2) {
              // ignore
            }
          }
        }

        return self.registration.showNotification(title, {
          body: body,
          icon: icon,
          badge: badge,
          vibrate: [200, 100, 200],
          tag: "bitz-" + Date.now(),
          renotify: true,
          data: { url: url },
        });
      } catch (err) {
        // ABSOLUTE FALLBACK: no matter what, show something
        return self.registration.showNotification("Bitz IPTV", {
          body: "Você tem uma nova notificação",
          icon: "/logo-bitz.jpg",
        });
      }
    })()
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
