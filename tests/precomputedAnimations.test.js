/**
 * Precomputed animations (a list of timed events played through the fade
 * engine): events may carry their own colour, used by multicolour lights
 * such as the firework and the hearts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs } from './helpers/browserStubs.js';

const { launchpad } = installBrowserStubs();
let clock = 0;
globalThis.performance = { now: () => clock };

const { fader, activeAnimations, scheduler } = await import('../js/animationEngine.js');
const { triggerAnimation } = await import('../js/lights.js');
const { PrecomputedAnimation } = await import('../js/animationClasses.js');
const { webColorMap } = await import('../js/webInterface.js');

/** Advances the animation loop to time `t`, in the same order as lights.js. */
function tick(t) {
    clock = t;
    scheduler.update(t);
    fader.update(t);
    for (const anim of activeAnimations) {
        if (anim.update(t)) activeAnimations.delete(anim);
    }
}

/** Runs the loop frame by frame and returns the pads seen lit, with their colours. */
function play(untilMs) {
    const seen = new Map();
    for (let t = clock; t <= untilMs; t += 16) {
        tick(t);
        launchpad.pads.forEach((pad, index) => {
            if (pad.classList.contains('active')) seen.set(index, pad.style['--led-color']);
        });
    }
    return seen;
}

test.beforeEach(() => {
    tick(clock + 1e7); // let everything finish
    activeAnimations.clear();
    clock = 0;
});

test('events with their own colour light up even when the animation has none', () => {
    activeAnimations.add(new PrecomputedAnimation(null, 300, () => [
        { p: [0, 0], time: 0, dur: 200, color: 'red', mode: 'instant' },
        { p: [1, 0], time: 50, dur: 200, color: 'green', mode: 'instant' }
    ]));
    const seen = play(150);
    assert.equal(seen.get(0), webColorMap.red.baseColor);
    assert.equal(seen.get(1), webColorMap.green.baseColor);
});

// Legacy colours: without an RGB Launchpad the screen maps RGB-only colours to them.
test('an event colour wins over the animation colour; events without one use it', () => {
    activeAnimations.add(new PrecomputedAnimation('green', 300, () => [
        { p: [2, 0], time: 0, dur: 200, mode: 'instant' },
        { p: [3, 0], time: 0, dur: 200, color: 'amber', mode: 'instant' }
    ]));
    const seen = play(100);
    assert.equal(seen.get(2), webColorMap.green.baseColor);
    assert.equal(seen.get(3), webColorMap.amber.baseColor);
});

for (const name of ['firework', 'heart_fill', 'heart_simple', 'heart_wave']) {
    test(`"${name}" lights the Launchpad`, () => {
        triggerAnimation(name, 3, 3, 1.5);
        const seen = play(1500);
        assert.ok(seen.size >= 5, `${name} lit ${seen.size} pads`);
    });
}

for (const [name, colour] of [['heart_fill_amber', 'amber'], ['heart_simple_green', 'green'], ['heart_wave_amber', 'amber'], ['firework_green', 'green']]) {
    test(`"${name}" lights the Launchpad in ${colour} only`, () => {
        triggerAnimation(name, 3, 3, 1.5);
        const colours = new Set(play(1500).values());
        assert.deepEqual([...colours], [webColorMap[colour].baseColor]);
    });
}

test('the former heart names still play their red heart', () => {
    triggerAnimation('heart_simple', 3, 3, 1);
    const seen = play(500);
    assert.ok(seen.size >= 10);
    assert.deepEqual([...new Set(seen.values())], [webColorMap.red.baseColor]);
});
