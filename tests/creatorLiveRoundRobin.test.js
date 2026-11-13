import assert from 'node:assert/strict';
import test from 'node:test';

// Setup minimal browser mocks (same shape as the other runtime suites).
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
    createElement() {
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

const { triggerPad, releasePad } = await import('../js/interaction.js');
const { audioEngine } = await import('../js/audio.js');

// Regression test for the live round-robin double-advance: the Studio Creator's
// pad source and `releasePad` both used to move the step cursor, so a pad whose
// steps carry no light played step 1 > step 3 > step 2 instead of 1 > 2 > 3.
// It must run against the real creator, since the default pad source never had
// the defect and therefore cannot guard against its return.
test('creator live mode advances the round-robin once per press on lightless multi-step pads', async () => {
    const { initializeProjectCreator, openCreator } = await import('../js/projectCreator.js');

    // Real creator flow: open the studio, build a 3-step pad carrying samples
    // only (no lights), then switch to live preview.
    initializeProjectCreator();
    openCreator();

    const originalDecode = audioEngine.decodeAudioFile;
    audioEngine.decodeAudioFile = async (file) => `buffer:${file.name}`;

    const sampleInput = elements.get('creator-sample-file');
    const addStepButton = elements.get('creator-add-step');
    const flushAssignments = () => new Promise(resolve => setTimeout(resolve, 0));

    try {
        for (let step = 0; step < 3; step++) {
            if (step > 0) addStepButton.dispatch('click');
            sampleInput.dispatch('change', { target: { files: [{ name: `step-${step}.wav` }], value: '' } });
            await flushAssignments();
        }
    } finally {
        audioEngine.decodeAudioFile = originalDecode;
    }

    elements.get('studio-mode-live').dispatch('click');

    const playedBuffers = [];
    const originalPlayBuffer = audioEngine.playBuffer;
    audioEngine.playBuffer = (buffer) => {
        playedBuffers.push(buffer);
        return 1.0;
    };

    try {
        for (let press = 0; press < 6; press++) {
            triggerPad(0);
            releasePad(0);
        }
    } finally {
        audioEngine.playBuffer = originalPlayBuffer;
    }

    assert.deepEqual(playedBuffers, [
        'buffer:step-0.wav', 'buffer:step-1.wav', 'buffer:step-2.wav',
        'buffer:step-0.wav', 'buffer:step-1.wav', 'buffer:step-2.wav'
    ]);
});
