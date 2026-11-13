import assert from 'node:assert/strict';
import test from 'node:test';

test('AudioEngine cleans up on failed init and recovers on retry', async () => {
    // Setup AudioContext mock
    let closeCalled = false;
    let failAnalyser = true;

    class MockAudioContext {
        constructor() {
            this.destination = {};
            this.state = 'running';
        }
        createAnalyser() {
            if (failAnalyser) {
                throw new Error('Simulated analyser creation failure');
            }
            return {
                fftSize: 512,
                smoothingTimeConstant: 0.8,
                connect() {}
            };
        }
        async close() {
            closeCalled = true;
        }
    }

    globalThis.AudioContext = MockAudioContext;
    globalThis.window = globalThis.window || {};
    globalThis.document = globalThis.document || { visibilityState: 'visible', addEventListener() {} };

    const { audioEngine } = await import('../js/audio.js');

    // First attempt: should fail when creating analyser
    failAnalyser = true;
    closeCalled = false;
    await assert.rejects(async () => {
        await audioEngine.init();
    }, /Simulated analyser creation failure/);

    // Engine should NOT be marked ready and partial context must be cleaned up
    assert.equal(audioEngine.isReady(), false, 'audioEngine must not be ready after failed init');
    assert.equal(audioEngine.audioContext, null, 'audioContext must be reset to null');
    assert.equal(audioEngine.analyser, null, 'analyser must be reset to null');
    assert.equal(closeCalled, true, 'partially initialized audioContext must be closed');

    // Second attempt: transient issue resolved, init should succeed
    failAnalyser = false;
    await audioEngine.init();

    assert.equal(audioEngine.isReady(), true, 'audioEngine must be ready after successful retry');
    assert.ok(audioEngine.audioContext, 'audioContext must be initialized');
    assert.ok(audioEngine.analyser, 'analyser must be initialized');
    assert.equal(audioEngine.getInitError(), null, 'initError must be cleared on success');
});

test('service worker activate purges only stale launchpad caches', async () => {
    const handlers = {};
    const deletedCaches = [];
    const staleLaunchpadCaches = [
        'launchpad-pwa-cache-2025-01-01-0000',
        'launchpad-pwa-cache-2026-01-01-0000'
    ];
    const foreignCaches = ['other-pwa-cache-v1', 'workbox-precache-v2'];

    let currentCacheName = null;
    let clientClaimed = false;

    globalThis.self = {
        location: { href: 'https://example.test/service-worker.js', origin: 'https://example.test' },
        registration: { scope: 'https://example.test/launchpad/' },
        addEventListener(type, handler) { handlers[type] = handler; },
        skipWaiting() {},
        clients: { claim: async () => { clientClaimed = true; } }
    };
    globalThis.caches = {
        open: async (name) => {
            currentCacheName = name;
            return { addAll: async () => {} };
        },
        keys: async () => [...staleLaunchpadCaches, ...foreignCaches, currentCacheName].filter(Boolean),
        delete: async (name) => { deletedCaches.push(name); return true; }
    };

    await import('../service-worker.js');

    // Running `install` reveals the worker's current cache name without hardcoding it.
    let installWork = null;
    handlers.install({ waitUntil: promise => { installWork = promise; } });
    await installWork;
    assert.ok(
        currentCacheName?.startsWith('launchpad-pwa-cache-'),
        'install must open the versioned launchpad cache'
    );

    let activateWork = null;
    handlers.activate({ waitUntil: promise => { activateWork = promise; } });
    await activateWork;

    assert.deepEqual(
        deletedCaches.sort(),
        [...staleLaunchpadCaches].sort(),
        'only outdated launchpad caches must be deleted'
    );
    assert.equal(deletedCaches.includes(currentCacheName), false, 'current cache must be kept');
    for (const foreignCache of foreignCaches) {
        assert.equal(deletedCaches.includes(foreignCache), false, `cache of another app must be kept: ${foreignCache}`);
    }
    assert.equal(clientClaimed, true, 'activate must claim control of open clients');
});
