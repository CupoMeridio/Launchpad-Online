/**
 * =============================================================================
 * SERVICE WORKER (service-worker.js)
 * =============================================================================
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
// CUSTOMIZATION: When you make significant changes to App Shell files (e.g., update CSS or JS),
// increment the version in the name (e.g., from 'v1' to 'v2'). This will invalidate the old cache and force
// the Service Worker to download new files during the 'install' event.
const CACHE_NAME = 'launchpad-pwa-cache-v1';

// APP SHELL: The fundamental files for the application interface.
// These files are saved in cache during installation to ensure the app
// can be launched even without an internet connection.
const APP_SHELL_FILES = [
    '/', // The root, for requests to the main page
    '/index.html',
    '/css/style.css',
    '/css/launchpad.css',
    '/js/app.js',
    '/js/audio.js',
    '/js/midi.js',
    '/js/visualizer.js',
    '/js/storage.js',
    '/js/ui/editor-ui.js',
    '/js/ui/library-ui.js',
    '/js/static-data.json',
    '/projects/Virtual Riot - Idols.json', // Include the default project
    '/manifest.json',
    // It's good practice to include main icons
    '/assets/icons/android-chrome-192x192.png',
    '/assets/icons/android-chrome-512x512.png',
    '/assets/icons/apple-touch-icon.png',
    '/assets/icons/favicon.ico',
    '/assets/icons/Logo.png',
    '/assets/icons/triangle.png'
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

    // Example API strategy: Stale-While-Revalidate.
    // Responds immediately with cache (if available), but meanwhile requests the updated
    // version from the network for next time. Great for frequently changing data.
    if (request.url.includes('/api/')) { // Currently not used, but it's a good pattern.
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    const networkFetch = fetch(request).then(networkResponse => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || networkFetch;
                });
            })
        );
        return;
    }

    // DEFAULT STRATEGY: CACHE-FIRST, THEN NETWORK
    // This strategy is ideal for App Shell static resources and media.
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // 1. CHECK THE CACHE
            // If a response matching the request is found in cache...
            if (cachedResponse) {
                // ...return it immediately. The app is fast and works offline.
                // console.log('Service Worker: Resource found in cache', request.url);
                return cachedResponse;
            }

            // 2. GO TO NETWORK (if not in cache)
            // Otherwise, execute the original network request.
            // console.log('Service Worker: Resource not in cache, fetching from network', request.url);
            return fetch(request).then(networkResponse => {
                // 3. CACHE THE NEW RESOURCE
                // Once we get the response from the network, we cache it for next time.
                return caches.open(CACHE_NAME).then(cache => {
                    // `networkResponse` can only be read once, so we clone it.
                    cache.put(request, networkResponse.clone());
                    // And return the original response to the browser.
                    return networkResponse;
                });
            });
        })
    );
});