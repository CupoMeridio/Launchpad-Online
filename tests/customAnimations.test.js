/**
 * Playback of custom (user-drawn) animations on the virtual Launchpad:
 * once/hold behaviour, scaling, restarts, project/draft scopes, durations and
 * the full path from a pad press.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs } from './helpers/browserStubs.js';

const { launchpad } = installBrowserStubs();
let clock = 0;
globalThis.performance = { now: () => clock };

const { fader, activeAnimations, scheduler } = await import('../js/animationEngine.js');
const { animations, triggerAnimation, releaseAnimation, resolveStepLightDuration } = await import('../js/lights.js');
const { setCustomAnimations, getCustomAnimationDuration } = await import('../js/customAnimations.js');
const { LED_LEVELS } = await import('../js/webInterface.js');
const { buildAnimationCatalog } = await import('../js/projectCreatorModel.js');

/** Advances the animation loop to time `t`, in the same order as lights.js. */
function tick(t) {
    clock = t;
    scheduler.update(t);
    fader.update(t);
    for (const anim of activeAnimations) {
        if (anim.update(t)) activeAnimations.delete(anim);
    }
}

const pad = (x, y) => launchpad.pads[y * 8 + x];
const isLit = (x, y) => pad(x, y).classList.contains('active');
const level = (x, y) => Number(pad(x, y).style['--led-level'] ?? 0);

const RED = { color: 'red', level: 'full' };
const GREEN_LOW = { color: 'green', level: 'low' };

/** Two frames of 100 ms: (0,0) red, then (1,0) dim green. */
const TWO_FRAMES = {
    id: 'two',
    name: 'Two frames',
    playback: 'once',
    frames: [{ duration: 100, pads: { '0,0': RED } }, { duration: 100, pads: { '1,0': GREEN_LOW } }]
};

test.beforeEach(() => {
    tick(clock + 1e7); // let everything finish
    activeAnimations.clear();
    setCustomAnimations('draft', []);
    setCustomAnimations('project', []);
    clock = 0;
});

test('a once animation plays its frames at natural speed, then turns everything off', () => {
    setCustomAnimations('project', [TWO_FRAMES]);
    triggerAnimation('custom:two', 0, 0);

    assert.equal(isLit(0, 0), true, 'frame 1 lights immediately');
    assert.equal(isLit(1, 0), false);

    tick(100);
    assert.equal(isLit(0, 0), false);
    assert.equal(isLit(1, 0), true);
    assert.equal(level(1, 0), LED_LEVELS.low, 'cells keep their level');

    tick(200);
    assert.equal(isLit(1, 0), false);
    assert.equal(activeAnimations.size, 0, 'the playback ends');
});

test('a requested duration stretches the animation, keeping proportions', () => {
    setCustomAnimations('project', [TWO_FRAMES]);
    triggerAnimation('custom:two', 0, 0, 1); // 1 s instead of 200 ms

    tick(400);
    assert.equal(isLit(0, 0), true, 'frame 1 now lasts 500 ms');
    tick(600);
    assert.equal(isLit(0, 0), false);
    assert.equal(isLit(1, 0), true);
    tick(1000);
    assert.equal(isLit(1, 0), false);
});

test('a hold drawing stays lit while held and turns off on release', () => {
    setCustomAnimations('project', [{ id: 'logo', playback: 'hold', frames: [{ duration: 100, pads: { '3,3': RED, '4,4': RED } }] }]);
    assert.equal(animations['custom:logo'].type, 'momentary');

    triggerAnimation('custom:logo', 0, 0);
    tick(5000);
    assert.equal(isLit(3, 3) && isLit(4, 4), true, 'still lit long after one frame');

    releaseAnimation('custom:logo', 0, 0);
    tick(5001);
    assert.equal(isLit(3, 3) || isLit(4, 4), false);
});

test('a hold animation with several frames loops until released', () => {
    setCustomAnimations('project', [{ ...TWO_FRAMES, id: 'blink', playback: 'hold' }]);
    triggerAnimation('custom:blink', 0, 0);

    tick(250); // second cycle, first frame
    assert.equal(isLit(0, 0), true);
    assert.equal(isLit(1, 0), false);
    tick(350); // second cycle, second frame
    assert.equal(isLit(1, 0), true);

    releaseAnimation('custom:blink', 0, 0);
    tick(351);
    assert.equal(isLit(0, 0) || isLit(1, 0), false);
});

test('pressing the pad again restarts the animation', () => {
    setCustomAnimations('project', [TWO_FRAMES]);
    triggerAnimation('custom:two', 0, 0);
    tick(150);
    assert.equal(isLit(1, 0), true);

    triggerAnimation('custom:two', 0, 0);
    tick(151);
    assert.equal(isLit(0, 0), true, 'back to frame 1');
    assert.equal(isLit(1, 0), false, 'frame 2 of the previous run is cleared');
    assert.equal(activeAnimations.size, 1, 'only one playback per pad');
});

test('removing an animation stops its running instances and its preview', async () => {
    const { previewCustomAnimation } = await import('../js/customAnimations.js');
    const longHold = { id: 'long', playback: 'hold', frames: [{ duration: 100, pads: { '2,2': RED } }] };
    setCustomAnimations('draft', [longHold, TWO_FRAMES]);
    triggerAnimation('custom:long', 0, 0);
    assert.equal(previewCustomAnimation('two'), 200);
    tick(50);
    assert.equal(isLit(2, 2) && isLit(0, 0), true);

    setCustomAnimations('draft', []); // e.g. both deleted in the Studio
    tick(51);
    assert.equal(isLit(2, 2) || isLit(0, 0), false, 'no pad stays lit');
    assert.equal(animations['custom:long'], undefined);
});

test('the Studio draft overrides the project while editing', () => {
    setCustomAnimations('project', [{ id: 'a', playback: 'once', frames: [{ duration: 100, pads: { '0,0': RED } }] }]);
    setCustomAnimations('draft', [{ id: 'a', playback: 'once', frames: [{ duration: 100, pads: { '5,5': RED } }] }]);

    triggerAnimation('custom:a', 0, 0);
    assert.equal(isLit(5, 5), true, 'the draft version plays');
    assert.equal(isLit(0, 0), false);

    tick(1000);
    setCustomAnimations('draft', []);
    triggerAnimation('custom:a', 0, 0);
    assert.equal(isLit(0, 0), true, 'the project version is back when the draft is cleared');

    setCustomAnimations('project', []);
    assert.equal(animations['custom:a'], undefined, 'unregistered when no scope defines it');
});

test('step light duration: synced sound, else natural length (custom) or manual (built-in)', () => {
    setCustomAnimations('project', [TWO_FRAMES]);
    const custom = { light: 'custom:two', syncToSound: true, duration: 2.5 };
    assert.equal(getCustomAnimationDuration('custom:two'), 0.2);
    assert.equal(resolveStepLightDuration(custom, 1.5), 1.5, 'synced to the sound');
    assert.equal(resolveStepLightDuration(custom, 0), 0.2, 'no sound: natural length, not the manual one');
    assert.equal(resolveStepLightDuration({ ...custom, syncToSound: false }, 1.5), 0.2);
    assert.equal(resolveStepLightDuration({ light: 'fade_red', syncToSound: false, duration: 2.5 }, 1.5), 2.5);
    assert.equal(getCustomAnimationDuration('fade_red'), null);
});

test('custom animations are not mixed into the built-in catalog', () => {
    setCustomAnimations('project', [TWO_FRAMES]);
    const groups = buildAnimationCatalog(animations);
    assert.ok(groups.length > 10);
    assert.equal(groups.some(group => group.variants.some(variant => variant.animation?.startsWith('custom:'))), false);
});

test('pressing a pad plays its custom light synced to the sample', async (t) => {
    const { commitProject, setCurrentPage } = await import('../js/projectState.js');
    const { normalizeProjectData } = await import('../js/projectModel.js');
    const { triggerPad, releasePad, setPadSource } = await import('../js/interaction.js');
    const { audioEngine } = await import('../js/audio.js');

    const lights = Array.from({ length: 64 }, () => []);
    const sounds = Array.from({ length: 64 }, () => []);
    lights[9] = ['custom:two'];
    sounds[9] = ['kick.wav'];
    const runtime = normalizeProjectData({ id: 'p', name: 'P', pages: [{ name: 'A', sounds, lights }], animations: [TWO_FRAMES] });
    runtime.pages[0][9][0].buffer = { duration: 1 };
    commitProject(runtime);
    setCurrentPage(0);
    setCustomAnimations('project', runtime.animations);
    setPadSource(null);

    const original = audioEngine.playBuffer;
    audioEngine.playBuffer = (buffer) => buffer.duration; // a 1 s sample
    t.after(() => { audioEngine.playBuffer = original; });

    triggerPad(9);
    releasePad(9);
    tick(400);
    assert.equal(isLit(0, 0), true, 'stretched to the 1 s sample: frame 1 lasts 500 ms');
    tick(600);
    assert.equal(isLit(1, 0), true);
});

test('a press the pad source ignores (frame painting) keeps the pad LED on release', async (t) => {
    const { triggerPad, releasePad, setPadSource } = await import('../js/interaction.js');
    const { setWebColor } = await import('../js/webInterface.js');
    const painted = [];
    setPadSource({
        getPadPlayback: () => null,
        onPadPress: (index) => {
            painted.push(index);
            setWebColor('red', [index % 8, Math.floor(index / 8)], 'full');
        }
    });
    t.after(() => setPadSource(null));

    triggerPad(3);
    releasePad(3);
    assert.deepEqual(painted, [3]);
    assert.equal(isLit(3, 0), true, 'the painted LED survives the release');
});
