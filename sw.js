// sw.js - 规范化生命周期的离线推送服务
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  // 必须把所有逻辑用 event.waitUntil 彻底锁定，防止手机后台杀进程
  event.waitUntil(
    (async () => {
      if (!event.data) return;

      let payload = {};
      try {
        payload = event.data.json();
      } catch (err) {
        payload = { title: '新消息', body: event.data.text() };
      }

      const title = payload.title || '新消息提醒';
      const contactId = payload.contactId || '';

      const options = {
        body: payload.body || '收到一条新消息',
        icon: payload.icon || '/icon-web.png',
        badge: '/icon-web.png',
        tag: `msg_${contactId || Date.now()}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: payload.url || '/',
          contactId: contactId
        }
      };

      return self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const contactId = event.notification.data?.contactId || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          if (contactId) {
            client.postMessage({ action: 'SWITCH_CHAT', contactId: contactId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl).then((newClient) => {
          if (newClient && contactId) {
            setTimeout(() => {
              newClient.postMessage({ action: 'SWITCH_CHAT', contactId: contactId });
            }, 1000);
          }
        });
      }
    })
  );
});