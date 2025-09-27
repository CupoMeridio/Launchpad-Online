/**
 * =============================================================================
 * SERVICE WORKER (service-worker.js)
 * =============================================================================
 *
 * Il Service Worker è un componente chiave di una Progressive Web App (PWA).
 * Agisce come un proxy tra l'applicazione web, il browser e la rete.
 * La sua funzione principale è intercettare le richieste di rete e gestire la cache,
 * permettendo all'applicazione di funzionare anche offline e di caricarsi più velocemente.
 *
 * CICLO DI VITA DI UN SERVICE WORKER:
 * 1. Installazione (`install`): Viene eseguito una sola volta quando il Service Worker è nuovo o aggiornato.
 *    È il momento ideale per preparare la cache con i file fondamentali dell'applicazione (l'App Shell).
 * 2. Attivazione (`activate`): Viene eseguito dopo l'installazione. È il momento di pulire le vecchie cache.
 * 3. Fetch (`fetch`): Viene eseguito ogni volta che l'applicazione fa una richiesta di rete (es. per un file CSS, un'immagine, un'API).
 */

// NOME DELLA CACHE
// PERSONALIZZAZIONE: Quando fai modifiche significative ai file dell'App Shell (es. aggiorni il CSS o JS),
// incrementa la versione nel nome (es. da 'v1' a 'v2'). Questo invaliderà la vecchia cache e forzerà
// il Service Worker a scaricare i nuovi file durante l'evento 'install'.
const CACHE_NAME = 'launchpad-pwa-cache-v1';

// APP SHELL: I file fondamentali per l'interfaccia dell'applicazione.
// Questi file vengono salvati in cache durante l'installazione per garantire che l'app
// possa essere avviata anche senza connessione a internet.
const APP_SHELL_FILES = [
    '/', // La radice, per richieste alla pagina principale
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
    '/projects/Virtual Riot - Idols.json', // Includiamo il progetto di default
    '/manifest.json',
    // È buona norma includere le icone principali
    '/assets/icons/android-chrome-192x192.png',
    '/assets/icons/android-chrome-512x512.png',
    '/assets/icons/apple-touch-icon.png',
    '/assets/icons/favicon.ico',
    '/assets/icons/Logo.png',
    '/assets/icons/triangle.png'
];

// 1. EVENTO 'INSTALL': Caching dell'App Shell
self.addEventListener('install', event => {
    console.log('Service Worker: In installazione...');
    // `event.waitUntil` dice al browser di attendere che l'operazione all'interno sia completata
    // prima di considerare l'installazione terminata.
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: Caching dei file dell\'App Shell');
            // `cache.addAll` prende un array di URL, li scarica e li aggiunge alla cache.
            // Se anche solo uno dei file non riesce a essere scaricato, l'intera operazione fallisce.
            return cache.addAll(APP_SHELL_FILES);
        })
    );
});

// 2. EVENTO 'ACTIVATE': Pulizia delle vecchie cache
self.addEventListener('activate', event => {
    console.log('Service Worker: In attivazione...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Se un nome di cache non corrisponde a quello corrente, viene eliminato.
                    // Questo è fondamentale per rimuovere i file obsoleti e liberare spazio.
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Rimozione vecchia cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // `self.clients.claim()` permette al Service Worker attivato di prendere il controllo
    // di tutte le schede aperte dell'applicazione immediatamente, senza bisogno di un refresh.
    return self.clients.claim();
});

// 3. EVENTO 'FETCH': Intercettazione delle richieste di rete
self.addEventListener('fetch', event => {
    const { request } = event;

    // Esempio di strategia per API: Stale-While-Revalidate.
    // Risponde subito con la cache (se disponibile), ma nel frattempo richiede la versione
    // aggiornata dalla rete per la prossima volta. Ottimo per dati che cambiano spesso.
    if (request.url.includes('/api/')) { // Attualmente non usato, ma è un buon pattern.
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

    // STRATEGIA DI DEFAULT: CACHE-FIRST, THEN NETWORK
    // Questa strategia è ideale per le risorse statiche dell'App Shell e per i media.
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // 1. CONTROLLA LA CACHE
            // Se una risposta corrispondente alla richiesta viene trovata nella cache...
            if (cachedResponse) {
                // ...restituiscila immediatamente. L'app è veloce e funziona offline.
                // console.log('Service Worker: Risorsa trovata in cache', request.url);
                return cachedResponse;
            }

            // 2. VAI ALLA RETE (se non è in cache)
            // Altrimenti, esegui la richiesta di rete originale.
            // console.log('Service Worker: Risorsa non in cache, fetching dalla rete', request.url);
            return fetch(request).then(networkResponse => {
                // 3. METTI IN CACHE LA NUOVA RISORSA
                // Una volta ottenuta la risposta dalla rete, la mettiamo in cache per le prossime volte.
                return caches.open(CACHE_NAME).then(cache => {
                    // `networkResponse` può essere letta una sola volta, quindi la cloniamo.
                    cache.put(request, networkResponse.clone());
                    // E restituiamo la risposta originale al browser.
                    return networkResponse;
                });
            });
        })
    );
});