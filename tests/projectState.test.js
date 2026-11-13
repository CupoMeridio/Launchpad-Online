import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };

const state = await import('../js/projectState.js');
const loading = await import('../js/projectLoadingState.js');

test('projectState commits a project as a single object and resets cleanly', () => {
    state.resetProjectState();
    assert.equal(state.getActiveProject(), null);
    assert.equal(state.getCurrentPage(), null);
    assert.equal(state.getCurrentMode(), null);

    const runtimeProject = { project: { name: 'A', pages: [{}] }, sounds: [], lights: [], lightSyncToSound: [], lightDurations: [], appearance: {} };
    state.commitProject(runtimeProject);
    state.setCurrentPage(0);
    state.setCurrentMode(5);

    assert.equal(state.getActiveProject(), runtimeProject);
    assert.equal(state.getCurrentPage(), 0);
    assert.equal(state.getCurrentMode(), 5);

    state.resetProjectState();
    assert.equal(state.getActiveProject(), null);
});

test('a failed load returns to READY when the previous project is still active', async () => {
    await loading.beginLoadingProject();
    loading.markProjectLoadError(new Error('boom'), { previousProjectActive: true });
    assert.equal(loading.isProjectReady(), true);
});

test('a failed load without a previous project stays in ERROR', async () => {
    await loading.beginLoadingProject();
    loading.markProjectLoadError(new Error('boom'));
    assert.equal(loading.isProjectReady(), false);
});
