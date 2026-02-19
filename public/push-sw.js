// Push notification service worker
self.addEventListener("push", (event) => {
  let data = { title: "Bitz IPTV", body: "Nova notificação", icon: "/logo-bitz.jpg", badge: "/logo-bitz.jpg", data: { url: "/" } };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error("Error parsing push data:", e);
  }

  const options = {
    body: data.body,
    icon: data.icon || "/logo-bitz.jpg",
    badge: data.badge || "/logo-bitz.jpg",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data.data || { url: "/" },
    actions: [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
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
