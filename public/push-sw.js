// Notifications push : chargé par le service worker généré par vite-plugin-pwa (workbox.importScripts dans vite.config.ts).
// Le serveur (Edge Function send-daily-push) envoie un JSON { title, body, url, tag } ; ce script l'affiche, puis ouvre l'app au clic.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pokébadle', {
      body: data.body || '',
      icon: 'pwa-192.png',
      // Même tag = la notification du jour remplace la précédente au lieu de s'empiler.
      tag: data.tag || 'daily-battle',
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // App déjà ouverte : on la remet au premier plan ; sinon on l'ouvre.
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
