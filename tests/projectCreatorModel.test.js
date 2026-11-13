import assert from 'node:assert/strict';
import test from 'node:test';
import { 
    buildProjectExport, 
    createProjectId, 
    createProjectPage, 
    createDraft,
    createDraftStep,
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
    assert.equal(getPadSteps(draft.pages[0], 0)[0].syncToSound, false);
    assert.equal(getPadSteps(draft.pages[0], 0)[0].duration, 4.2);
});

test('projectZip roundtrips draft export to zip and import from zip', async () => {
    const page = createProjectPage(1);
    const fakeAudioContent = Buffer.from('RIFF1234WAVEfmt ');
    getPadSteps(page, 0)[0].sample = { name: 'kick.wav', data: fakeAudioContent };
    getPadSteps(page, 0)[0].light = 'fade_red';
    getPadSteps(page, 0)[0].syncToSound = false;
    getPadSteps(page, 0)[0].duration = 3.0;

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
    assert.equal(getPadSteps(importResult.draft.pages[0], 0)[0].syncToSound, false);
    assert.equal(getPadSteps(importResult.draft.pages[0], 0)[0].duration, 3.0);
});

test('createDraft initializes a canonical default appearance and accepts overrides', () => {
    const draft = createDraft();
    assert.deepEqual(draft.appearance, {
        background: null,
        skin: null,
        icon: null,
        visualizer: {
            mode: 'off',
            color1: '#00aaff',
            color2: '#00aaff',
            gradient: false,
            gradientDirection: 'vertical'
        },
        rotation: null,
        size: null
    });

    const customDraft = createDraft('Themed Project', null, {
        appearance: {
            visualizer: { mode: 'glow', color1: '#123456' },
            skin: 'custom-cover.jpg',
            background: 'custom-bg.mp4',
            rotation: 180,
            size: 75
        }
    });
    assert.equal(customDraft.appearance.visualizer.mode, 'glow');
    assert.equal(customDraft.appearance.visualizer.color1, '#123456');
    assert.equal(customDraft.appearance.visualizer.color2, '#00aaff', 'partial visualizer is completed with defaults');
    assert.equal(customDraft.appearance.skin, 'custom-cover.jpg');
    assert.equal(customDraft.appearance.background, 'custom-bg.mp4');
    assert.equal(customDraft.appearance.icon, null);
    assert.equal(customDraft.appearance.rotation, 180);
    assert.equal(customDraft.appearance.size, 75);
});

test('buildProjectExport exports theme properties and packages custom media files', () => {
    const page = createProjectPage(1);
    const fakeCoverData = Buffer.from('fake-image-bytes');
    const fakeIconData = Buffer.from('fake-icon-bytes');
    const fakeBgData = Buffer.from('fake-bg-bytes');

    const draft = {
        name: 'Themed Bundle',
        pages: [page],
        appearance: {
            skin: { name: 'cover.png', data: fakeCoverData },
            icon: { name: 'icon.png', data: fakeIconData },
            background: { name: 'bg.mp4', data: fakeBgData },
            visualizer: {
                mode: 'both',
                color1: '#aabbcc',
                color2: '#ddeeff',
                gradient: true,
                gradientDirection: 'horizontal'
            },
            rotation: 90,
            size: 125
        }
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
        appearance: {
            skin: { name: 'art.png', data: fakePng },
            background: { name: 'ambient.mp4', data: fakeVideo },
            visualizer: {
                mode: 'both',
                color1: '#112233',
                color2: '#445566',
                gradient: true,
                gradientDirection: 'vertical'
            },
            rotation: 45,
            size: 110
        }
    };

    const exportResult = await exportProjectToZip(draft, JSZip);
    const importResult = await importProjectFromZip(exportResult.blob, JSZip);

    assert.equal(importResult.draft.name, 'Full Theme Roundtrip');
    assert.equal(importResult.draft.appearance.visualizer.mode, 'both');
    assert.equal(importResult.draft.appearance.visualizer.color1, '#112233');
    assert.equal(importResult.draft.appearance.visualizer.color2, '#445566');
    assert.equal(importResult.draft.appearance.visualizer.gradient, true);
    assert.equal(importResult.draft.appearance.visualizer.gradientDirection, 'vertical');
    assert.equal(importResult.draft.appearance.rotation, 45);
    assert.equal(importResult.draft.appearance.size, 110);
    assert.ok(importResult.draft.appearance.skin);
    assert.equal(importResult.draft.appearance.skin.name, 'cover.png');
    assert.ok(importResult.draft.appearance.background);
    assert.equal(importResult.draft.appearance.background.name, 'background.mp4');
});

test('projectZip roundtrips image background files and builds correct draft fallbacks', async () => {
    const page = createProjectPage(1);
    const fakeImage = Buffer.from('fake-jpeg-content');

    const draft = {
        name: 'Image Background Project',
        pages: [page],
        appearance: { background: { name: 'landscape.jpg', data: fakeImage } }
    };

    const exportResult = await exportProjectToZip(draft, JSZip);
    const importResult = await importProjectFromZip(exportResult.blob, JSZip);

    assert.equal(importResult.draft.name, 'Image Background Project');
    assert.ok(importResult.draft.appearance.background);
    assert.equal(importResult.draft.appearance.background.name, 'background.jpg');

    // Verify draft fallbacks when project omits visual settings
    assert.equal(importResult.draft.appearance.visualizer.mode, 'off');
    assert.equal(importResult.draft.appearance.visualizer.color1, '#00aaff');
    assert.equal(importResult.draft.appearance.visualizer.color2, '#00aaff');
    assert.equal(importResult.draft.appearance.visualizer.gradient, false);
    assert.equal(importResult.draft.appearance.visualizer.gradientDirection, 'vertical');
    // Rotation/size stay unset so the user's personal preference is preserved.
    assert.equal(importResult.draft.appearance.rotation, null);
    assert.equal(importResult.draft.appearance.size, null);
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

test('createDraftStep is a PadStep plus the editor-only sample fields', () => {
    const step = createDraftStep();
    assert.deepEqual(step, {
        soundUrl: null,
        buffer: null,
        light: null,
        syncToSound: true,
        duration: DEFAULT_LIGHT_DURATION_SEC,
        sample: null,
        sampleToken: 0
    });
});


test('import -> export is lossless and idempotent for steps, lights, timing and packaged assets', () => {
    const sample = (name) => ({ name, data: Buffer.from(name) });
    const emptyPads = () => Array.from({ length: 64 }, () => []);

    const sounds = emptyPads();
    const lights = emptyPads();
    const sync = emptyPads();
    const durations = emptyPads();
    sounds[0] = ['samples/page-1/pad-01_step-01.wav', 'samples/page-1/pad-01_step-02.wav', ''];
    lights[0] = ['fade_red', '', 'wave_blue'];
    sync[0] = [true, false, false];
    durations[0] = [DEFAULT_LIGHT_DURATION_SEC, 2.5, 4];
    lights[9] = ['pulse_green'];
    sounds[9] = [''];
    sync[9] = [true];
    durations[9] = [1.5];

    const project = {
        id: 'roundtrip', name: 'Roundtrip', targetDevice: 'rgb',
        pages: [{ name: 'Intro', sounds, lights, lightSyncToSound: sync, lightDurations: durations }],
        coverImage: 'cover.png',
        backgroundMedia: 'background.mp4',
        visualizer: { mode: 'both', color1: '#112233', color2: '#445566', gradient: true, gradientDirection: 'horizontal' },
        launchpadRotation: 90
    };
    const archive = new Map([
        ['samples/page-1/pad-01_step-01.wav', sample('a.wav')],
        ['samples/page-1/pad-01_step-02.wav', sample('b.wav')],
        ['cover.png', sample('cover.png')],
        ['background.mp4', sample('background.mp4')]
    ]);

    const firstDraft = buildDraftFromProject(project, archive);
    assert.deepEqual(firstDraft.missingAssets, []);
    const firstExport = buildProjectExport(firstDraft);
    assert.deepEqual(firstExport.project, project, 'export(import(project)) reproduces the project');

    const secondArchive = new Map(firstExport.files.map(({ path, file }) => [path, file]));
    const secondExport = buildProjectExport(buildDraftFromProject(firstExport.project, secondArchive));
    assert.deepEqual(secondExport.project, firstExport.project, 'a second round trip changes nothing');
    assert.deepEqual(secondExport.files.map(f => f.path), firstExport.files.map(f => f.path));
});

test('catalog assets are exported as canonical app paths and survive a zip round trip', async () => {
    const draft = createDraft('Catalog Assets', null, {
        appearance: {
            background: 'assets/videos/Neon Tunnel.webm',
            skin: 'assets/images/launchpad covers/black_bg_blue_squares_tl.png'
        }
    });

    const exported = buildProjectExport(draft);
    assert.equal(exported.project.backgroundMedia, 'assets/videos/Neon Tunnel.webm');
    assert.equal(exported.project.coverImage, 'assets/images/launchpad covers/black_bg_blue_squares_tl.png');
    assert.deepEqual(exported.files, [], 'app assets are not packaged');

    const { blob } = await exportProjectToZip(draft, JSZip);
    const { draft: imported, missingAssets } = await importProjectFromZip(blob, JSZip);
    assert.deepEqual(missingAssets, []);
    assert.equal(imported.appearance.background, 'assets/videos/Neon Tunnel.webm');
    assert.equal(imported.appearance.skin, 'assets/images/launchpad covers/black_bg_blue_squares_tl.png');
});

test('draft device check counts RGB-only lights on legacy targets, like the exported project', async () => {
    const { checkDraftDeviceConsistency } = await import('../js/projectCreatorModel.js');
    const { checkProjectDeviceConsistency } = await import('../js/projectValidator.js');

    const draft = createDraft('Legacy Target', null, { targetDevice: 'legacy' });
    getPadSteps(draft.pages[0], 0)[0].light = 'fade_white';   // RGB-only colour
    getPadSteps(draft.pages[0], 1)[0].light = 'fade_red';     // available on legacy
    getPadSteps(draft.pages[0], 2).push(createDraftStep({ light: 'fade_white' }));

    assert.deepEqual(checkDraftDeviceConsistency(draft), { rgbLightCount: 2 });
    assert.deepEqual(checkProjectDeviceConsistency(buildProjectExport(draft).project), { rgbLightCount: 2 });

    draft.targetDevice = 'rgb';
    assert.deepEqual(checkDraftDeviceConsistency(draft), { rgbLightCount: 0 });
});
