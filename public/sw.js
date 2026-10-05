const CACHE = 'ev-cache-v3'
const CORE = ['./manifest.webmanifest', './icon.svg', './favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const isNavigation = (req) => req.mode === 'navigate' || req.destination === 'document'

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // API 永远走网络，绝不缓存（保证多用户数据实时、不串号）
  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(req))
    return
  }

  // SW 脚本本身永远走网络，避免缓存自己导致无法更新
  if (url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(req))
    return
  }

  // HTML 导航：网络优先 —— 保证每次都拿到最新 app shell（旧版在这里被缓存优先卡死）
  if (isNavigation(req) || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return resp
        })
        .catch(() => caches.match('./index.html').then((r) => r || fetch(req)))
    )
    return
  }

  // 带内容 hash 的静态资源：缓存优先 + 后台静默更新（stale-while-revalidate）
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return resp
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
