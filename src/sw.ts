/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATION HANDLER — MUST be registered at TOP LEVEL
// ═══════════════════════════════════════════════════════════════
self.addEventListener("push", function (event: PushEvent) {
  event.waitUntil(
    (async () => {
      let title = "Bitz IPTV";
      let body = "Nova notificação";
      let icon = "/logo-bitz.jpg";
      let badge = "/logo-bitz.jpg";
      let url = "/";

      if (event.data) {
        try {
          const rawText = event.data.text();
          if (rawText) {
            try {
              const data = JSON.parse(rawText);
              title = data.title || title;
              body = data.body || data.message || body;
              icon = data.icon || icon;
              badge = data.badge || badge;
              if (data.data && data.data.url) url = data.data.url;
            } catch (_e) {
              body = rawText;
            }
          }
        } catch (_e) {
          // stream unavailable
        }
      }

      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        vibrate: [200, 100, 200],
        tag: "bitz-" + Date.now(),
        renotify: true,
        data: { url },
      } as NotificationOptions);
    })()
  );
});

self.addEventListener("notificationclick", function (event: NotificationEvent) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// ═══════════════════════════════════════════════════════════════
// WORKBOX PRECACHING & ROUTING
// ═══════════════════════════════════════════════════════════════
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/~oauth/] }));
