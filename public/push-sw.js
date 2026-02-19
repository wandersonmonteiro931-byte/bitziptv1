// Push notification handler (imported into PWA SW via importScripts)
self.addEventListener("push", function (event) {
  event.waitUntil(
    (function () {
      var title = "Bitz IPTV";
      var body = "Nova notificação";
      var icon = "/logo-bitz.jpg";
      var badge = "/logo-bitz.jpg";
      var url = "/";

      if (event.data) {
        // CRITICAL: Read as text FIRST — event.data can only be consumed ONCE.
        // If json() fails, the stream is gone and text() returns empty.
        var rawText = "";
        try {
          rawText = event.data.text();
        } catch (e) {
          // stream already consumed or unavailable
        }

        if (rawText) {
          try {
            var data = JSON.parse(rawText);
            title = data.title || title;
            body = data.body || data.message || body;
            icon = data.icon || icon;
            badge = data.badge || badge;
            if (data.data && data.data.url) url = data.data.url;
          } catch (e) {
            // Not valid JSON — use raw text as body
            body = rawText;
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
        data: { url: url }
      });
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
