// Hemyra service worker: shows push notifications for donor requests.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Hemyra', body: event.data?.text() || 'You have a new blood request.' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '🩸 New blood request', {
      body: data.body || 'Someone near you needs your help. Open your dashboard.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'hemyra-request',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(event.notification.data?.url || '/')
    })
  )
})
