// sw.js - WebPush & 离线消息处理中心

// 1. 立即激活，无需等待旧 worker 终止
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 2. 接收推送事件并弹窗
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    let payload = {};
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: '新消息', body: event.data.text() };
    }

    const title = payload.title || '收到新消息';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon-web.png',
      badge: '/icon-web.png',
      tag: payload.tag || `push_${Date.now()}`,
      renotify: true,
      data: {
        url: payload.url || '/',
        sender_id: payload.sender_id || ''
      },
      vibrate: [200, 100, 200],
      requireInteraction: false
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    console.error('[SW] 处理 Push 事件失败:', e);
  }
});

// 3. 点击通知：聚焦页面并通知前端切换到对应联系人
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const senderId = event.notification.data?.sender_id;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 如果已有打开的窗口，聚焦并发送通信
      for (let client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (senderId) {
            client.postMessage({ type: 'SWITCH_CHAT', contactId: senderId });
          }
          return;
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});