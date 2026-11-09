import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('index.html compatibility check requires standard AudioContext and omits webkitAudioContext', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
    assert.match(html, /typeof AudioContext === 'undefined'/);
    assert.doesNotMatch(html, /webkitAudioContext/);
});

test('service-worker.js isolates cache deletion to launchpad caches only', () => {
    const sw = readFileSync(path.join(workspaceRoot, 'service-worker.js'), 'utf8');
    assert.match(sw, /const CACHE_NAME = 'launchpad-pwa-cache-\d{4}-\d{2}-\d{2}-\d{4}';/);
    assert.match(sw, /cacheName\.startsWith\('launchpad-pwa-cache-'\) && cacheName !== CACHE_NAME/);
    assert.doesNotMatch(sw, /if\s*\(cacheName !== CACHE_NAME\)\s*\{\s*debug\([^)]*\);\s*return caches\.delete\(cacheName\);\s*\}/);
});

test('README.md lists Studio Creator and Multisampling in Key Features and not in Roadmap', () => {
    const readme = readFileSync(path.join(workspaceRoot, 'README.md'), 'utf8');
    const [beforeRoadmap, afterRoadmap] = readme.split('## Roadmap & Future Ideas');
    assert.ok(afterRoadmap, 'README must have Roadmap section');

    // Key Features must mention Studio Creator and Multisampling
    assert.match(beforeRoadmap, /In-App Studio Creator/i);
    assert.match(beforeRoadmap, /Multisampling Support/i);

    // Roadmap must NOT list them as planned future items
    assert.doesNotMatch(afterRoadmap, /In-App Project Creator/i);
    assert.doesNotMatch(afterRoadmap, /Multisampling Support/i);
});

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
