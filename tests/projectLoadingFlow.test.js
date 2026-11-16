import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };

const { setLogSink } = await import('../js/logger.js');
const loading = await import('../js/projectState.js');
const { ProjectLoadError, describeProjectLoadError } = await import('../js/project.js');

// Capture diagnostics instead of printing them.
const captured = [];
setLogSink({ log() {}, warn: (...args) => captured.push(['warn', ...args]), error: (...args) => captured.push(['error', ...args]) });
test.after(() => setLogSink(null));

test('waitForProjectReady settles on the next outcome, without polling', async () => {
    loading.resetProjectState();
    loading.beginLoadingProject();
    const waiting = loading.waitForProjectReady(5000);
    loading.commitProject({ project: { name: 'A', pages: [] }, pages: [], appearance: {} });
    assert.equal(await waiting, true, 'committing a project wakes waiters');
    assert.equal(await loading.waitForProjectReady(5000), true, 'already ready resolves immediately');

    loading.resetProjectState();
    loading.beginLoadingProject();
    const failing = loading.waitForProjectReady(5000);
    loading.markProjectLoadError(new Error('boom'));
    assert.equal(await failing, false, 'no project to fall back to');
    assert.ok(captured.some(([level, message]) => level === 'error' && /Project loading failed/.test(message)));
});

test('waitForProjectReady gives up after its timeout', async () => {
    loading.beginLoadingProject();
    assert.equal(await loading.waitForProjectReady(10), false);
    assert.ok(captured.some(([level, message]) => level === 'warn' && /Timeout waiting for project/.test(message)));
});

test('a failure with the previous project still active wakes waiters as ready', async () => {
    loading.commitProject({ project: { name: 'Previous', pages: [] }, pages: [], appearance: {} });
    loading.beginLoadingProject();
    const waiting = loading.waitForProjectReady(5000);
    loading.markProjectLoadError(new Error('boom'));
    assert.equal(await waiting, true);
    assert.equal(loading.getActiveProject().project.name, 'Previous');
});

test('project load errors map to translation keys, not to raw messages', () => {
    // Translations are not loaded in tests, so getTranslation returns the key itself.
    assert.equal(describeProjectLoadError(new ProjectLoadError('http', 'HTTP 404 loading x.json')), 'project.error.http');
    assert.equal(describeProjectLoadError(new ProjectLoadError('json', 'Invalid JSON')), 'project.error.json');
    assert.equal(describeProjectLoadError(new ProjectLoadError('timeout', 'slow')), 'project.error.timeout');
    assert.equal(describeProjectLoadError(new ProjectLoadError('offline', 'offline')), 'error.offline');
    assert.equal(describeProjectLoadError(new ProjectLoadError('validation', 'bad', { details: 'x' })), 'project.error.validation');
    assert.equal(describeProjectLoadError(new Error('unexpected')), 'project.error.unknown');

    const error = new ProjectLoadError('json', 'Invalid JSON', { cause: new SyntaxError('Unexpected token') });
    assert.equal(error.kind, 'json');
    assert.ok(error.cause instanceof SyntaxError);
});
