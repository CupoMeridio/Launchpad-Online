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
// CUSTOMIZATION: When you make significant changes to App Shell files (e.g., update CSS or JS),
// increment the version in the name (e.g., from 'v1' to 'v2'). This will invalidate the old cache and force
// the Service Worker to download new files during the 'install' event.
const CACHE_NAME = 'launchpad-pwa-cache-v2';

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
    '/js/interaction.js',
    '/js/lights.js',
    '/js/midi.js',
    '/js/physicalInterface.js',
    '/js/project.js',
    '/js/ui.js',
    '/js/video.js',
    '/js/visualizer.js',
    '/js/visualizer-controls.js',
    '/js/webInterface.js',
    '/js/vendor/launchpad-webmidi.js',
    '/js/static-data.json',
    '/manifest.json',
    // Main icons
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
    const url = new URL(request.url);

    // STRATEGY 1: NETWORK-FIRST for configuration files (.json)
    // We want the latest project configuration if online, but work offline if not.
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