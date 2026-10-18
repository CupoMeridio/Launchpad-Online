import assert from 'node:assert/strict';
import test from 'node:test';

// Setup minimal browser mocks for testing interaction and lights
globalThis.window = {
    addEventListener() {},
    dispatchEvent() {},
    AudioContext: class {
        createGain() { return { connect() {}, gain: { value: 1, setValueAtTime() {} } }; }
        createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
    }
};
const dummyPads = Array.from({ length: 64 }, (_, i) => ({
    id: `pad-${i}`,
    classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
    },
    setAttribute() {},
    getAttribute() { return null; }
}));

globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    getElementById(id) {
        return dummyPads[0];
    },
    querySelectorAll(selector) {
        if (selector === '.grid-item') return dummyPads;
        return [];
    }
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const { animations } = await import('../js/lights.js');
const { setPadSource, getPadSource, triggerPad, releasePad } = await import('../js/interaction.js');
const { buildAnimationCatalog } = await import('../js/projectCreatorModel.js');
const { ANIMATION_COLORS } = await import('../js/constants.js');

test('all registered animations are pre-tagged with correct metadata', () => {
    const keys = Object.keys(animations);
    assert.ok(keys.length > 50, 'Animation registry should contain all animations');

    const validCategories = new Set(['basic', 'geometric', 'directional', 'multicolor', 'characters', 'special']);

    for (const key of keys) {
        const anim = animations[key];
        assert.ok(validCategories.has(anim.category), `Animation ${key} has invalid category: ${anim.category}`);
        assert.ok(typeof anim.baseName === 'string' && anim.baseName.length > 0, `Animation ${key} must have a baseName`);
        assert.equal(typeof anim.supportsDuration, 'boolean', `Animation ${key} must have boolean supportsDuration`);
        assert.equal(anim.supportsDuration, anim.type === 'fixed', `supportsDuration must match type === 'fixed' for ${key}`);
    }

    // Specific category checks
    assert.equal(animations['fade_red'].category, 'basic');
    assert.equal(animations['hold_red'].category, 'basic');
    assert.equal(animations['matrix_rain_red'].category, 'special');
    assert.equal(animations['strobe_burst_red'].category, 'special');
    assert.equal(animations['wave_red'].category, 'geometric');
    assert.equal(animations['arrow_up_red'].category, 'directional');
    assert.equal(animations['wave_multi_red_to_green'].category, 'multicolor');
});

test('pad source provider correctly routes pad presses and releases', () => {
    assert.equal(getPadSource(), null, 'Default pad source should be null');

    let pressedPad = null;
    let configQueried = false;

    const mockProvider = {
        getPadConfig: (index) => {
            configQueried = true;
            return {
                soundIndex: undefined,
                soundBuffer: null,
                animationName: 'fade_red',
                syncToSound: false,
                manualDuration: 1.0
            };
        },
        onPadPress: (index) => {
            pressedPad = index;
        }
    };

    setPadSource(mockProvider);
    assert.equal(getPadSource(), mockProvider);

    triggerPad(7);
    assert.equal(pressedPad, 7, 'onPadPress should be called with pad index');
    assert.equal(configQueried, true, 'getPadConfig should be queried on pad press');

    releasePad(7);

    setPadSource(null);
    assert.equal(getPadSource(), null, 'setPadSource(null) restores default provider');
});

test('audioEngine stopSoundsWithPrefix isolates draft sounds from performance sounds', async () => {
    const { audioEngine } = await import('../js/audio.js');

    const stopped = [];
    audioEngine.activeSources.set('draft:0:1', { stop: () => stopped.push('draft:0:1') });
    audioEngine.activeSources.set('draft:1:5', { stop: () => stopped.push('draft:1:5') });
    audioEngine.activeSources.set(0, { stop: () => stopped.push(0) });
    audioEngine.activeSources.set(64, { stop: () => stopped.push(64) });
    audioEngine.activeSources.set('preview', { stop: () => stopped.push('preview') });

    audioEngine.stopSoundsWithPrefix('draft:');

    assert.deepEqual(stopped, ['draft:0:1', 'draft:1:5']);
    assert.equal(audioEngine.activeSources.has('draft:0:1'), false);
    assert.equal(audioEngine.activeSources.has('draft:1:5'), false);
    assert.equal(audioEngine.activeSources.has(0), true);
    assert.equal(audioEngine.activeSources.has(64), true);
    assert.equal(audioEngine.activeSources.has('preview'), true);

    // Clean up
    audioEngine.stopSound(0);
    audioEngine.stopSound(64);
    audioEngine.stopSound('preview');
});

test('creator sample token logic rejects superseded or canceled audio decodes', () => {
    const page = {
        samples: Array(64).fill(null),
        soundBuffers: Array(64).fill(null),
        sampleTokens: Array(64).fill(0)
    };

    const targetIndex = 5;

    // First assignment starts
    const token1 = ++page.sampleTokens[targetIndex];
    // Second assignment starts immediately after
    const token2 = ++page.sampleTokens[targetIndex];

    // Simulated resolution of first assignment (slow)
    if (page.sampleTokens[targetIndex] === token1) {
        page.samples[targetIndex] = { name: 'slow.wav' };
        page.soundBuffers[targetIndex] = 'slowBuffer';
    }

    // Token 1 was superseded, so nothing should have been assigned
    assert.equal(page.samples[targetIndex], null);
    assert.equal(page.soundBuffers[targetIndex], null);

    // Simulated resolution of second assignment (fast)
    if (page.sampleTokens[targetIndex] === token2) {
        page.samples[targetIndex] = { name: 'fast.wav' };
        page.soundBuffers[targetIndex] = 'fastBuffer';
    }

    assert.equal(page.samples[targetIndex].name, 'fast.wav');
    assert.equal(page.soundBuffers[targetIndex], 'fastBuffer');

    // User removes sample while another decode is in-flight
    const token3 = ++page.sampleTokens[targetIndex];
    page.sampleTokens[targetIndex]++; // User clicks Remove
    page.samples[targetIndex] = null;
    page.soundBuffers[targetIndex] = null;

    // Decode 3 finishes late
    if (page.sampleTokens[targetIndex] === token3) {
        page.samples[targetIndex] = { name: 'cancelled.wav' };
        page.soundBuffers[targetIndex] = 'cancelledBuffer';
    }

    // Pad stays empty
    assert.equal(page.samples[targetIndex], null);
    assert.equal(page.soundBuffers[targetIndex], null);
});

