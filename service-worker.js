/**
 * SERVICE WORKER (service-worker.js)
 *
 * The Service Worker is a key component of a Progressive Web App (PWA).
 * It acts as a proxy between the web application, the browser, and the network.
 * Its main function is to intercept network requests and manage caching,
 * allowing the application to work offline and load faster.
 *
 * SERVICE WORKER LIFECYCLE:
 * 1. Installation (`install`): Executed only once when the Service Worker is new or updated.
 *    This is the ideal time to prepare the cache with the application's fundamental files (the App Shell).
 * 2. Activation (`activate`): Executed after installation. This is the time to clean up old caches.
 * 3. Fetch (`fetch`): Executed every time the application makes a network request (e.g., for a CSS file, an image, an API).
 */

// CACHE NAME
// Format: 'launchpad-pwa-cache-YYYY-MM-DD-HHMM'
// CUSTOMIZATION: When you make changes to App Shell files, update this timestamp.
// This invalidates the old cache and forces the Service Worker to download new files.
// Example: 'launchpad-pwa-cache-2026-03-21-1430' → update to → 'launchpad-pwa-cache-2026-03-21-1505'
const CACHE_NAME = 'launchpad-pwa-cache-2026-03-29-2154';

// Get the base path dynamically to support both local dev and GitHub Pages
const basePath = self.registration.scope.replace(self.location.origin, '');

// APP SHELL: The fundamental files for the application interface.
// These files are saved in cache during installation to ensure the app
// can be launched even without an internet connection.
const APP_SHELL_FILES = [
    `${basePath}`, // The root, for requests to the main page
    `${basePath}index.html`,
    `${basePath}css/style.css`,
    `${basePath}css/launchpad.css`,
    `${basePath}js/app.js`,
    `${basePath}js/audio.js`,
    `${basePath}js/interaction.js`,
    `${basePath}js/lights.js`,
    `${basePath}js/midi.js`,
    `${basePath}js/physicalInterface.js`,
    `${basePath}js/project.js`,
    `${basePath}js/ui.js`,
    `${basePath}js/video.js`,
    `${basePath}js/visualizer.js`,
    `${basePath}js/visualizer-controls.js`,
    `${basePath}js/visualizerManager.js`,
    `${basePath}js/projectValidator.js`,
    `${basePath}js/audioErrorHandler.js`,
    `${basePath}js/eventCleanup.js`,
    `${basePath}js/projectLoadingState.js`,
    `${basePath}js/webInterface.js`,
    `${basePath}js/vendor/launchpad-webmidi.js`,
    `${basePath}js/static-data.json`,
    `${basePath}manifest.json`,
    // Main icons
    `${basePath}assets/icons/android-chrome-192x192.png`,
    `${basePath}assets/icons/android-chrome-512x512.png`,
    `${basePath}assets/icons/apple-touch-icon.png`,
    `${basePath}assets/icons/favicon.ico`,
    `${basePath}assets/icons/Logo.png`,
    `${basePath}assets/icons/triangle.png`
];

// 1. 'INSTALL' EVENT: Caching the App Shell
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    // `event.waitUntil` tells the browser to wait for the operation inside to complete
    // before considering the installation finished.
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: Caching App Shell files');
            // `cache.addAll` takes an array of URLs, downloads them and adds them to the cache.
            // If even one file fails to download, the entire operation fails.
            return cache.addAll(APP_SHELL_FILES);
        })
    );
    // Force the service worker to activate immediately instead of waiting
    self.skipWaiting();
});

// 2. 'ACTIVATE' EVENT: Cleaning up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // If a cache name doesn't match the current one, it gets deleted.
                    // This is crucial for removing obsolete files and freeing up space.
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // `self.clients.claim()` allows the activated Service Worker to take control
    // of all open tabs of the application immediately, without needing a refresh.
    return self.clients.claim();
});

// 3. 'FETCH' EVENT: Intercepting network requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Inietta Permissions-Policy header nelle risposte di navigazione (HTML)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const headers = new Headers(response.headers);
                    headers.set('Permissions-Policy', 'midi=(self)');
                    // Rimuoviamo Feature-Policy perché obsoleto e causa warning se usato con Permissions-Policy
                    
                    // Clona la risposta originale *prima* di usarne il body
                    const responseToCache = response.clone();
                    
                    const newResponse = new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers
                    });
                    
                    // Crea un'altra risposta con gli header modificati da mettere in cache
                    const responseForCache = new Response(responseToCache.body, {
                        status: responseToCache.status,
                        statusText: responseToCache.statusText,
                        headers
                    });

                    // Aggiorna la cache con la risposta che include i nuovi header
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseForCache));
                    return newResponse;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) {
                        const clonedCached = cached.clone();
                        // Ricostruisci la risposta cached con i nuovi header
                        const headers = new Headers(clonedCached.headers);
                        headers.set('Permissions-Policy', 'midi=(self)');
                        return new Response(clonedCached.body, {
                            status: clonedCached.status,
                            statusText: clonedCached.statusText,
                            headers
                        });
                    }
                })
        );
        return;
    }

    // STRATEGY 1: NETWORK-FIRST for configuration files (.json)
    // The latest project configuration is requested if online, while allowing offline work.
    if (url.pathname.endsWith('.json')) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // STRATEGY 2: CACHE-FIRST for media and project assets (.wav, .mp4, images)
    // These files are large and don't change often.
    if (url.pathname.includes('/projects/') || url.pathname.includes('/assets/')) {
        event.respondWith(
            caches.match(request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then(networkResponse => {
                    // Do not cache partial responses (206) as Cache API doesn't support them
                    if (networkResponse.status === 206) {
                        return networkResponse;
                    }
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // DEFAULT STRATEGY: CACHE-FIRST for App Shell and other resources
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            return cachedResponse || fetch(request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});