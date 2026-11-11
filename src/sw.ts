/// <reference lib="webworker" />
// Service worker : fonctionnement hors ligne de l'interface + notifications push
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string; urgent?: boolean } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Évolution", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      requireInteraction: !!data.urgent,
      data: { url: data.url ?? "/" },
      ...(data.urgent ? { vibrate: [300, 100, 300, 100, 300] } : {}),
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        await c.focus();
        (c as WindowClient).navigate(url).catch(() => undefined);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
