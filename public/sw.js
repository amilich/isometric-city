const CACHE_NAME = 'mycity-v1';
const STATIC_CACHE = 'mycity-static-v1';
const DYNAMIC_CACHE = 'mycity-dynamic-v1';

// Önbelleğe alınacak statik dosyalar
const STATIC_ASSETS = [
  '/',
  '/tr',
  '/en',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/truncgil-mycity.png',
  '/truncgil-yatay-dark.svg',
  '/truncgil-yatay.svg',
];

// Sprite sheet'leri (oyun için önemli)
const SPRITE_ASSETS = [
  '/assets/sprites_red_water_new.png',
  '/assets/sprites_red_water_new_1.png',
  '/assets/sprites_red_water_new_modern.png',
  '/assets/sprites_red_water_new_parks.png',
  '/assets/sprites_red_water_new_shops.png',
  '/assets/sprites_red_water_new_stations.png',
  '/assets/sprites_red_water_new_planes.png',
  '/assets/sprites_red_water_new_dense.png',
  '/assets/sprites_red_water_new_farm.png',
  '/assets/sprites_red_water_new_construction.png',
  '/assets/water.png',
  '/assets/water2.png',
  '/assets/water3.png',
];

// Bina asset'leri
const BUILDING_ASSETS = [
  '/assets/buildings/residential.png',
  '/assets/buildings/commercial.png',
  '/assets/buildings/industrial.png',
  '/assets/buildings/hospital.png',
  '/assets/buildings/school.png',
  '/assets/buildings/police_station.png',
  '/assets/buildings/fire_station.png',
  '/assets/buildings/park.png',
  '/assets/buildings/airport.png',
  '/assets/buildings/stadium.png',
];

// Install event - statik dosyaları önbelleğe al
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Caching sprite assets');
        // Sprite'ları ayrı ayrı ekle (hata olursa diğerleri etkilenmesin)
        return Promise.allSettled(
          [...SPRITE_ASSETS, ...BUILDING_ASSETS].map(url => 
            cache.add(url).catch(err => console.log(`[SW] Failed to cache: ${url}`, err))
          )
        );
      })
    ]).then(() => {
      console.log('[Service Worker] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - eski önbellekleri temizle
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== CACHE_NAME && 
                   name !== STATIC_CACHE && 
                   name !== DYNAMIC_CACHE;
          })
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first, fallback to cache stratejisi
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Sadece aynı origin'den gelen istekleri işle
  if (url.origin !== location.origin) {
    return;
  }

  // API istekleri için network-only
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Statik asset'ler için cache-first stratejisi
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Diğer istekler için stale-while-revalidate stratejisi
  event.respondWith(staleWhileRevalidate(request));
});

// Cache first stratejisi - önce cache'e bak
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Fetch failed:', error);
    // Offline fallback
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate stratejisi
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    return cachedResponse;
  });

  return cachedResponse || fetchPromise;
}

// Statik asset kontrolü
function isStaticAsset(pathname) {
  return pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|css|js)$/i) ||
         pathname.startsWith('/assets/') ||
         pathname.startsWith('/icons/') ||
         pathname.startsWith('/games/');
}

// Push notification desteği (gelecekte kullanılabilir)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Yeni bir bildirim!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MyCity', options)
  );
});

// Bildirime tıklandığında
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Background sync desteği (oyun state'i senkronizasyonu için)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-game-state') {
    console.log('[Service Worker] Syncing game state...');
    // Gelecekte oyun state'i sunucuya senkronize edilebilir
  }
});

console.log('[Service Worker] Loaded successfully');

