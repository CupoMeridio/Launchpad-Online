import assert from 'node:assert/strict';
import test from 'node:test';
import { 
    buildProjectExport, 
    createProjectId, 
    createProjectPage, 
    createDraft,
    createEmptyPadStep,
    isDraftDirty, 
    buildDraftFromProject,
    getPadSteps
} from '../js/projectCreatorModel.js';
import { normalizeTargetDevice, DEFAULT_LIGHT_DURATION_SEC } from '../js/constants.js';
import { exportProjectToZip, importProjectFromZip } from '../js/projectZip.js';
import { resolveLightDuration } from '../js/animationData.js';
import { validateProject } from '../js/projectValidator.js';
import JSZip from 'jszip';

test('creates a project with schema-compatible pages and stable sample paths', () => {
    const firstPage = createProjectPage(1);
    getPadSteps(firstPage, 0)[0].sample = { name: 'Kick.WAV' };
    getPadSteps(firstPage, 63)[0].sample = { name: 'last-hit.mp3' };

    getPadSteps(firstPage, 0)[0].light = 'fade_red';
    const result = buildProjectExport({ name: 'Città Test', pages: [firstPage, createProjectPage(2)] });

    assert.equal(result.folderName, 'citta-test');
    assert.equal(result.configFileName, 'citta-test.json');
    assert.equal(result.project.id, 'citta-test');
    assert.equal(result.project.targetDevice, 'universal');
    assert.equal(Object.hasOwn(result.project, 'bpm'), false);
    assert.equal(result.project.pages.length, 2);
    assert.equal(result.project.pages[0].sounds.length, 64);
    assert.deepEqual(result.project.pages[0].sounds[1], []);
    assert.deepEqual(result.project.pages[0].sounds[0], ['samples/page-1/pad-01.wav']);
    assert.deepEqual(result.project.pages[0].sounds[63], ['samples/page-1/pad-64.mp3']);
    assert.equal(result.project.pages[0].lights.length, 64);
    assert.equal(result.project.pages[0].lightSyncToSound.length, 64);
    assert.deepEqual(result.project.pages[0].lightSyncToSound[0], [true]);
    assert.equal(result.project.pages[0].lightDurations.length, 64);
    assert.deepEqual(result.project.pages[0].lightDurations[0], [2.5]);
    assert.equal(Object.hasOwn(result.project.pages[0], 'volumes'), false);
    assert.equal(Object.hasOwn(result.project.pages[0], 'triggerModes'), false);
    assert.deepEqual(result.project.pages[0].lights[0], ['fade_red']);
    assert.equal(validateProject(result.project).isValid, true);
    assert.deepEqual(result.files.map(entry => entry.path), [
        'samples/page-1/pad-01.wav',
        'samples/page-1/pad-64.mp3'
    ]);
});

test('rejects invalid project names, page counts, and page slots', () => {
    assert.throws(() => buildProjectExport({ name: '  ', pages: [createProjectPage(1)] }), /name is required/);
    assert.throws(() => buildProjectExport({ name: 'Too many', pages: Array.from({ length: 9 }, (_, index) => createProjectPage(index + 1)) }), /between 1 and 8 pages/);
    assert.throws(() => buildProjectExport({ name: 'Bad page', pages: [{ name: 'Page 1', padSteps: [] }] }), /64 pad slots/);
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
    assert.equal(freshDraft.targetDevice, 'universal');
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
                sounds: [['samples/page-1/pad-01.wav'], ...new Array(63).fill(null).map(() => [])],
                lights: [['wave_green'], ...new Array(63).fill(null).map(() => [])],
                lightSyncToSound: [[false], ...new Array(63).fill(null).map(() => [true])],
                lightDurations: [[4.2], ...new Array(63).fill(null).map(() => [2.5])]
            },
            {
                name: 'Page 2',
                sounds: [['samples/page-2/pad-01.wav'], ...new Array(63).fill(null).map(() => [])],
                lights: new Array(64).fill(null).map(() => []),
                lightSyncToSound: new Array(64).fill(null).map(() => [true]),
                lightDurations: new Array(64).fill(null).map(() => [2.5])
            }
        ]
    };

    // Notice: only page-1 has pad-01.wav. page-2/pad-01.wav is missing!
    const fileMap = new Map([
        ['samples/page-1/pad-01.wav', { name: 'pad-01.wav', size: 100 }]
    ]);

    const draft = buildDraftFromProject(project, fileMap);
    assert.equal(draft.name, 'Test Project');
    assert.equal(draft.targetDevice, 'universal');
    const rgbDraft = buildDraftFromProject({ ...project, targetDevice: 'rgb' }, fileMap);
    assert.equal(rgbDraft.targetDevice, 'rgb');
    assert.equal(draft.pages.length, 2);
    assert.equal(getPadSteps(draft.pages[0], 0)[0].sample?.name, 'pad-01.wav');
    // Page 2 must NOT fall back to page 1's pad-01.wav!
    assert.equal(getPadSteps(draft.pages[1], 0)[0].sample, null, 'Missing sample in page 2 must not fall back to page 1 sample');
    assert.equal(getPadSteps(draft.pages[0], 0)[0].light, 'wave_green');
    assert.equal(getPadSteps(draft.pages[0], 0)[0].lightSyncToSound, false);
    assert.equal(getPadSteps(draft.pages[0], 0)[0].lightDuration, 4.2);
});

test('projectZip roundtrips draft export to zip and import from zip', async () => {
    const page = createProjectPage(1);
    const fakeAudioContent = Buffer.from('RIFF1234WAVEfmt ');
    getPadSteps(page, 0)[0].sample = { name: 'kick.wav', data: fakeAudioContent };
    getPadSteps(page, 0)[0].light = 'fade_red';
    getPadSteps(page, 0)[0].lightSyncToSound = false;
    getPadSteps(page, 0)[0].lightDuration = 3.0;

    const originalDraft = {
        name: 'Roundtrip Zip Project',
        targetDevice: 'rgb',
        pages: [page]
    };

    const exportResult = await exportProjectToZip(originalDraft, JSZip);
    assert.ok(exportResult.blob);
    assert.equal(exportResult.filename, 'roundtrip-zip-project.zip');

    const importResult = await importProjectFromZip(exportResult.blob, JSZip);
    assert.equal(importResult.draft.name, 'Roundtrip Zip Project');
    assert.equal(importResult.draft.targetDevice, 'rgb');
    assert.equal(importResult.draft.pages.length, 1);
    assert.ok(getPadSteps(importResult.draft.pages[0], 0)[0].sample);
    assert.equal(getPadSteps(importResult.draft.pages[0], 0)[0].light, 'fade_red');
    assert.equal(getPadSteps(importResult.draft.pages[0], 0)[0].lightSyncToSound, false);
    assert.equal(getPadSteps(importResult.draft.pages[0], 0)[0].lightDuration, 3.0);
});

test('createDraft initializes default theme properties and accepts overrides', () => {
    const draft = createDraft();
    assert.deepEqual(draft.visualizer, {
        mode: 'off',
        color1: '#00aaff',
        color2: '#00aaff',
        gradient: false,
        gradientDirection: 'vertical'
    });
    assert.equal(draft.launchpadRotation, null);
    assert.equal(draft.launchpadSize, null);
    assert.equal(draft.backgroundMedia, '');
    assert.equal(draft.coverImage, '');
    assert.equal(draft.iconImage, '');

    const customDraft = createDraft('Themed Project', null, {
        visualizer: { mode: 'glow', color1: '#123456' },
        coverImage: 'custom-cover.jpg',
        backgroundMedia: 'custom-bg.mp4',
        launchpadRotation: 180,
        launchpadSize: 75
    });
    assert.equal(customDraft.visualizer.mode, 'glow');
    assert.equal(customDraft.visualizer.color1, '#123456');
    assert.equal(customDraft.visualizer.color2, '#00aaff');
    assert.equal(customDraft.coverImage, 'custom-cover.jpg');
    assert.equal(customDraft.backgroundMedia, 'custom-bg.mp4');
    assert.equal(customDraft.launchpadRotation, 180);
    assert.equal(customDraft.launchpadSize, 75);
});

test('buildProjectExport exports theme properties and packages custom media files', () => {
    const page = createProjectPage(1);
    const fakeCoverData = Buffer.from('fake-image-bytes');
    const fakeIconData = Buffer.from('fake-icon-bytes');
    const fakeBgData = Buffer.from('fake-bg-bytes');

    const draft = {
        name: 'Themed Bundle',
        pages: [page],
        coverImage: 'custom:cover.png',
        iconImage: 'custom:icon.png',
        backgroundMedia: 'custom:bg.mp4',
        customCoverFile: { name: 'cover.png', data: fakeCoverData },
        customIconFile: { name: 'icon.png', data: fakeIconData },
        customBackgroundFile: { name: 'bg.mp4', data: fakeBgData },
        visualizer: {
            mode: 'both',
            color1: '#aabbcc',
            color2: '#ddeeff',
            gradient: true,
            gradientDirection: 'horizontal'
        },
        launchpadRotation: 90,
        launchpadSize: 125
    };

    const result = buildProjectExport(draft);
    assert.equal(result.project.visualizer.mode, 'both');
    assert.equal(result.project.visualizer.color1, '#aabbcc');
    assert.equal(result.project.visualizer.color2, '#ddeeff');
    assert.equal(result.project.visualizer.gradient, true);
    assert.equal(result.project.visualizer.gradientDirection, 'horizontal');
    assert.equal(result.project.launchpadRotation, 90);
    assert.equal(result.project.launchpadSize, 125);
    assert.equal(result.project.coverImage, 'cover.png');
    assert.equal(result.project.iconImage, 'icon.png');
    assert.equal(result.project.backgroundMedia, 'background.mp4');
    assert.equal(Object.hasOwn(result.project, 'backgroundVideo'), false);

    const filePaths = result.files.map(f => f.path);
    assert.ok(filePaths.includes('cover.png'));
    assert.ok(filePaths.includes('icon.png'));
    assert.ok(filePaths.includes('background.mp4'));
    assert.equal(validateProject(result.project).isValid, true);
});

test('projectZip roundtrips theme properties and custom media files', async () => {
    const page = createProjectPage(1);
    const fakePng = Buffer.from('fake-png-content');
    const fakeVideo = Buffer.from('fake-video-content');

    const draft = {
        name: 'Full Theme Roundtrip',
        pages: [page],
        customCoverFile: { name: 'art.png', data: fakePng },
        customBackgroundFile: { name: 'ambient.mp4', data: fakeVideo },
        visualizer: {
            mode: 'both',
            color1: '#112233',
            color2: '#445566',
            gradient: true,
            gradientDirection: 'vertical'
        },
        launchpadRotation: 45,
        launchpadSize: 110
    };

    const exportResult = await exportProjectToZip(draft, JSZip);
    const importResult = await importProjectFromZip(exportResult.blob, JSZip);

    assert.equal(importResult.draft.name, 'Full Theme Roundtrip');
    assert.equal(importResult.draft.visualizer.mode, 'both');
    assert.equal(importResult.draft.visualizer.color1, '#112233');
    assert.equal(importResult.draft.visualizer.color2, '#445566');
    assert.equal(importResult.draft.visualizer.gradient, true);
    assert.equal(importResult.draft.visualizer.gradientDirection, 'vertical');
    assert.equal(importResult.draft.launchpadRotation, 45);
    assert.equal(importResult.draft.launchpadSize, 110);
    assert.ok(importResult.draft.customCoverFile);
    assert.equal(importResult.draft.customCoverFile.name, 'cover.png');
    assert.ok(importResult.draft.customBackgroundFile);
    assert.equal(importResult.draft.customBackgroundFile.name, 'background.mp4');
});

test('projectZip roundtrips image background files and builds correct draft fallbacks', async () => {
    const page = createProjectPage(1);
    const fakeImage = Buffer.from('fake-jpeg-content');

    const draft = {
        name: 'Image Background Project',
        pages: [page],
        customBackgroundFile: { name: 'landscape.jpg', data: fakeImage }
    };

    const exportResult = await exportProjectToZip(draft, JSZip);
    const importResult = await importProjectFromZip(exportResult.blob, JSZip);

    assert.equal(importResult.draft.name, 'Image Background Project');
    assert.ok(importResult.draft.customBackgroundFile);
    assert.equal(importResult.draft.customBackgroundFile.name, 'background.jpg');

    // Verify draft fallbacks when project omits visual settings
    assert.equal(importResult.draft.visualizer.mode, 'off');
    assert.equal(importResult.draft.visualizer.color1, '#00aaff');
    assert.equal(importResult.draft.visualizer.color2, '#00aaff');
    assert.equal(importResult.draft.visualizer.gradient, false);
    assert.equal(importResult.draft.visualizer.gradientDirection, 'vertical');
    // Rotation/size stay unset so the user's personal preference is preserved.
    assert.equal(importResult.draft.launchpadRotation, null);
    assert.equal(importResult.draft.launchpadSize, null);
});

test('normalizeTargetDevice validates and normalizes target device names', () => {
    assert.equal(normalizeTargetDevice('universal'), 'universal');
    assert.equal(normalizeTargetDevice('legacy'), 'legacy');
    assert.equal(normalizeTargetDevice('rgb'), 'rgb');
    assert.equal(normalizeTargetDevice('unknown'), 'universal');
    assert.equal(normalizeTargetDevice(null), 'universal');
    assert.equal(normalizeTargetDevice(undefined), 'universal');
    assert.equal(normalizeTargetDevice(123), 'universal');
});

test('createEmptyPadStep initializes default pad step structure', () => {
    const step = createEmptyPadStep();
    assert.deepEqual(step, {
        sample: null,
        soundBuffer: null,
        sampleToken: 0,
        light: '',
        lightDuration: DEFAULT_LIGHT_DURATION_SEC,
        lightSyncToSound: true
    });
});

