/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATION HANDLER — MUST be registered at TOP LEVEL
// (synchronously, during initial SW evaluation)
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
        var rawText = "";
        try {
          rawText = event.data.text();
        } catch (_e) {
          // stream unavailable
        }

        if (rawText) {
          try {
            var data = JSON.parse(rawText);
            title = data.title || title;
            body = data.body || data.message || body;
            icon = data.icon || icon;
            badge = data.badge || badge;
            if (data.data && data.data.url) url = data.data.url;
          } catch (_e) {
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
        data: { url: url },
      } as NotificationOptions & { vibrate?: number[]; renotify?: boolean });
    })()
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (
            client.url.indexOf(self.location.origin) !== -1 &&
            "focus" in client
          ) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// WORKBOX PRECACHING & ROUTING
// ═══════════════════════════════════════════════════════════════
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

// Skip waiting when told by client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Claim clients immediately after activation
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Precache all assets from the build manifest
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback
const denylist = [/^\/~oauth/];
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist }));
