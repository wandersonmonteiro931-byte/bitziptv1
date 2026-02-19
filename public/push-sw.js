// Push notification service worker (imported into PWA SW via importScripts)
self.addEventListener("push", (event) => {
  // Default fallback data
  const fallback = {
    title: "Bitz IPTV",
    body: "Nova notificação",
    icon: "/logo-bitz.jpg",
    badge: "/logo-bitz.jpg",
    data: { url: "/" },
  };

  let payload = fallback;

  if (event.data) {
    try {
      const json = event.data.json();
      payload = { ...fallback, ...json };
    } catch (e) {
      // If JSON parsing fails, try as text
      try {
        const text = event.data.text();
        payload = { ...fallback, body: text };
      } catch (e2) {
        console.error("Push: failed to parse payload", e2);
      }
    }
  }

  const options = {
    body: payload.body || fallback.body,
    icon: payload.icon || "/logo-bitz.jpg",
    badge: payload.badge || "/logo-bitz.jpg",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: "bitz-push-" + Date.now(), // Unique tag prevents grouping/replacing
    renotify: true, // Always alert even if same tag
    data: payload.data || { url: "/" },
    silent: false, // Ensure sound/vibration
  };

  // CRITICAL: waitUntil keeps the SW alive until showNotification resolves
  event.waitUntil(
    self.registration.showNotification(payload.title || fallback.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
