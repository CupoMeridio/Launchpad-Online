import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Shared bootstrap for the isolated browser stubs: fake document/window/raf,
 * a stub `navigator.requestMIDIAccess` that records accesses, and the real
 * midi.js / visibilityManager.js modules under test.
 */
const bootstrap = `
    const documentListeners = new Map();
    globalThis.document = {
        visibilityState: 'visible',
        addEventListener(type, cb) {
            if (!documentListeners.has(type)) documentListeners.set(type, new Set());
            documentListeners.get(type).add(cb);
        },
        removeEventListener(type, cb) {
            documentListeners.get(type)?.delete(cb);
        },
        getElementById() { return null; }
    };
    globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.CustomEvent = class {
        constructor(type, options) {
            this.type = type;
            this.detail = options?.detail;
        }
    };

    function dispatchDocumentEvent(type) {
        for (const cb of documentListeners.get(type) ?? []) cb();
    }

    const accesses = [];
    let requestCount = 0;
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: {
            requestMIDIAccess: async () => {
                requestCount += 1;
                const access = { inputs: new Map(), outputs: new Map(), onstatechange: null };
                accesses.push(access);
                return access;
            }
        }
    });

    const { initMidi } = await import('./js/midi.js');
    const { initVisibilityManager } = await import('./js/visibilityManager.js');
    initVisibilityManager();
`;

/** Runs a scenario snippet on top of the bootstrap in an isolated process. */
function runScenario(body) {
    const script = `import assert from 'node:assert/strict';\n${bootstrap}\n${body}`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: workspaceRoot,
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /SCENARIO_OK/);
}

test('MIDI system disposes when hidden and reinitializes when visible again', () => {
    runScenario(`
        await initMidi();
        assert.equal(requestCount, 1, 'MIDI access requested once on initial init');
        assert.equal(typeof accesses[0].onstatechange, 'function', 'state change handler installed');

        document.visibilityState = 'hidden';
        dispatchDocumentEvent('visibilitychange');
        await Promise.resolve();
        assert.equal(accesses[0].onstatechange, null, 'Web MIDI access released when page hidden');

        document.visibilityState = 'visible';
        dispatchDocumentEvent('visibilitychange');
        await new Promise(resolve => setTimeout(resolve, 700));
        assert.equal(requestCount, 2, 'MIDI access requested again when page visible');
        assert.equal(typeof accesses[1].onstatechange, 'function', 'state change handler reinstalled');

        console.log('SCENARIO_OK');
    `);
});

test('MIDI system does not reinitialize if the page is hidden again before the timer fires', () => {
    runScenario(`
        await initMidi();
        assert.equal(requestCount, 1, 'MIDI access requested once on initial init');

        document.visibilityState = 'hidden';
        dispatchDocumentEvent('visibilitychange');
        await Promise.resolve();
        assert.equal(requestCount, 1, 'no reinit while hidden');

        document.visibilityState = 'visible';
        dispatchDocumentEvent('visibilitychange');

        // Hide again well within the 500ms reinit window: the pending timer must be cancelled.
        document.visibilityState = 'hidden';
        dispatchDocumentEvent('visibilitychange');
        await new Promise(resolve => setTimeout(resolve, 700));

        assert.equal(requestCount, 1, 'pending reinit timer cancelled after rapid hide');
        assert.equal(accesses.length, 1, 'no extra MIDI access requested');
        assert.equal(accesses[0].onstatechange, null, 'MIDI remains disposed while hidden');

        console.log('SCENARIO_OK');
    `);
});
