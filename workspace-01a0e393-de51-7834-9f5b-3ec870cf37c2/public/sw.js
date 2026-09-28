const CACHE = 'kiya-static-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, '/fonts/Vazirmatn.woff2', '/images/icon-192.png', '/images/icon-512.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('kiya-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > 85) await cache.delete(keys.find(key => new URL(key.url).pathname.startsWith('/images/product-')) || keys[0]);
      }
      return response;
    }));
  }
});

/* ---------- فاز ۱۰: اعلان مرورگر (Web Push) ---------- */
self.addEventListener('push', event => {
  let payload = { title: 'کیا اکسسوری', body: 'اعلان جدید داری', link: '/account/panel' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch (error) { /* متن ساده */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: payload.icon || '/images/icon-192.png', badge: payload.badge || '/images/icon-192.png',
    dir: 'rtl', lang: 'fa-IR', tag: payload.tag || 'kiya-notification', data: { link: payload.link || '/account/panel' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/account/panel';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(client => new URL(client.url).origin === self.location.origin);
    if (open) { await open.focus(); if ('navigate' in open) await open.navigate(link); return; }
    await self.clients.openWindow(link);
  })());
});
