const CACHE_NAME = 'launchpad-pwa-cache-v1';
const APP_SHELL_FILES = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/launchpad.css',
    '/js/app.js',
    '/js/audio.js',
    '/js/midi.js',
    '/js/storage.js',
    '/js/ui/editor-ui.js',
    '/js/ui/library-ui.js',
    '/manifest.json',
    '/assets/icons/apple-touch-icon.png'
];

// 1. Installazione: Caching dell'App Shell
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: Caching App Shell');
            return cache.addAll(APP_SHELL_FILES);
        })
    );
});

// 2. Attivazione: Pulizia delle vecchie cache
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Fetch: Intercettazione delle richieste di rete
self.addEventListener('fetch', event => {
    const { request } = event;

    // Strategia per le API (Stale-While-Revalidate)
    if (request.url.includes('/api/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    const networkFetch = fetch(request).then(networkResponse => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                    // Restituisci la cache subito, poi aggiorna in background
                    return cachedResponse || networkFetch;
                });
            })
        );
        return;
    }

    // Strategia per tutto il resto (Cache First, then Network)
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // Se la risorsa è in cache, restituiscila
            if (cachedResponse) {
                return cachedResponse;
            }
            // Altrimenti, vai in rete, restituisci e metti in cache
            return fetch(request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});
