// sw.js - 微信项目 WebPush 锁屏通知与离线唤醒服务
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 1. 监听来自 Cloudflare Worker 的 Web Push 离线/锁屏推送
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    let payload = {};
    try {
      payload = event.data.json();
    } catch (err) {
      payload = { title: '新消息提醒', body: event.data.text() };
    }

    const title = payload.title || '新消息提醒';
    const contactId = payload.contactId || '';

    const options = {
      body: payload.body || '收到一条新消息',
      icon: payload.icon || '/icon-web.png',
      badge: '/icon-web.png',
      tag: `wechat_msg_${contactId || Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url: payload.url || '/',
        contactId: contactId
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    console.error('Error handling push event in sw.js:', e);
  }
});

// 2. 监听点击通知事件：唤醒并对焦窗口，自动打开对应联系人
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