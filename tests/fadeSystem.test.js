/**
 * Behaviour of the LED fade engine (animationEngine.fader) on the virtual
 * Launchpad: phases by thirds, instant and multi-colour modes, restarts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs } from './helpers/browserStubs.js';

const { launchpad } = installBrowserStubs();
let clock = 0;
globalThis.performance = { now: () => clock };

const { fader } = await import('../js/animationEngine.js');
const { LED_LEVELS } = await import('../js/webInterface.js');

const pad = (x, y) => launchpad.pads[y * 8 + x];
const level = (x, y) => Number(pad(x, y).style['--led-level'] ?? 0);
const isLit = (x, y) => pad(x, y).classList.contains('active');

function run(times) {
    for (const t of times) {
        clock = t;
        fader.update(t);
    }
}

test.beforeEach(() => {
    clock = 0;
    fader.update(1e9); // finish anything left over
});

test('a standard fade steps full -> medium -> low by thirds, then turns the pad off', () => {
    fader.add([0, 0], 'red', 300);
    const seen = [];
    for (const t of [0, 99, 100, 199, 200, 299]) {
        run([t]);
        seen.push(level(0, 0));
    }
    assert.deepEqual(seen, [LED_LEVELS.full, LED_LEVELS.full, LED_LEVELS.medium, LED_LEVELS.medium, LED_LEVELS.low, LED_LEVELS.low]);

    run([300]);
    assert.equal(isLit(0, 0), false);
    assert.equal(fader.activeFades.size, 0, 'the finished fade is released');
});

test('an instant fade stays at full brightness for its whole duration', () => {
    fader.add([1, 0], 'green', 300, 'instant');
    run([0, 150, 299]);
    assert.equal(level(1, 0), LED_LEVELS.full);
    run([300]);
    assert.equal(isLit(1, 0), false);
});

test('a multi-colour fade shows one colour per third', () => {
    const config = { sequence: [{ color: 'red', level: 'full' }, { color: 'amber', level: 'medium' }, { color: 'green', level: 'low' }] };
    fader.add([2, 0], null, 300, 'multi', config);
    const colors = [];
    for (const t of [0, 150, 250]) {
        run([t]);
        colors.push(pad(2, 0).style['--led-color']);
    }
    assert.equal(new Set(colors).size, 3, 'three different colours');
    run([300]);
    assert.equal(isLit(2, 0), false);
});

test('adding a fade to a lit pad restarts it instead of stacking', () => {
    fader.add([3, 0], 'red', 300);
    run([0, 250]);
    assert.equal(level(3, 0), LED_LEVELS.low);

    clock = 250;
    fader.add([3, 0], 'red', 300);
    run([251]);
    assert.equal(level(3, 0), LED_LEVELS.full, 'back to full brightness');
    assert.equal(fader.activeFades.size, 1);
});

test('"off" clears the pad at once and unknown colours are dropped', () => {
    fader.add([4, 0], 'red', 300);
    run([0]);
    fader.add([4, 0], 'off', 300);
    run([1]);
    assert.equal(isLit(4, 0), false);

    fader.add([5, 0], 'no-such-color', 300);
    run([2]);
    assert.equal(isLit(5, 0), false);
    assert.equal(fader.activeFades.size, 0);
});
