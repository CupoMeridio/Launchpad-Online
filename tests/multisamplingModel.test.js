import assert from 'node:assert/strict';
import test from 'node:test';
import { 
    createProjectPage, 
    createDraft,
    getPadSteps,
    addPadStep,
    removePadStep,
    assignPadStepSample,
    removePadStepSample,
    assignPadStepLight,
    setPadStepLightSync,
    setPadStepLightDuration,
    buildProjectExport
} from '../js/projectCreatorModel.js';
import { exportProjectToZip, importProjectFromZip } from '../js/projectZip.js';
import { validateProject } from '../js/projectValidator.js';
import { MAX_PAD_STEPS } from '../js/constants.js';
import JSZip from 'jszip';

test('multisampling model manages pad step addition and removal within limits', () => {
    const page = createProjectPage(1);

    // Initial pad steps should have 1 empty step
    let steps = getPadSteps(page, 0);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].sample, null);
    assert.equal(steps[0].light, '');

    // Add steps up to MAX_PAD_STEPS
    for (let i = 1; i < MAX_PAD_STEPS; i++) {
        const newIndex = addPadStep(page, 0);
        assert.equal(newIndex, i);
    }
    steps = getPadSteps(page, 0);
    assert.equal(steps.length, 16);

    // Exceeding MAX_PAD_STEPS is capped
    const extraIndex = addPadStep(page, 0);
    assert.equal(extraIndex, 15);
    assert.equal(getPadSteps(page, 0).length, 16);

    // Cannot remove when down to 1 step
    const freshPage = createProjectPage(1);
    assert.equal(removePadStep(freshPage, 0, 0), false);
    assert.equal(getPadSteps(freshPage, 0).length, 1);

    // Removing step 1 when having 2 steps
    addPadStep(freshPage, 0);
    assert.equal(getPadSteps(freshPage, 0).length, 2);
    assert.equal(removePadStep(freshPage, 0, 1), true);
    assert.equal(getPadSteps(freshPage, 0).length, 1);
});

test('multisampling step sample assignment and removal updates the targeted step', async () => {
    const page = createProjectPage(1);
    addPadStep(page, 0);

    const fakeFile1 = { name: 'sample-01.wav', arrayBuffer: async () => new ArrayBuffer(8) };
    const fakeFile2 = { name: 'sample-02.wav', arrayBuffer: async () => new ArrayBuffer(8) };
    const mockDecoder = async () => ({ duration: 1.5 });

    // Assign to step 0
    await assignPadStepSample(page, 0, 0, fakeFile1, mockDecoder);
    assert.equal(getPadSteps(page, 0)[0].sample?.name, 'sample-01.wav');
    assert.equal(getPadSteps(page, 0)[0].soundBuffer?.duration, 1.5);

    // Assign to step 1
    await assignPadStepSample(page, 0, 1, fakeFile2, mockDecoder);
    assert.equal(getPadSteps(page, 0)[0].sample?.name, 'sample-01.wav', 'step 0 untouched by step 1 mutation');
    assert.equal(getPadSteps(page, 0)[1].sample?.name, 'sample-02.wav');

    // Remove step 0: step 1 becomes step 0
    removePadStep(page, 0, 0);
    assert.equal(getPadSteps(page, 0).length, 1);
    assert.equal(getPadSteps(page, 0)[0].sample?.name, 'sample-02.wav');

    // Remove sample from remaining step 0
    removePadStepSample(page, 0, 0);
    assert.equal(getPadSteps(page, 0)[0].sample, null);
});

test('multisampling step lights and timings synchronize correctly', () => {
    const page = createProjectPage(1);
    addPadStep(page, 5);

    assignPadStepLight(page, 5, 0, 'fade_red');
    assignPadStepLight(page, 5, 1, 'wave_blue');
    setPadStepLightSync(page, 5, 1, false);
    setPadStepLightDuration(page, 5, 1, 4.5);

    const steps = getPadSteps(page, 5);
    assert.equal(steps[0].light, 'fade_red');
    assert.equal(steps[1].light, 'wave_blue');
    assert.equal(steps[1].lightSyncToSound, false);
    assert.equal(steps[1].lightDuration, 4.5);
});

test('exporting project with multisampling outputs step arrays and indexed filenames', () => {
    const page = createProjectPage(1);
    addPadStep(page, 0);
    addPadStep(page, 0);

    const steps = getPadSteps(page, 0);
    steps[0].sample = { name: 'hit1.wav' };
    steps[0].light = 'fade_red';
    steps[1].sample = { name: 'hit2.wav' };
    steps[1].light = 'wave_green';
    steps[2].sample = { name: 'hit3.wav' };
    steps[2].light = 'pulse_blue';

    const draft = createDraft('Multisample Test', [page]);
    const exportResult = buildProjectExport(draft);

    assert.equal(validateProject(exportResult.project).isValid, true);
    assert.deepEqual(exportResult.project.pages[0].sounds[0], [
        'samples/page-1/pad-01_step-01.wav',
        'samples/page-1/pad-01_step-02.wav',
        'samples/page-1/pad-01_step-03.wav'
    ]);
    assert.deepEqual(exportResult.project.pages[0].lights[0], [
        'fade_red',
        'wave_green',
        'pulse_blue'
    ]);

    // Check exported file paths
    assert.deepEqual(exportResult.files.map(f => f.path), [
        'samples/page-1/pad-01_step-01.wav',
        'samples/page-1/pad-01_step-02.wav',
        'samples/page-1/pad-01_step-03.wav'
    ]);
});

test('projectZip roundtrips multi-step draft export and import', async () => {
    const page = createProjectPage(1);
    addPadStep(page, 2);

    const fakeAudio1 = Buffer.from('RIFF1234WAVEfmt step1');
    const fakeAudio2 = Buffer.from('RIFF5678WAVEfmt step2');

    const steps = getPadSteps(page, 2);
    steps[0].sample = { name: 'snare_a.wav', data: fakeAudio1 };
    steps[0].light = 'fade_cyan';
    steps[0].lightSyncToSound = true;
    steps[1].sample = { name: 'snare_b.wav', data: fakeAudio2 };
    steps[1].light = 'pulse_amber';
    steps[1].lightSyncToSound = false;
    steps[1].lightDuration = 3.2;

    const originalDraft = createDraft('Multi Zip Test', [page]);
    const { blob, filename } = await exportProjectToZip(originalDraft, JSZip);
    assert.ok(blob);
    assert.equal(filename, 'multi-zip-test.zip');

    const { draft: importedDraft } = await importProjectFromZip(blob, JSZip);
    assert.equal(importedDraft.name, 'Multi Zip Test');
    const importedSteps = getPadSteps(importedDraft.pages[0], 2);
    assert.equal(importedSteps.length, 2);
    assert.equal(importedSteps[0].light, 'fade_cyan');
    assert.equal(importedSteps[0].lightSyncToSound, true);
    assert.equal(importedSteps[1].light, 'pulse_amber');
    assert.equal(importedSteps[1].lightSyncToSound, false);
    assert.equal(importedSteps[1].lightDuration, 3.2);
    assert.ok(importedSteps[0].sample);
    assert.ok(importedSteps[1].sample);
});

test('async sample decode stays anchored to the targeted step even if steps shift', async () => {
    const page = createProjectPage(1);
    addPadStep(page, 0); // step 1
    addPadStep(page, 0); // step 2
    assert.equal(getPadSteps(page, 0).length, 3);

    let resolveDecoder = null;
    const pendingDecode = new Promise(resolve => { resolveDecoder = resolve; });

    // Start upload targeting step 1 (originally the middle step)
    const assignmentPromise = assignPadStepSample(
        page,
        0,
        1,
        { name: 'target-step.wav' },
        () => pendingDecode
    );

    // While decode is in flight, remove step 0. Step 1 shifts to index 0!
    removePadStep(page, 0, 0);
    assert.equal(getPadSteps(page, 0).length, 2);

    // Resolve decoding
    resolveDecoder({ duration: 2.2 });
    const result = await assignmentPromise;

    assert.equal(result, 'assigned');
    const remainingSteps = getPadSteps(page, 0);
    // The target step shifted from index 1 to index 0
    assert.equal(remainingSteps[0].sample?.name, 'target-step.wav');
    assert.equal(remainingSteps[0].soundBuffer?.duration, 2.2);
    // Index 1 (originally step 2) must remain untouched
    assert.equal(remainingSteps[1].sample, null);
    assert.equal(remainingSteps[1].soundBuffer, null);
});

test('simultaneous uploads on different steps of the same pad do not cancel each other', async () => {
    const page = createProjectPage(1);
    addPadStep(page, 0); // step 1

    let resolveStep0 = null;
    let resolveStep1 = null;
    const decode0 = new Promise(resolve => { resolveStep0 = resolve; });
    const decode1 = new Promise(resolve => { resolveStep1 = resolve; });

    const p0 = assignPadStepSample(page, 0, 0, { name: 'step0.wav' }, () => decode0);
    const p1 = assignPadStepSample(page, 0, 1, { name: 'step1.wav' }, () => decode1);

    // Resolve step 0 first
    resolveStep0({ duration: 1.0 });
    const res0 = await p0;
    assert.equal(res0, 'assigned');

    // Resolve step 1 second
    resolveStep1({ duration: 2.0 });
    const res1 = await p1;
    assert.equal(res1, 'assigned');

    const steps = getPadSteps(page, 0);
    assert.equal(steps[0].sample?.name, 'step0.wav');
    assert.equal(steps[1].sample?.name, 'step1.wav');
});

test('removing a step while its decode is in-flight returns superseded and does not pollute pad', async () => {
    const page = createProjectPage(1);
    addPadStep(page, 0);

    let resolveLate = null;
    const lateDecode = new Promise(resolve => { resolveLate = resolve; });

    const p = assignPadStepSample(page, 0, 1, { name: 'deleted-step.wav' }, () => lateDecode);

    // Remove step 1 before decode completes
    removePadStep(page, 0, 1);
    assert.equal(getPadSteps(page, 0).length, 1);

    resolveLate({ duration: 1.5 });
    const res = await p;
    assert.equal(res, 'superseded');

    const remainingSteps = getPadSteps(page, 0);
    assert.equal(remainingSteps.length, 1);
    assert.equal(remainingSteps[0].sample, null);
});
