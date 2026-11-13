/**
 * Integration tests for js/interaction.js: pad presses, paging, modes and
 * physical button lights, driven through real modules (project state, audio
 * engine, lights, web/physical interfaces) with only the browser stubbed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createRecordingSink } from './helpers/browserStubs.js';

const { windowEvents, launchpad } = installBrowserStubs();

const { setLogSink } = await import('../js/logger.js');
const logSink = createRecordingSink();
setLogSink(logSink);

const interaction = await import('../js/interaction.js');
const { commitProject, setCurrentPage, getCurrentPage, getCurrentMode, resetProjectState } = await import('../js/projectState.js');
const { normalizeProjectData } = await import('../js/projectModel.js');
const { markProjectReady, beginLoadingProject } = await import('../js/projectLoadingState.js');
const { audioEngine } = await import('../js/audio.js');
const { animations } = await import('../js/lights.js');
const { setDeviceProfile } = await import('../js/physicalInterface.js');
const { ProfileRegistry } = await import('../js/midi-profiles/ProfileRegistry.js');
const { ERROR_SHAKE_DURATION_MS, SCENE_BUTTONS_X, AUTOMAP_BUTTONS_Y } = await import('../js/constants.js');

interaction.initInteraction();

const emptyPads = () => Array.from({ length: 64 }, () => []);

/** Commits a project whose sampled steps carry fake buffers tagged with their position. */
function loadTestProject(pages) {
    const project = { id: 'flow', name: 'Flow', pages: pages.map((page, i) => ({ name: `P${i + 1}`, ...page })) };
    const runtime = normalizeProjectData(project);
    runtime.pages.forEach((pads, pageIndex) => pads.forEach((steps, padIndex) => steps.forEach((step, stepIndex) => {
        if (step.soundUrl) step.buffer = { pageIndex, padIndex, stepIndex, duration: 2 };
    })));
    resetProjectState();
    commitProject(runtime);
    setCurrentPage(0);
    markProjectReady();
    interaction.setPadSource(null);
    interaction.resetPadStepCounters();
}

/** Replaces audioEngine.playBuffer for the duration of a test. */
function recordPlayback(t) {
    const played = [];
    const original = audioEngine.playBuffer;
    audioEngine.playBuffer = (buffer, key) => {
        played.push({ key, ...buffer });
        return buffer.duration;
    };
    t.after(() => { audioEngine.playBuffer = original; });
    return played;
}

/** Connects a real legacy Launchpad profile whose MIDI output records sent bytes. */
function connectLegacyLaunchpad(t) {
    const sent = [];
    const output = { send: (bytes) => sent.push([...bytes]) };
    const profile = ProfileRegistry.getProfile('Launchpad S', output, { onmidimessage: null });
    setDeviceProfile(profile);
    t.after(() => setDeviceProfile(null));
    const messageFor = (x, y, colorName) => profile.buildColorMessage(x, y, profile.getColor(colorName).code);
    return { sent, messageFor };
}

/** Splits recorded batches into 3-byte MIDI messages. */
const messagesOf = (sent) => sent.flatMap(batch => Array.from({ length: batch.length / 3 }, (_, i) => batch.slice(i * 3, i * 3 + 3)));

test('pressing pads through the DOM plays the step buffer, lights the pad and round-robins', (t) => {
    const sounds = emptyPads();
    sounds[3] = ['a.wav', 'b.wav'];
    loadTestProject([{ sounds }]);
    const played = recordPlayback(t);

    const pad = launchpad.pads[3];
    pad.dispatch('mousedown');
    assert.equal(pad.classList.contains('active'), true, 'pressed pad shows as active');
    pad.dispatch('mouseup');
    assert.equal(pad.classList.contains('active'), false, 'released pad is cleared');
    pad.dispatch('mousedown');
    pad.dispatch('mouseout', { relatedTarget: null });
    assert.equal(pad.classList.contains('active'), false, 'leaving a pressed pad releases it');

    assert.deepEqual(played.map(p => [p.key, p.stepIndex]), [['project:0:3', 0], ['project:0:3', 1]]);
});

test('an empty pad still gives press feedback but plays nothing', (t) => {
    loadTestProject([{ sounds: emptyPads() }]);
    const played = recordPlayback(t);

    launchpad.pads[10].dispatch('mousedown');
    assert.equal(launchpad.pads[10].classList.contains('active'), true);
    launchpad.pads[10].dispatch('mouseup');
    assert.deepEqual(played, []);
});

test('a light synced to its sound lasts as long as the sample', (t) => {
    const sounds = emptyPads();
    const lights = emptyPads();
    sounds[0] = ['kick.wav'];
    lights[0] = ['test_light'];
    loadTestProject([{ sounds, lights, lightSyncToSound: emptyPads().map(() => [true]) }]);
    recordPlayback(t);

    const calls = [];
    animations.test_light = { on: (x, y, durationMs) => calls.push({ x, y, durationMs }) };
    t.after(() => { delete animations.test_light; });

    interaction.triggerPad(0);
    interaction.releasePad(0);
    assert.deepEqual(calls, [{ x: 0, y: 0, durationMs: 2000 }], 'fake sample lasts 2s');
});

test('page buttons switch pages, highlight the active one and light the physical button', (t) => {
    loadTestProject([{ sounds: emptyPads() }, { sounds: emptyPads() }]);
    const { sent, messageFor } = connectLegacyLaunchpad(t);

    launchpad.pageButtons[1].dispatch('mousedown');

    assert.equal(getCurrentPage(), 1);
    assert.deepEqual(launchpad.pageButtons.map(b => b.classList.contains('selected')), [false, true, false, false, false, false, false, false]);
    const messages = messagesOf(sent);
    assert.deepEqual(messages.find(m => m[1] === messageFor(SCENE_BUTTONS_X, 1, 'orange')[1]), messageFor(SCENE_BUTTONS_X, 1, 'orange'));
    assert.deepEqual(messages.find(m => m[1] === messageFor(SCENE_BUTTONS_X, 0, 'off')[1]), messageFor(SCENE_BUTTONS_X, 0, 'off'));
});

test('selecting a page the project does not have shakes the Launchpad and keeps the page', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    loadTestProject([{ sounds: emptyPads() }]);

    interaction.changeSoundSet(5);
    assert.equal(getCurrentPage(), 0);
    assert.equal(launchpad.launchpad.classList.contains('error-shake'), true);

    t.mock.timers.tick(ERROR_SHAKE_DURATION_MS);
    assert.equal(launchpad.launchpad.classList.contains('error-shake'), false, 'shake ends after its duration');
});

test('pages cannot change while a project is loading', () => {
    loadTestProject([{ sounds: emptyPads() }, { sounds: emptyPads() }]);
    beginLoadingProject();
    interaction.changeSoundSet(1);
    assert.equal(getCurrentPage(), 0);
    markProjectReady();
});

test('mode buttons set the mode, sync the hardware layout and light the physical button', (t) => {
    loadTestProject([{ sounds: emptyPads() }]);
    const { sent, messageFor } = connectLegacyLaunchpad(t);
    windowEvents.length = 0;

    launchpad.modeButtons[6].dispatch('mousedown');

    assert.equal(getCurrentMode(), 6);
    const layoutEvent = windowEvents.find(e => e.type === 'midi:setHardwareLayout');
    assert.deepEqual(layoutEvent?.detail, { mode: 6 });
    assert.equal(launchpad.modeButtons[6].classList.contains('selected'), true);
    assert.deepEqual(
        messagesOf(sent).find(m => m[1] === messageFor(6, AUTOMAP_BUTTONS_Y, 'orange')[1]),
        messageFor(6, AUTOMAP_BUTTONS_Y, 'orange')
    );
});

test('navigation buttons (modes 0-3) are ignored with a warning', () => {
    loadTestProject([{ sounds: emptyPads() }]);
    interaction.changeMode(5);
    logSink.entries.length = 0;

    interaction.changeMode(2);
    assert.equal(getCurrentMode(), 5);
    assert.ok(logSink.entries.some(([level, message]) => level === 'warn' && /not an official mode/.test(message)));
});

test('a registered pad source replaces the project for presses and paging', (t) => {
    loadTestProject([{ sounds: emptyPads() }, { sounds: emptyPads() }]);
    const played = recordPlayback(t);
    const pressed = [];
    const pages = [];
    interaction.setPadSource({
        getPadPlayback: (index) => ({
            step: { buffer: { source: 'draft', duration: 1 }, light: null, syncToSound: true, duration: 1 },
            stepIndex: 0,
            totalSteps: 1,
            soundKey: `draft:0:${index}`,
            counterKey: null
        }),
        onPadPress: (index) => pressed.push(index),
        onPageChange: (page) => pages.push(page)
    });
    t.after(() => interaction.setPadSource(null));

    launchpad.pads[7].dispatch('mousedown');
    launchpad.pageButtons[1].dispatch('mousedown');

    assert.deepEqual(pressed, [7]);
    assert.deepEqual(played.map(p => [p.key, p.source]), [['draft:0:7', 'draft']]);
    assert.deepEqual(pages, [1]);
    assert.equal(getCurrentPage(), 0, 'the project page is untouched while a source is active');
});
