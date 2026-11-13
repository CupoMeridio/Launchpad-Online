import assert from 'node:assert/strict';
import test from 'node:test';

// Setup minimal browser mocks
globalThis.window = {
    addEventListener() {},
    dispatchEvent() {},
    setTimeout() { return 0; },
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

// Walks the mock DOM tree produced by renderLightPresets to find a preset swatch.
function findAnimationSwatch(animationName) {
    const stack = [elements.get('creator-light-presets')];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node.dataset?.animation === animationName) return node;
        stack.push(...(node.children || []));
    }
    return null;
}

globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    createDocumentFragment() {
        return makeMockElement('');
    },
    createElement(_tag) {
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
const { commitProject, setCurrentPage } = await import('../js/projectState.js');

/**
 * Commits a single-page runtime project, filling unspecified per-pad fields
 * with the same defaults `normalizeProjectData` produces.
 */
function commitTestProject(project, { sounds, lights, lightSyncToSound, lightDurations }) {
    commitProject({
        project,
        sounds,
        lights,
        lightSyncToSound: lightSyncToSound || Array(64).fill(null).map(() => [true]),
        lightDurations: lightDurations || Array(64).fill(null).map(() => [2.5]),
        appearance: {}
    });
}
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
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[0] = ['step0.wav', 'step1.wav', 'step2.wav'];

    const lights = Array(64).fill(null).map(() => []);
    lights[0] = ['fade_red', 'wave_green', 'pulse_blue'];

    commitTestProject(mockProject, {
        sounds,
        lights,
        lightSyncToSound: Array(64).fill(null).map(() => [true, true, true]),
        lightDurations: Array(64).fill(null).map(() => [2.5, 2.5, 2.5])
    });

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

test('multi-step pad without lights advances the round-robin cursor exactly once per press', () => {
    setPadSource(null);
    resetPadStepCounters();

    const mockProject = {
        name: 'Lightless Runtime Test',
        pages: [{ name: 'Page 1' }]
    };
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[2] = ['a.wav', 'b.wav', 'c.wav'];

    // No light on any step: releasePad must not re-read/re-advance the cursor.
    const lights = Array(64).fill(null).map(() => []);

    commitTestProject(mockProject, {
        sounds,
        lights,
        lightSyncToSound: Array(64).fill(null).map(() => [true, true, true]),
        lightDurations: Array(64).fill(null).map(() => [2.5, 2.5, 2.5])
    });

    const playedSteps = [];
    const originalPlayPadSound = audioEngine.playPadSound;
    audioEngine.playPadSound = (_padIndex, stepIndex) => {
        playedSteps.push(stepIndex);
        return 1.0;
    };

    try {
        triggerPad(2);
        releasePad(2);
        triggerPad(2);
        releasePad(2);
        triggerPad(2);
        releasePad(2);

        // Sequential order proves the counter is not advanced twice.
        assert.deepEqual(playedSteps, [0, 1, 2]);
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
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[1] = ['s1.wav', 's2.wav'];
    const lights = Array(64).fill(null).map(() => []);
    lights[1] = ['mock_momentary_1', 'mock_momentary_2'];

    commitTestProject(mockProject, { sounds, lights });

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
    setCurrentPage(0);
    markProjectReady();

    const sounds = Array(64).fill(null).map(() => []);
    sounds[5] = ['only_one.wav'];
    const lights = Array(64).fill(null).map(() => []);
    lights[5] = ['fade_red'];

    commitTestProject(mockProject, { sounds, lights });

    const playedSteps = [];
    const orig = audioEngine.playPadSound;
    audioEngine.playPadSound = (_padIndex, stepIndex) => {
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
    const { initializeProjectCreator, openCreator } = await import('../js/projectCreator.js');

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

    // Add a second step (which becomes the selected one) and assign the
    // momentary light to it through the light-preset swatch, as a user would.
    const addStepBtn = elements.get('creator-add-step');
    assert.ok(addStepBtn);
    addStepBtn.dispatch('click');

    const swatch = findAnimationSwatch('mock_momentary_step1');
    assert.ok(swatch, 'momentary light preset must be rendered');
    swatch.dispatch('click');

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
