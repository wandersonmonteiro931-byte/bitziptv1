/* WMCPLAYER - desativa Service Workers e caches do dominio antigo. */
const DESTINO_OFICIAL = "https://wmcplayer.pages.dev/aplicativo/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(clients.map((client) => client.navigate(DESTINO_OFICIAL)));

    await self.registration.unregister();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(Response.redirect(DESTINO_OFICIAL, 302));
  }
});
