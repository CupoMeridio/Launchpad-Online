/**
 * Integration tests for project loading (js/project.js): fetch, validation,
 * asset loading, atomic commit, error reporting, serialization and timeout,
 * through the real modules with only the network and browser stubbed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createRecordingSink, createElement } from './helpers/browserStubs.js';

const { elements } = installBrowserStubs();

const { setLogSink } = await import('../js/logger.js');
setLogSink(createRecordingSink());

const { loadProject } = await import('../js/project.js');
const { getActiveProject, getCurrentPage, isProjectReady } = await import('../js/projectState.js');
const { audioEngine } = await import('../js/audio.js');
const { PROJECT_LOADING_TIMEOUT_MS } = await import('../js/constants.js');

// ---- Network stub --------------------------------------------------------------
const routes = new Map();
const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body)
});
globalThis.fetch = async (url) => {
    const route = routes.get(url);
    if (!route) return jsonResponse({}, 404);
    return route();
};

// Samples "decode" instantly into fake buffers; every request is recorded.
const sampleRequests = [];
audioEngine.loadSound = async (url) => {
    sampleRequests.push(url);
    return { url, duration: 1 };
};

const emptyPads = () => Array.from({ length: 64 }, () => []);
function projectJson(name, sounds = emptyPads()) {
    return { id: name.toLowerCase(), name, pages: [{ name: 'Main', sounds }] };
}

const notifications = () => (elements.get('notification-container')?.children || []).map(n => n.textContent);
const lastNotification = () => notifications().at(-1);

test('a project loads, commits atomically with its decoded samples, and becomes playable', async () => {
    const sounds = emptyPads();
    sounds[0] = ['kick.wav', 'snare.wav'];
    sounds[1] = ['kick.wav'];
    routes.set('projects/alpha/alpha.json', () => jsonResponse(projectJson('Alpha', sounds)));
    const button = createElement('button');

    await loadProject('projects/alpha/alpha.json', button);

    const active = getActiveProject();
    assert.equal(active.project.name, 'Alpha');
    assert.equal(isProjectReady(), true);
    assert.equal(getCurrentPage(), 0);
    assert.equal(button.classList.contains('selected'), true);
    assert.deepEqual(sampleRequests.sort(), ['projects/alpha/kick.wav', 'projects/alpha/snare.wav'], 'shared samples load once');
    assert.equal(active.pages[0][0][0].buffer, active.pages[0][1][0].buffer, 'pads sharing a sample share its buffer');
    assert.equal(elements.get('audio-unlock-overlay').classList.contains('hidden'), true, 'loading overlay is hidden again');
});

for (const [kind, route, expectedMessage] of [
    ['http', () => jsonResponse({}, 404), 'project.error.http'],
    ['offline', () => jsonResponse({ error: 'offline' }, 503), 'error.offline'],
    ['json', () => jsonResponse('{ not json'), 'project.error.json'],
    ['validation', () => jsonResponse({ name: 'No id', pages: [] }), 'project.error.validation'],
    ['network', () => Promise.reject(new TypeError('Failed to fetch')), 'project.error.http']
]) {
    test(`a ${kind} failure keeps the previous project playable and tells the user why`, async () => {
        const previous = getActiveProject();
        assert.ok(previous, 'a project is already loaded');
        routes.set(`projects/broken-${kind}.json`, route);

        await loadProject(`projects/broken-${kind}.json`, createElement('button'));

        assert.equal(getActiveProject(), previous, 'nothing was committed');
        assert.equal(isProjectReady(), true, 'the previous project stays ready');
        assert.equal(lastNotification(), expectedMessage, 'a translated message (key, as no locale is loaded)');
    });
}

test('a second load requested while one is running is ignored', async () => {
    let release;
    routes.set('projects/slow.json', () => new Promise(resolve => {
        release = () => resolve(jsonResponse(projectJson('Slow')));
    }));
    routes.set('projects/other.json', () => jsonResponse(projectJson('Other')));

    const first = loadProject('projects/slow.json', null);
    const second = loadProject('projects/other.json', null);
    assert.equal(second, first, 'the running load is returned');

    await new Promise(resolve => setImmediate(resolve));
    release();
    await first;
    assert.equal(getActiveProject().project.name, 'Slow');
});

test('a stuck load times out, frees the loader, and its late result is discarded', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let releaseStuck;
    routes.set('projects/stuck.json', () => new Promise(resolve => {
        releaseStuck = () => resolve(jsonResponse(projectJson('Stuck')));
    }));
    routes.set('projects/next.json', () => jsonResponse(projectJson('Next')));
    const before = getActiveProject();

    const stuck = loadProject('projects/stuck.json', null);
    await new Promise(resolve => setImmediate(resolve));
    t.mock.timers.tick(PROJECT_LOADING_TIMEOUT_MS);
    await stuck;

    assert.equal(getActiveProject(), before, 'the timed-out load committed nothing');
    assert.equal(lastNotification(), 'project.error.timeout');
    assert.equal(isProjectReady(), true);

    await loadProject('projects/next.json', null);
    assert.equal(getActiveProject().project.name, 'Next', 'the loader accepts new loads after a timeout');

    releaseStuck();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(getActiveProject().project.name, 'Next', 'the abandoned load never replaces the newer project');
});
