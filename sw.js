// sw.js - Service Worker
self.addEventListener('push', function (event) {
  let data = {
    title: '微信',
    body: '您收到了一条新消息',
    icon: '/icon-web.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || '您收到了一条新消息',
    icon: data.icon || '/icon-web.png',
    badge: '/icon-web.png',
    tag: data.tag || `push_${Date.now()}_${Math.random()}`,
    renotify: true,
    data: {
      url: data.url || '/'
    },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '新消息', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});