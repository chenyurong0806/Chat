// sw.js - 标准 WebPush 离线推送与唤醒服务
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 监听系统级离线推送
self.addEventListener('push', (event) => {
  // 必须使用 event.waitUntil 将全部解析和弹出逻辑锁住，防止手机后台杀进程
  event.waitUntil(
    (async () => {
      let payload = { title: '新消息', body: '你收到了一条新消息' };

      if (event.data) {
        try {
          payload = event.data.json();
        } catch (e) {
          payload = { title: '新消息提醒', body: event.data.text() };
        }
      }

      const title = payload.title || '微信';
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

// 点击通知唤醒 App 并聚焦聊天界面
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const contactId = event.notification.data?.contactId || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
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