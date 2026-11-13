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

// Service workers run as classic scripts without access to localStorage and
// cannot import logger.js. Diagnostics stay silent unless the worker script
// URL carries a `?debug` parameter, which app.js forwards when debug mode is
// enabled (via `?debug` in the page URL or `launchpad.debug` in localStorage).
const DEBUG = new URL(self.location.href).searchParams.has('debug');

/**
 * Emits a debug log only when the DEBUG flag is enabled.
 * @param {...*} args - Values forwarded to console.log
 */
function debug(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

// CACHE NAME
// Format: 'launchpad-pwa-cache-YYYY-MM-DD-HHMM'
// CUSTOMIZATION: When you make changes to App Shell files, update this timestamp.
// This invalidates the old cache and forces the Service Worker to download new files.
// Example: 'launchpad-pwa-cache-2026-03-21-1430' → update to → 'launchpad-pwa-cache-2026-03-21-1505'
const CACHE_NAME = 'launchpad-pwa-cache-2026-11-13-1558';

// Get the base path dynamically to support both local dev and GitHub Pages
const basePath = self.registration.scope.replace(self.location.origin, '');

// APP SHELL: The fundamental files for the application interface.
// These files are saved in cache during installation to ensure the app
// can be launched even without an internet connection.
const APP_SHELL_FILES = [
    `${basePath}`, // The root, for requests to the main page
    `${basePath}index.html`,
    `${basePath}css/style.css`,
    `${basePath}css/sidebar.css`,
    `${basePath}css/creator.css`,
    `${basePath}css/launchpad.css`,
    `${basePath}js/animationClasses.js`,
    `${basePath}js/animationData.js`,
    `${basePath}js/animationEngine.js`,
    `${basePath}js/animationLibrary.js`,
    `${basePath}js/animations/basic.js`,
    `${basePath}js/animations/characters.js`,
    `${basePath}js/animations/directional.js`,
    `${basePath}js/animations/geometric.js`,
    `${basePath}js/animations/multi.js`,
    `${basePath}js/animations/special.js`,
    `${basePath}js/app.js`,
    `${basePath}js/appearance.js`,
    `${basePath}js/appearanceModel.js`,
    `${basePath}js/audio.js`,
    `${basePath}js/constants.js`,
    `${basePath}js/creatorLoader.js`,
    `${basePath}js/formControls.js`,
    `${basePath}js/i18n.js`,
    `${basePath}js/interaction.js`,
    `${basePath}js/launchpadAppearance.js`,
    `${basePath}js/launchpadView.js`,
    `${basePath}js/lights.js`,
    `${basePath}js/logger.js`,
    `${basePath}js/midi.js`,
    `${basePath}js/midi-profiles/DeviceProfile.js`,
    `${basePath}js/midi-profiles/LaunchpadLegacy.js`,
    `${basePath}js/midi-profiles/LaunchpadRGB.js`,
    `${basePath}js/midi-profiles/modelDetection.js`,
    `${basePath}js/midi-profiles/ProfileRegistry.js`,
    `${basePath}js/notifications.js`,
    `${basePath}js/physicalInterface.js`,
    `${basePath}js/project.js`,
    `${basePath}js/projectModel.js`,
    `${basePath}js/concurrency.js`,
    `${basePath}js/creator/dom.js`,
    `${basePath}js/creator/importExport.js`,
    `${basePath}js/creator/index.js`,
    `${basePath}js/creator/lightPicker.js`,
    `${basePath}js/creator/padEditor.js`,
    `${basePath}js/creator/preview.js`,
    `${basePath}js/creator/themeEditor.js`,
    `${basePath}js/projectCreatorModel.js`,
    `${basePath}js/projectCreatorState.js`,
    `${basePath}js/projectZip.js`,
    `${basePath}js/projectState.js`,
    `${basePath}js/settings.js`,
    `${basePath}js/staticCatalog.js`,
    `${basePath}js/ui.js`,
    `${basePath}js/background.js`,
    `${basePath}js/visibilityManager.js`,
    `${basePath}js/visualizer.js`,
    `${basePath}js/visualizer-controls.js`,
    `${basePath}js/visualizerManager.js`,
    `${basePath}js/projectValidator.js`,
    `${basePath}js/audioErrorHandler.js`,
    `${basePath}js/eventCleanup.js`,
    `${basePath}js/webInterface.js`,
    `${basePath}js/vendor/jszip.js`,
    `${basePath}js/vendor/jszip.min.js`,
    `${basePath}js/static-data.json`,
    `${basePath}manifest.json`,
    `${basePath}locales/de.json`,
    `${basePath}locales/en.json`,
    `${basePath}locales/es.json`,
    `${basePath}locales/fr.json`,
    `${basePath}locales/it.json`,
    // Main icons
    `${basePath}assets/icons/android-chrome-192x192.png`,
    `${basePath}assets/icons/android-chrome-512x512.png`,
    `${basePath}assets/icons/apple-touch-icon.png`,
    `${basePath}assets/icons/favicon.ico`,
    `${basePath}assets/icons/favicon-16x16.png`,
    `${basePath}assets/icons/favicon-32x32.png`,
    `${basePath}assets/icons/Logo.png`,
    `${basePath}assets/icons/triangle.png`
];

// 1. 'INSTALL' EVENT: Caching the App Shell
self.addEventListener('install', event => {
    debug('Service Worker: Installing...');
    // `event.waitUntil` tells the browser to wait for the operation inside to complete
    // before considering the installation finished.
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            debug('Service Worker: Caching App Shell files');
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
    debug('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Only delete caches belonging to Launchpad PWA that don't match the current CACHE_NAME.
                    // This prevents deleting caches belonging to other PWAs on the same origin (e.g. GitHub Pages).
                    if (cacheName.startsWith('launchpad-pwa-cache-') && cacheName !== CACHE_NAME) {
                        debug('Service Worker: Removing old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. 'FETCH' EVENT: Intercepting network requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // NAVIGATION REQUESTS (HTML): Network-first with offline App Shell fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        const clone = networkResponse.clone();
                        // Cache the App Shell page under canonical URLs without blocking navigation response
                        event.waitUntil(
                            caches.open(CACHE_NAME).then(cache => {
                                return Promise.all([
                                    cache.put(`${basePath}`, clone.clone()),
                                    cache.put(`${basePath}index.html`, clone)
                                ]);
                            })
                        );
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    return (await caches.match(`${basePath}index.html`)) ||
                           (await caches.match(`${basePath}`));
                })
        );
        return;
    }

    // STRATEGY 1: NETWORK-FIRST for configuration files (.json)
    // The latest project configuration is requested if online, while allowing offline work.
    // If the network request fails or returns an HTTP error, we fall back to cache if available.
    // If not cached, we return a JSON error response that can be interpreted by the app.
    if (url.pathname.endsWith('.json')) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                    // Network returned an HTTP error (e.g., 404, 500): fall back to cache if available
                    return caches.match(request).then(cached => {
                        return cached || networkResponse;
                    });
                })
                .catch(() => {
                    // Network failure (offline, timeout, DNS error): fall back to cache
                    return caches.match(request).then(cached => {
                        if (cached) {
                            return cached;
                        }
                        // No cached version and offline – return a JSON error response
                        // Note: message is not included here; the app will use getTranslation() for localized messages
                        const errorBody = JSON.stringify({ error: "offline" });
                        return new Response(errorBody, {
                            status: 503,
                            headers: { "Content-Type": "application/json" }
                        });
                    });
                })
        );
        return;
    }

    // STRATEGY 2: CACHE-FIRST for media and project assets (.wav, .mp4, images)
    // Ignore query parameters used for cache busting on static media URLs.
    if (url.pathname.includes('/projects/') || url.pathname.includes('/assets/')) {
        event.respondWith(
            caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then(networkResponse => {
                    // Do not cache partial responses (206) or error responses
                    if (networkResponse && networkResponse.ok && networkResponse.status !== 206) {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // DEFAULT STRATEGY: CACHE-FIRST for App Shell and other resources
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            return cachedResponse || fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.ok) {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            });
        })
    );
});
