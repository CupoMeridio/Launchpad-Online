import assert from 'node:assert/strict';
import test from 'node:test';
import { 
    buildProjectExport, 
    createProjectId, 
    createProjectPage, 
    createDraft,
    isDraftDirty, 
    buildDraftFromProject 
} from '../js/projectCreatorModel.js';
import { exportProjectToZip, importProjectFromZip } from '../js/projectZip.js';
import { resolveLightDuration } from '../js/animationData.js';
import { validateProject } from '../js/projectValidator.js';
import JSZip from 'jszip';

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

test('createDraft initializes draft and isDraftDirty detects modified or untouched drafts', () => {
    assert.equal(isDraftDirty(null), false);

    const freshDraft = createDraft();
    assert.equal(freshDraft.name, '');
    assert.equal(freshDraft.pages.length, 1);
    assert.equal(freshDraft.changeCount, 0);
    assert.equal(freshDraft.savedChangeCount, 0);
    assert.equal(isDraftDirty(freshDraft), false);

    // Increment change count -> dirty
    freshDraft.changeCount++;
    assert.equal(isDraftDirty(freshDraft), true);

    // Save changes (sync change counts) -> clean
    freshDraft.savedChangeCount = freshDraft.changeCount;
    assert.equal(isDraftDirty(freshDraft), false);

    // Explicit custom drafts
    assert.equal(isDraftDirty({ changeCount: 5, savedChangeCount: 5 }), false);
    assert.equal(isDraftDirty({ changeCount: 6, savedChangeCount: 5 }), true);
});

test('buildDraftFromProject reconstructs editor draft from project schema and file map', () => {
    const project = {
        id: 'test-project',
        name: 'Test Project',
        pages: [
            {
                name: 'Page 1',
                sounds: ['samples/page-1/pad-01.wav', ...new Array(63).fill('')],
                lights: ['wave_green', ...new Array(63).fill('')],
                lightSyncToSound: [false, ...new Array(63).fill(true)],
                lightDurations: [4.2, ...new Array(63).fill(2.5)]
            },
            {
                name: 'Page 2',
                sounds: ['samples/page-2/pad-01.wav', ...new Array(63).fill('')],
                lights: new Array(64).fill(''),
                lightSyncToSound: new Array(64).fill(true),
                lightDurations: new Array(64).fill(2.5)
            }
        ]
    };

    // Notice: only page-1 has pad-01.wav. page-2/pad-01.wav is missing!
    const fileMap = new Map([
        ['samples/page-1/pad-01.wav', { name: 'pad-01.wav', size: 100 }]
    ]);

    const draft = buildDraftFromProject(project, fileMap);
    assert.equal(draft.name, 'Test Project');
    assert.equal(draft.pages.length, 2);
    assert.equal(draft.pages[0].samples[0]?.name, 'pad-01.wav');
    // Page 2 must NOT fall back to page 1's pad-01.wav!
    assert.equal(draft.pages[1].samples[0], null, 'Missing sample in page 2 must not fall back to page 1 sample');
    assert.equal(draft.pages[0].lights[0], 'wave_green');
    assert.equal(draft.pages[0].lightSyncToSound[0], false);
    assert.equal(draft.pages[0].lightDurations[0], 4.2);
});

test('projectZip roundtrips draft export to zip and import from zip', async () => {
    const page = createProjectPage(1);
    const fakeAudioContent = Buffer.from('RIFF1234WAVEfmt ');
    page.samples[0] = { name: 'kick.wav', data: fakeAudioContent };
    page.lights[0] = 'fade_red';
    page.lightSyncToSound[0] = false;
    page.lightDurations[0] = 3.0;

    const originalDraft = {
        name: 'Roundtrip Zip Project',
        pages: [page]
    };

    const exportResult = await exportProjectToZip(originalDraft, JSZip);
    assert.ok(exportResult.blob);
    assert.equal(exportResult.filename, 'roundtrip-zip-project.zip');

    const importResult = await importProjectFromZip(exportResult.blob, JSZip);
    assert.equal(importResult.draft.name, 'Roundtrip Zip Project');
    assert.equal(importResult.draft.pages.length, 1);
    assert.ok(importResult.draft.pages[0].samples[0]);
    assert.equal(importResult.draft.pages[0].lights[0], 'fade_red');
    assert.equal(importResult.draft.pages[0].lightSyncToSound[0], false);
    assert.equal(importResult.draft.pages[0].lightDurations[0], 3.0);
});