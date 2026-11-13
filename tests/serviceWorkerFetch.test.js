/**
 * Tests for the service worker's fetch strategies:
 * - navigations: network-first, cached App Shell when offline;
 * - project JSON: network-first, cache fallback, 503 {"error":"offline"} if neither;
 * - media under /projects/ and /assets/: cache-first, query string ignored, 206 not cached;
 * - everything else: cache-first App Shell.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const ORIGIN = 'https://example.test';
const SCOPE = `${ORIGIN}/launchpad/`;

// ---- Cache Storage stub --------------------------------------------------------
const store = new Map(); // cacheName -> Map(url -> Response)
const keyOf = (request) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
const withoutSearch = (href) => href.split('?')[0];

function openCache(name) {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name);
    return {
        addAll: async () => {},
        put: async (request, response) => { entries.set(keyOf(request), response); },
        match: async (request, { ignoreSearch = false } = {}) => {
            const key = keyOf(request);
            for (const [url, response] of entries) {
                // Like the real Cache API, every match yields a fresh, readable Response.
                if (url === key || (ignoreSearch && withoutSearch(url) === withoutSearch(key))) return response.clone();
            }
            return undefined;
        }
    };
}

globalThis.caches = {
    open: async (name) => openCache(name),
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
    match: async (request, options) => {
        for (const name of store.keys()) {
            const hit = await openCache(name).match(request, options);
            if (hit) return hit;
        }
        return undefined;
    }
};

// ---- Network stub -----------------------------------------------------------------
let network = async () => { throw new TypeError('offline'); };
const networkCalls = [];
globalThis.fetch = async (request) => {
    networkCalls.push(keyOf(request));
    return network(request);
};

// ---- Worker -----------------------------------------------------------------------
const handlers = {};
globalThis.self = {
    location: { href: `${SCOPE}service-worker.js`, origin: ORIGIN },
    registration: { scope: SCOPE },
    addEventListener: (type, handler) => { handlers[type] = handler; },
    skipWaiting() {},
    clients: { claim: async () => {} }
};
await import('../service-worker.js');

/** Dispatches a fetch event and resolves with the response and its background work. */
async function dispatchFetch(url, { mode = 'cors' } = {}) {
    let response = null;
    const background = [];
    handlers.fetch({
        request: { url: new URL(url, ORIGIN).href, mode },
        respondWith: (promise) => { response = promise; },
        waitUntil: (promise) => background.push(promise)
    });
    const resolved = await response;
    await Promise.all(background);
    return resolved;
}

const online = (body, init = {}) => async () => new Response(body, { status: 200, ...init });
const offline = async () => { throw new TypeError('Failed to fetch'); };

test.beforeEach(() => {
    store.clear();
    networkCalls.length = 0;
});

test('navigations go to the network first and keep the App Shell for offline use', async () => {
    network = online('<html>fresh</html>');
    const fresh = await dispatchFetch(SCOPE, { mode: 'navigate' });
    assert.equal(await fresh.text(), '<html>fresh</html>');

    network = offline;
    const cached = await dispatchFetch(`${SCOPE}some/deep/link`, { mode: 'navigate' });
    assert.equal(await cached.text(), '<html>fresh</html>', 'offline navigation serves the cached index.html');
});

test('project JSON is network-first and falls back to the cached copy', async () => {
    const url = `${SCOPE}projects/demo/demo.json`;
    network = online('{"v":1}');
    assert.equal(await (await dispatchFetch(url)).text(), '{"v":1}');

    network = online('{"v":2}');
    assert.equal(await (await dispatchFetch(url)).text(), '{"v":2}', 'online always gets the latest version');

    network = offline;
    assert.equal(await (await dispatchFetch(url)).text(), '{"v":2}', 'offline gets the last cached version');

    network = async () => new Response('missing', { status: 404 });
    assert.equal(await (await dispatchFetch(url)).text(), '{"v":2}', 'HTTP errors also fall back to the cache');
});

test('uncached project JSON while offline yields the 503 "offline" contract the app understands', async () => {
    network = offline;
    const response = await dispatchFetch(`${SCOPE}projects/never-seen.json`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'offline' });
});

test('media is cache-first, ignores cache-busting queries and never caches partial content', async () => {
    const sample = `${SCOPE}projects/demo/samples/kick.wav`;
    network = online('wav-bytes');
    await dispatchFetch(`${sample}?t=1`);
    assert.equal(networkCalls.length, 1);

    network = offline;
    const cached = await dispatchFetch(`${sample}?t=2`);
    assert.equal(await cached.text(), 'wav-bytes', 'served from cache despite a different query');

    const video = `${SCOPE}assets/videos/Neon Tunnel.webm`;
    network = async () => new Response('part', { status: 206 });
    await dispatchFetch(video);
    network = offline;
    await assert.rejects(dispatchFetch(video), /Failed to fetch/, 'a 206 response was not cached');
});

test('other resources are served from the App Shell cache before the network', async () => {
    const script = `${SCOPE}js/app.js`;
    network = online('console.log(1)');
    await dispatchFetch(script);
    network = online('console.log(2)');
    const response = await dispatchFetch(script);
    assert.equal(await response.text(), 'console.log(1)', 'cached copy wins');
    assert.equal(networkCalls.length, 1);
});
