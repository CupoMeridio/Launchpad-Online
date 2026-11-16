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

function makeMockElement(id = '') {
    return {
        id,
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains() { return false; }
        },
        setAttribute() {},
        getAttribute() { return null; },
        dataset: {},
        style: {
            setProperty(k, v) { this[k] = v; },
            removeProperty(k) { delete this[k]; }
        },
        children: [],
        appendChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        value: '',
        disabled: false,
        textContent: '',
        hidden: false
    };
}

const dummyPads = Array.from({ length: 64 }, (_, i) => makeMockElement(`pad-${i}`));

globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    getElementById(id) {
        return makeMockElement(id);
    },
    querySelector() {
        return null;
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
const { setWebColor, webColorMap, setWebModel, isLegacyModeActive, getWebColor, getEffectiveWebColorName } = await import('../js/webInterface.js');
const { setDeviceProfile, getActiveDeviceProfile } = await import('../js/physicalInterface.js');
const { createProjectPage, assignPadStepSample, removePadStepSample, createDraft, assignSampleGuarded, getPadSteps } = await import('../js/projectCreatorModel.js');

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
        assert.ok(anim.tier === 'legacy' || anim.tier === 'rgb', `Animation ${key} must have tier legacy or rgb`);
    }

    // Specific category checks
    assert.equal(animations['fade_red'].category, 'basic');
    assert.equal(animations['hold_red'].category, 'basic');
    assert.equal(animations['matrix_rain_red'].category, 'special');
    assert.equal(animations['strobe_burst_red'].category, 'special');
    assert.equal(animations['wave_red'].category, 'geometric');
    assert.equal(animations['arrow_up_red'].category, 'directional');
    assert.equal(animations['wave_multi_red_to_green'].category, 'multicolor');
    assert.equal(animations['fade_red'].tier, 'legacy');
    assert.equal(animations['fade_blue'].tier, 'rgb');
    assert.equal(animations['fade_cyan'].tier, 'rgb');
    assert.equal(animations['fade_purple'].tier, 'rgb');
    assert.equal(animations['fade_pink'].tier, 'rgb');
    assert.equal(animations['fade_white'].tier, 'rgb');
});

test('pad source provider correctly routes pad presses and releases', () => {
    assert.equal(getPadSource(), null, 'Default pad source should be null');

    let pressedPad = null;
    let configQueried = false;

    const mockProvider = {
        getPadPlayback: (_index) => {
            configQueried = true;
            return {
                step: { soundUrl: null, buffer: null, light: 'fade_red', syncToSound: false, duration: 1.0 },
                stepIndex: 0,
                totalSteps: 1,
                soundKey: 'mock:7',
                counterKey: null
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
    assert.equal(configQueried, true, 'getPadPlayback should be queried on pad press');

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

test('creator sample token logic rejects superseded or canceled audio decodes', async () => {
    const page = createProjectPage(1);
    const targetIndex = 5;
    const step = () => getPadSteps(page, targetIndex)[0];

    let resolveSlow = null;
    let resolveFast = null;

    const slowDecode = new Promise(resolve => { resolveSlow = resolve; });
    const fastDecode = new Promise(resolve => { resolveFast = resolve; });

    // First assignment starts (slow)
    const p1 = assignPadStepSample(page, targetIndex, 0, { name: 'slow.wav' }, () => slowDecode);
    // Second assignment starts immediately after (fast)
    const p2 = assignPadStepSample(page, targetIndex, 0, { name: 'fast.wav' }, () => fastDecode);

    // Fast resolves first
    resolveFast('fastBuffer');
    const res2 = await p2;
    assert.equal(res2, 'assigned');
    assert.equal(step().sample.name, 'fast.wav');
    assert.equal(step().buffer, 'fastBuffer');

    // Slow resolves late (superseded)
    resolveSlow('slowBuffer');
    const res1 = await p1;
    assert.equal(res1, 'superseded', 'Superseded assignment must return superseded');
    assert.equal(step().sample.name, 'fast.wav');
    assert.equal(step().buffer, 'fastBuffer');

    // User removes sample while another decode is in-flight
    let resolveLate = null;
    const lateDecode = new Promise(resolve => { resolveLate = resolve; });
    const p3 = assignPadStepSample(page, targetIndex, 0, { name: 'cancelled.wav' }, () => lateDecode);

    removePadStepSample(page, targetIndex, 0);
    assert.equal(step().sample, null);
    assert.equal(step().buffer, null);

    // Late decode resolves after removal
    resolveLate('cancelledBuffer');
    const res3 = await p3;
    assert.equal(res3, 'superseded', 'Decode after removal must return superseded');
    assert.equal(step().sample, null);
    assert.equal(step().buffer, null);

    // Corrupt file decoding failure leaves previous valid sample intact
    step().sample = { name: 'good.wav' };
    step().buffer = 'goodBuffer';

    const failDecode = Promise.reject(new Error('Corrupt file'));
    const pFail = await assignPadStepSample(page, targetIndex, 0, { name: 'corrupted.wav' }, () => failDecode);
    assert.equal(pFail, 'failed', 'Decode failure must return failed');
    assert.equal(step().sample.name, 'good.wav', 'Previous sample must remain intact on decode error');
    assert.equal(step().buffer, 'goodBuffer', 'Previous buffer must remain intact on decode error');
});

test('setWebColor sets dataset.ledColor and --led-level for monotonic white LED steps and clears on off', () => {
    setWebModel('mk3'); // RGB mode

    // 1. Full brightness (level 1.0)
    setWebColor('white', [0, 0], 1.0);
    assert.equal(dummyPads[0].dataset.ledColor, 'white');
    assert.equal(dummyPads[0].style['--led-level'], '1');
    assert.equal(dummyPads[0].style['--led-color'], webColorMap.white.baseColor);

    // 2. Medium brightness (level 0.65)
    setWebColor('white', [0, 0], 0.65);
    assert.equal(dummyPads[0].dataset.ledColor, 'white');
    assert.equal(dummyPads[0].style['--led-level'], '0.65');
    assert.equal(dummyPads[0].style['--led-color'], webColorMap.white.baseColor);

    // 3. Low brightness (level 0.35)
    setWebColor('white', [0, 0], 0.35);
    assert.equal(dummyPads[0].dataset.ledColor, 'white');
    assert.equal(dummyPads[0].style['--led-level'], '0.35');
    assert.equal(dummyPads[0].style['--led-color'], webColorMap.white.baseColor);

    // 4. Non-white color (should NOT be tagged with data-led-color="white")
    setWebColor('hsl(120, 100%, 50%)', [0, 0], 1.0);
    assert.equal(dummyPads[0].dataset.ledColor, undefined);
    assert.equal(dummyPads[0].style['--led-level'], '1');
    assert.equal(dummyPads[0].style['--led-color'], 'hsl(120, 100%, 50%)');

    // 5. Off state via 'off'
    setWebColor('off', [0, 0]);
    assert.equal(dummyPads[0].dataset.ledColor, undefined);
    assert.equal(dummyPads[0].style['--led-level'], undefined);
    assert.equal(dummyPads[0].style['--led-color'], undefined);

    // 6. Off state via level 0
    setWebColor('white', [0, 0], 0);
    assert.equal(dummyPads[0].dataset.ledColor, undefined);
    assert.equal(dummyPads[0].style['--led-level'], undefined);
    assert.equal(dummyPads[0].style['--led-color'], undefined);
});

test('digital Launchpad faithfully maps RGB colors to legacy bicolor on Classic skin or hardware', () => {
    setWebModel('classic'); // Legacy mode active
    assert.equal(isLegacyModeActive(), true);

    assert.equal(getEffectiveWebColorName('blue'), 'green');
    assert.equal(getEffectiveWebColorName('cyan'), 'green');
    assert.equal(getEffectiveWebColorName('purple'), 'red');
    assert.equal(getEffectiveWebColorName('pink'), 'red');
    assert.equal(getEffectiveWebColorName('white'), 'amber');
    assert.equal(getEffectiveWebColorName('red'), 'red');
    assert.equal(getEffectiveWebColorName('green'), 'green');

    assert.equal(getWebColor('blue').baseColor, webColorMap.green.baseColor);
    assert.equal(getWebColor('white').baseColor, webColorMap.amber.baseColor);

    // When setting blue on legacy, it appears green on the digital pad
    setWebColor('blue', [0, 0], 1.0);
    assert.equal(dummyPads[0].style['--led-color'], webColorMap.green.baseColor);

    // When setting white on legacy, it appears amber and is not tagged as white LED
    setWebColor('white', [0, 0], 1.0);
    assert.equal(dummyPads[0].style['--led-color'], webColorMap.amber.baseColor);
    assert.equal(dummyPads[0].dataset.ledColor, undefined);

    // Switch back to modern MK3 model
    setWebModel('mk3');
    assert.equal(isLegacyModeActive(), false);
    assert.equal(getEffectiveWebColorName('blue'), 'blue');
    assert.equal(getEffectiveWebColorName('white'), 'white');
    assert.equal(getWebColor('blue').baseColor, webColorMap.blue.baseColor);
    setWebColor('blue', [0, 0], 1.0);
    assert.equal(dummyPads[0].style['--led-color'], webColorMap.blue.baseColor);
});

test('setDeviceProfile updates active profile and dispatches deviceprofilechange event', () => {
    let receivedEvent = null;
    globalThis.window.dispatchEvent = (evt) => { receivedEvent = evt; };
    const mockProfile = { name: 'Launchpad X', type: 'rgb' };
    setDeviceProfile(mockProfile);
    assert.equal(getActiveDeviceProfile(), mockProfile);
    assert.equal(receivedEvent?.type, 'deviceprofilechange');
    assert.equal(receivedEvent?.detail?.profile, mockProfile);

    setDeviceProfile(null);
    assert.equal(getActiveDeviceProfile(), null);
    assert.equal(receivedEvent?.detail?.profile, null);
});

test('assignSampleGuarded discards decode results if the active draft changed during decoding', async () => {
    const draftA = createDraft('Draft A');
    const draftB = createDraft('Draft B');
    const page = draftA.pages[0];

    let activeDraft = draftA;
    let resolveDecode = null;
    const decodePromise = new Promise(resolve => { resolveDecode = resolve; });

    const assignment = assignSampleGuarded({
        targetDraft: draftA,
        page,
        padIndex: 0,
        stepIndex: 0,
        file: { name: 'delayed.wav' },
        decoder: () => decodePromise,
        getActiveDraft: () => activeDraft
    });

    // While decode is in-flight, the user switches to Draft B
    activeDraft = draftB;

    // Decode finishes late for Draft A
    resolveDecode('decodedAudioBuffer');
    const status = await assignment;

    assert.equal(status, 'stale', 'Stale draft must be reported as stale');

    // Draft B must remain pristine (never mutated by Draft A's late decode)
    assert.equal(draftB.changeCount, 0, 'New draft changeCount must not increment');
    assert.equal(getPadSteps(draftB.pages[0], 0)[0].sample, null, 'New draft pad 0 must not receive sample');
    assert.equal(getPadSteps(draftB.pages[0], 0)[0].buffer, null, 'New draft pad 0 must not receive buffer');

    // Draft A must not be flagged modified either
    assert.equal(draftA.changeCount, 0, 'Stale draft changeCount must not be incremented');
});
