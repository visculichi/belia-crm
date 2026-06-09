const CACHE_NAME = 'belia-crm-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sales-pos.js',
  './supabase-client.js',
  './LOGO.jpeg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalar Service Worker y almacenar en caché recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[BELIA SW] Guardando recursos estáticos en caché');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[BELIA SW] Falló la carga inicial de caché:', err))
  );
});

// Activar el SW y limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[BELIA SW] Limpiando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network-First con Fallback a Caché
self.addEventListener('fetch', event => {
  // Ignorar peticiones de Supabase o externas no estáticas
  if (event.request.url.includes('supabase.co') || event.request.url.includes('pooler.supabase.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar y guardar copia fresca en caché para recursos válidos
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red, buscar en caché
        return caches.match(event.request);
      })
  );
});
