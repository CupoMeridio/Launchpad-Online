import assert from 'node:assert/strict';
import test from 'node:test';

// Setup minimal browser mocks
globalThis.window = {
    addEventListener() {},
    dispatchEvent() {},
    AudioContext: class {
        createGain() { return { connect() {}, gain: { value: 1, setValueAtTime() {} } }; }
        createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
    }
};

const elements = new Map();
function makeMockElement(id = '') {
    if (id && elements.has(id)) return elements.get(id);
    const listeners = {};
    const el = {
        id,
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains() { return false; }
        },
        setAttribute() {},
        getAttribute() { return null; },
        removeAttribute() {},
        dataset: {},
        options: [],
        style: {
            setProperty(k, v) { this[k] = v; },
            removeProperty(k) { delete this[k]; }
        },
        children: [],
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener(event, fn) {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
        },
        dispatch(event, e = {}) {
            const ev = { preventDefault() {}, stopPropagation() {}, ...e };
            (listeners[event] || []).forEach(fn => fn(ev));
        },
        value: '',
        disabled: false,
        textContent: '',
        hidden: false
    };
    if (id) elements.set(id, el);
    return el;
}

const dummyPads = Array.from({ length: 64 }, (_, i) => makeMockElement(`pad-${i}`));

globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    createDocumentFragment() {
        return makeMockElement('');
    },
    createElement(tag) {
        return makeMockElement('');
    },
    getElementById(id) {
        return makeMockElement(id);
    },
    querySelector(selector) {
        if (selector === '.layout' || selector === '#Launchpad' || selector === '.media-overlay' || selector === '.media-controls') {
            return makeMockElement(selector.replace(/^[.#]/, ''));
        }
        return null;
    },
    querySelectorAll(selector) {
        if (selector === '.grid-item') return dummyPads;
        return [];
    }
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const { triggerPad, releasePad, resetPadStepCounters, setPadSource } = await import('../js/interaction.js');
const { setCurrentProject, setProjectSounds, setProjectLights, setProjectLightSyncToSound, setProjectLightDurations, setCurrentPage } = await import('../js/app.js');
const { markProjectReady } = await import('../js/projectLoadingState.js');
const { audioEngine } = await import('../js/audio.js');
const { animations } = await import('../js/lights.js');

test('multisampling runtime round-robin cycles through steps on each press', () => {
    setPadSource(null);
    resetPadStepCounters();

    // Setup project with a 3-step pad at pad 0
    const mockProject = {
        name: 'Runtime Test',
        pages: [{ name: 'Page 1' }]
    };
    setCurrentProject(mockProject);
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[0] = ['step0.wav', 'step1.wav', 'step2.wav'];

    const lights = Array(64).fill(null).map(() => []);
    lights[0] = ['fade_red', 'wave_green', 'pulse_blue'];

    setProjectSounds(sounds);
    setProjectLights(lights);
    setProjectLightSyncToSound(Array(64).fill(null).map(() => [true, true, true]));
    setProjectLightDurations(Array(64).fill(null).map(() => [2.5, 2.5, 2.5]));

    // Track calls to audioEngine.playPadSound
    const playedSteps = [];
    const originalPlayPadSound = audioEngine.playPadSound;
    audioEngine.playPadSound = (padIndex, stepIndex) => {
        playedSteps.push({ padIndex, stepIndex });
        return 1.0;
    };

    try {
        // Press 1 -> Step 0
        triggerPad(0);
        releasePad(0);
        assert.equal(playedSteps.length, 1);
        assert.equal(playedSteps[0].stepIndex, 0);

        // Press 2 -> Step 1
        triggerPad(0);
        releasePad(0);
        assert.equal(playedSteps.length, 2);
        assert.equal(playedSteps[1].stepIndex, 1);

        // Press 3 -> Step 2
        triggerPad(0);
        releasePad(0);
        assert.equal(playedSteps.length, 3);
        assert.equal(playedSteps[2].stepIndex, 2);

        // Press 4 -> Step 0 (wraps back to start)
        triggerPad(0);
        releasePad(0);
        assert.equal(playedSteps.length, 4);
        assert.equal(playedSteps[3].stepIndex, 0);

        // Reset counters and verify it starts at Step 0 again
        resetPadStepCounters();
        triggerPad(0);
        releasePad(0);
        assert.equal(playedSteps.length, 5);
        assert.equal(playedSteps[4].stepIndex, 0);
    } finally {
        audioEngine.playPadSound = originalPlayPadSound;
    }
});

test('momentary animation on multi-step pad is released using the triggered step animation', () => {
    setPadSource(null);
    resetPadStepCounters();

    // Register a mock momentary animation
    let releasedAnimation = null;
    animations.mock_momentary_1 = {
        type: 'momentary',
        on() {},
        off() { releasedAnimation = 'mock_momentary_1'; }
    };
    animations.mock_momentary_2 = {
        type: 'momentary',
        on() {},
        off() { releasedAnimation = 'mock_momentary_2'; }
    };

    const mockProject = {
        name: 'Momentary Test',
        pages: [{ name: 'Page 1' }]
    };
    setCurrentProject(mockProject);
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[1] = ['s1.wav', 's2.wav'];
    const lights = Array(64).fill(null).map(() => []);
    lights[1] = ['mock_momentary_1', 'mock_momentary_2'];

    setProjectSounds(sounds);
    setProjectLights(lights);

    // Trigger pad 1 (triggers mock_momentary_1, advances counter to step 1)
    triggerPad(1);

    // Release pad 1 (must release mock_momentary_1 despite counter having moved to step 1)
    releasePad(1);
    assert.equal(releasedAnimation, 'mock_momentary_1');

    // Trigger next: should trigger mock_momentary_2
    triggerPad(1);
    releasePad(1);
    assert.equal(releasedAnimation, 'mock_momentary_2');

    delete animations.mock_momentary_1;
    delete animations.mock_momentary_2;
});

test('single-step pads remain at step 0 across multiple presses', () => {
    setPadSource(null);
    resetPadStepCounters();

    const mockProject = {
        name: 'Single Step Test',
        pages: [{ name: 'Page 1' }]
    };
    setCurrentProject(mockProject);
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[5] = ['only_one.wav'];
    const lights = Array(64).fill(null).map(() => []);
    lights[5] = ['fade_red'];

    setProjectSounds(sounds);
    setProjectLights(lights);

    const playedSteps = [];
    const orig = audioEngine.playPadSound;
    audioEngine.playPadSound = (padIndex, stepIndex) => {
        playedSteps.push(stepIndex);
        return 1.0;
    };

    try {
        triggerPad(5);
        releasePad(5);
        triggerPad(5);
        releasePad(5);
        triggerPad(5);
        releasePad(5);

        assert.deepEqual(playedSteps, [0, 0, 0]);
    } finally {
        audioEngine.playPadSound = orig;
    }
});

test('creator preview button triggers hold preview for momentary animation on step > 0', async () => {
    const { initializeProjectCreator, openCreator, getDraft } = await import('../js/projectCreator.js');
    const { assignPadStepLight } = await import('../js/projectCreatorModel.js');

    // Register a mock momentary animation
    let holdTriggered = false;
    let holdReleased = false;
    animations.mock_momentary_step1 = {
        type: 'momentary',
        on() { holdTriggered = true; },
        off() { holdReleased = true; }
    };

    initializeProjectCreator();
    openCreator();

    const draft = getDraft();
    const page = draft.pages[0];

    // Add step 1 using the UI add-step button
    const addStepBtn = elements.get('creator-add-step');
    assert.ok(addStepBtn);
    addStepBtn.dispatch('click');

    // Step 0: non-momentary
    assignPadStepLight(page, 0, 0, 'fade_red');
    // Step 1: momentary
    assignPadStepLight(page, 0, 1, 'mock_momentary_step1');

    // Select step 1 via step pill so inspector and preview button update
    const stepPillsContainer = elements.get('creator-step-pills');
    const pill1 = stepPillsContainer?.children?.[1];
    assert.ok(pill1, 'step pill for step 1 should exist');
    pill1.dispatch('click');

    const previewBtn = elements.get('creator-preview-pad');
    assert.ok(previewBtn);
    assert.equal(previewBtn.disabled, false, 'preview button should be enabled');

    // Dispatch pointerdown on previewBtn
    holdTriggered = false;
    previewBtn.dispatch('pointerdown', { button: 0 });
    assert.equal(holdTriggered, true, 'pointerdown on momentary step > 0 must trigger hold preview');

    // Dispatch pointerup
    previewBtn.dispatch('pointerup', {});
    assert.equal(holdReleased, true, 'pointerup must release hold preview');

    delete animations.mock_momentary_step1;
});
