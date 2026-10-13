import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProjectExport, createProjectId, createProjectPage, resolveLightDuration } from '../js/projectCreatorModel.js';
import { validateProject } from '../js/projectValidator.js';

test('creates a project with schema-compatible pages and stable sample paths', () => {
    const firstPage = createProjectPage(1);
    firstPage.samples[0] = { name: 'Kick.WAV' };
    firstPage.samples[63] = { name: 'last-hit.mp3' };

    firstPage.lights[0] = 'fade_red';
    const result = buildProjectExport({ name: 'Città Test', pages: [firstPage, createProjectPage(2)] });

    assert.equal(result.folderName, 'citta-test');
    assert.equal(result.configFileName, 'citta-test.json');
    assert.equal(result.project.id, 'citta-test');
    assert.equal(Object.hasOwn(result.project, 'bpm'), false);
    assert.equal(result.project.pages.length, 2);
    assert.equal(result.project.pages[0].sounds.length, 64);
    assert.equal(result.project.pages[0].sounds[1], '');
    assert.equal(result.project.pages[0].sounds[0], 'samples/page-1/pad-01.wav');
    assert.equal(result.project.pages[0].sounds[63], 'samples/page-1/pad-64.mp3');
    assert.equal(result.project.pages[0].lights.length, 64);
    assert.equal(result.project.pages[0].lightSyncToSound.length, 64);
    assert.equal(result.project.pages[0].lightSyncToSound[0], true);
    assert.equal(result.project.pages[0].lightDurations.length, 64);
    assert.equal(result.project.pages[0].lightDurations[0], 2.5);
    assert.equal(Object.hasOwn(result.project.pages[0], 'volumes'), false);
    assert.equal(Object.hasOwn(result.project.pages[0], 'triggerModes'), false);
    assert.equal(result.project.pages[0].lights[0], 'fade_red');
    assert.equal(validateProject(result.project).isValid, true);
    assert.deepEqual(result.files.map(entry => entry.path), [
        'samples/page-1/pad-01.wav',
        'samples/page-1/pad-64.mp3'
    ]);
});

test('rejects invalid project names, page counts, and page slots', () => {
    assert.throws(() => buildProjectExport({ name: '  ', pages: [createProjectPage(1)] }), /name is required/);
    assert.throws(() => buildProjectExport({ name: 'Too many', pages: Array.from({ length: 9 }, (_, index) => createProjectPage(index + 1)) }), /between 1 and 8 pages/);
    assert.throws(() => buildProjectExport({ name: 'Bad page', pages: [{ name: 'Page 1', samples: [] }] }), /64 pad slots/);
});

test('creates filesystem-safe identifiers', () => {
    assert.equal(createProjectId('  Virtual Riot / Idols!  '), 'virtual-riot-idols');
    assert.equal(createProjectId('!!!'), 'project');
});

test('resolves synchronized and manual light durations', () => {
    assert.equal(resolveLightDuration(true, 4.75, 2.5), 4.75);
    assert.equal(resolveLightDuration(false, 4.75, 2.5), 2.5);
    assert.equal(resolveLightDuration(true, 0, 2.5), 2.5);
    assert.equal(resolveLightDuration(true, -1, 2.5), 2.5);
    assert.equal(resolveLightDuration(true, null, 2.5), 2.5);
    assert.equal(resolveLightDuration(true, Number.NaN, 2.5), 2.5);
});