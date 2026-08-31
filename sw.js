// sw.js - 放置在网站根目录下
self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      badge: data.icon || 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      data: {
        url: data.url || '/'
      },
      vibrate: [100, 50, 100],
      requireInteraction: false
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (e) {
    console.error('Error handling push event:', e);
  }
});

self.addEventListener('notificationclick', function(event) {
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