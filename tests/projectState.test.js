import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };

const { setLogSink } = await import('../js/logger.js');
const state = await import('../js/projectState.js');

// Expected failures below would otherwise print errors.
setLogSink({ log() {}, warn() {}, error() {} });
test.after(() => setLogSink(null));

const runtimeProject = (name) => ({ project: { name, pages: [{}] }, pages: [], appearance: {} });

test('projectState commits a project as a single object and resets cleanly', () => {
    state.resetProjectState();
    assert.equal(state.getActiveProject(), null);
    assert.equal(state.getCurrentPage(), null);
    assert.equal(state.getCurrentMode(), null);
    assert.equal(state.isProjectReady(), false);

    const project = runtimeProject('A');
    state.commitProject(project);
    state.setCurrentPage(0);
    state.setCurrentMode(5);

    assert.equal(state.getActiveProject(), project);
    assert.equal(state.isProjectReady(), true, 'a committed project is ready to play');
    assert.equal(state.getCurrentPage(), 0);
    assert.equal(state.getCurrentMode(), 5);

    state.resetProjectState();
    assert.equal(state.getActiveProject(), null);
    assert.equal(state.isProjectReady(), false);
});

test('a project is not ready while another one is loading', () => {
    state.resetProjectState();
    state.commitProject(runtimeProject('A'));
    state.beginLoadingProject();
    assert.equal(state.isProjectReady(), false);
});

test('a failed load returns to READY when the previous project is still active', () => {
    state.resetProjectState();
    state.commitProject(runtimeProject('A'));
    state.beginLoadingProject();
    state.markProjectLoadError(new Error('boom'));
    assert.equal(state.isProjectReady(), true);
    assert.equal(state.getActiveProject().project.name, 'A');
});

test('a failed load without a previous project stays in ERROR', () => {
    state.resetProjectState();
    state.beginLoadingProject();
    state.markProjectLoadError(new Error('boom'));
    assert.equal(state.isProjectReady(), false);
});
