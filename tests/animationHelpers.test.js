import assert from 'node:assert/strict';
import test from 'node:test';

import {
    maxCornerDistance,
    buildCrossEvents,
    buildReverseCrossEvents,
    buildWaveEvents
} from '../js/animationClasses.js';
import {
    buildRainEvents,
    buildScanlineEvents
} from '../js/animations/directional.js';
import {
    buildSquareExpansionEvents,
    buildSpiralEvents
} from '../js/animations/geometric.js';
import {
    buildSnakeEvents,
    buildWarpSpeedEvents
} from '../js/animations/special.js';

test('maxCornerDistance accurately calculates greatest Euclidean corner distance with 4-way symmetry', () => {
    const cornerExpected = Math.sqrt(7 * 7 + 7 * 7); // ~9.8995
    assert.equal(maxCornerDistance(0, 0), cornerExpected);
    assert.equal(maxCornerDistance(7, 0), cornerExpected);
    assert.equal(maxCornerDistance(0, 7), cornerExpected);
    assert.equal(maxCornerDistance(7, 7), cornerExpected);

    const centerExpected = Math.sqrt(4 * 4 + 4 * 4); // ~5.6569
    assert.equal(maxCornerDistance(3, 3), centerExpected);
    assert.equal(maxCornerDistance(3, 4), centerExpected);
    assert.equal(maxCornerDistance(4, 3), centerExpected);
    assert.equal(maxCornerDistance(4, 4), centerExpected);

    // 4-way reflective symmetry across the whole 8x8 grid
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const base = maxCornerDistance(x, y);
            assert.equal(maxCornerDistance(7 - x, y), base);
            assert.equal(maxCornerDistance(x, 7 - y), base);
            assert.equal(maxCornerDistance(7 - x, 7 - y), base);
        }
    }
});

test('buildCrossEvents generates expanding cross within 8x8 bounds with correct delays', () => {
    const stepDelay = 60;
    const fadeDuration = 120;

    // Corner (0,0): only +x and +y directions are within bounds
    const cornerEvents = buildCrossEvents(0, 0, stepDelay, fadeDuration);
    // Center point + 7 steps * 2 valid directions = 15 events
    assert.equal(cornerEvents.length, 15);
    assert.deepEqual(cornerEvents[0], { p: [0, 0], time: 0, dur: fadeDuration });
    for (const ev of cornerEvents) {
        assert.ok(ev.p[0] >= 0 && ev.p[0] < 8);
        assert.ok(ev.p[1] >= 0 && ev.p[1] < 8);
        assert.equal(ev.dur, fadeDuration);
    }

    // Center (3,3): all 4 directions valid up to dist = 3
    const centerEvents = buildCrossEvents(3, 3, stepDelay, fadeDuration);
    assert.deepEqual(centerEvents[0], { p: [3, 3], time: 0, dur: fadeDuration });
    const dist1Events = centerEvents.filter(e => e.time === stepDelay);
    assert.equal(dist1Events.length, 4);
    assert.deepEqual(dist1Events.map(e => e.p), [[4, 3], [2, 3], [3, 4], [3, 2]]);
});

test('buildReverseCrossEvents contracts onto the target pad with correct inverse timing', () => {
    const stepDelay = 50;
    const fadeDuration = 100;

    // Center (3,3): maxDist = Math.max(3, 4, 3, 4) = 4
    const centerEvents = buildReverseCrossEvents(3, 3, stepDelay, fadeDuration);
    // The final event must be the target pad at (maxDist - 0) * stepDelay = 200ms
    const lastEvent = centerEvents[centerEvents.length - 1];
    assert.deepEqual(lastEvent, { p: [3, 3], time: 4 * stepDelay, dur: fadeDuration });

    // Every event must be on the board
    for (const ev of centerEvents) {
        assert.ok(ev.p[0] >= 0 && ev.p[0] < 8);
        assert.ok(ev.p[1] >= 0 && ev.p[1] < 8);
        assert.equal(ev.dur, fadeDuration);
    }
});

test('buildWaveEvents produces exactly 64 events and respects forward, reverse, and center geometries', () => {
    const stepDelay = 40;
    const fadeDuration = 80;

    // Forward wave from (0,0)
    const forwardEvents = buildWaveEvents(0, 0, stepDelay, fadeDuration);
    assert.equal(forwardEvents.length, 64);
    const origin = forwardEvents.find(e => e.p[0] === 0 && e.p[1] === 0);
    assert.equal(origin.time, 0);
    const farCorner = forwardEvents.find(e => e.p[0] === 7 && e.p[1] === 7);
    assert.equal(farCorner.time, Math.hypot(7, 7) * stepDelay);

    // Reverse wave from (0,0)
    const maxDist = maxCornerDistance(0, 0);
    const reverseEvents = buildWaveEvents(0, 0, stepDelay, fadeDuration, true, maxDist);
    assert.equal(reverseEvents.length, 64);
    const revOrigin = reverseEvents.find(e => e.p[0] === 0 && e.p[1] === 0);
    assert.equal(revOrigin.time, maxDist * stepDelay);
    const revFarCorner = reverseEvents.find(e => e.p[0] === 7 && e.p[1] === 7);
    assert.equal(revFarCorner.time, (maxDist - Math.hypot(7, 7)) * stepDelay);

    // Center wave from (3.5, 3.5): 4 central pads have identical timing
    const centerEvents = buildWaveEvents(3.5, 3.5, stepDelay, fadeDuration);
    assert.equal(centerEvents.length, 64);
    const pad33 = centerEvents.find(e => e.p[0] === 3 && e.p[1] === 3);
    const pad43 = centerEvents.find(e => e.p[0] === 4 && e.p[1] === 3);
    const pad34 = centerEvents.find(e => e.p[0] === 3 && e.p[1] === 4);
    const pad44 = centerEvents.find(e => e.p[0] === 4 && e.p[1] === 4);
    assert.equal(pad33.time, pad43.time);
    assert.equal(pad33.time, pad34.time);
    assert.equal(pad33.time, pad44.time);
});

test('buildRainEvents accurately generates 1D directional sweep stopping at boundaries', () => {
    const downEvents = buildRainEvents(2, 5, 0, 1, 80, 160);
    // From y=5 down to 7: 3 events (y=5, 6, 7)
    assert.equal(downEvents.length, 3);
    assert.deepEqual(downEvents[0], { p: [2, 5], time: 0, dur: 160 });
    assert.deepEqual(downEvents[1], { p: [2, 6], time: 80, dur: 160 });
    assert.deepEqual(downEvents[2], { p: [2, 7], time: 160, dur: 160 });

    const upEvents = buildRainEvents(2, 5, 0, -1, 80, 160);
    // From y=5 up to 0: 6 events (y=5, 4, 3, 2, 1, 0)
    assert.equal(upEvents.length, 6);
    assert.deepEqual(upEvents[upEvents.length - 1], { p: [2, 0], time: 5 * 80, dur: 160 });
});

test('buildScanlineEvents accurately generates vertical, horizontal and bounce sweeps', () => {
    // Vertical forward: 8 columns x 8 rows = 64 events
    const vEvents = buildScanlineEvents('v', '', 800);
    assert.equal(vEvents.length, 64);
    assert.deepEqual(vEvents[0].p, [0, 0]);
    assert.deepEqual(vEvents[63].p, [7, 7]);

    // Horizontal reverse: 8 rows x 8 cols = 64 events, starting at row 7
    const hRevEvents = buildScanlineEvents('h', '_reverse', 800);
    assert.equal(hRevEvents.length, 64);
    assert.deepEqual(hRevEvents[0].p, [0, 7]);
    assert.deepEqual(hRevEvents[63].p, [7, 0]);

    // Bounce: 15 steps (8 forward + 7 reverse) x 8 pads = 120 events
    const vBounceEvents = buildScanlineEvents('v', '_bounce', 800);
    assert.equal(vBounceEvents.length, 120);
});

test('buildSquareExpansionEvents generates concentric squares expanding or contracting', () => {
    const explodeEvents = buildSquareExpansionEvents(3, 3, 70, 140, false);
    // Center point at t=0
    assert.deepEqual(explodeEvents[0], { p: [3, 3], time: 0, dur: 140 });
    // All events within grid bounds
    for (const ev of explodeEvents) {
        assert.ok(ev.p[0] >= 0 && ev.p[0] < 8);
        assert.ok(ev.p[1] >= 0 && ev.p[1] < 8);
    }

    const implodeEvents = buildSquareExpansionEvents(3, 3, 70, 140, true);
    // Contracting finishes at (3, 3) at the final step
    const lastEvent = implodeEvents[implodeEvents.length - 1];
    assert.deepEqual(lastEvent, { p: [3, 3], time: 7 * 70, dur: 140 });
});

test('buildSpiralEvents touches all 64 pads in spiral sequence without duplicates', () => {
    const spiralEvents = buildSpiralEvents(1280);
    assert.equal(spiralEvents.length, 64);
    const seen = new Set(spiralEvents.map(e => `${e.p[0]},${e.p[1]}`));
    assert.equal(seen.size, 64);
});

test('buildSnakeEvents and buildWarpSpeedEvents generate bounded event sequences', () => {
    const snakeEvents = buildSnakeEvents(1000);
    assert.ok(snakeEvents.length > 20);
    for (const ev of snakeEvents) {
        assert.ok(ev.p[0] >= 0 && ev.p[0] < 8);
        assert.ok(ev.p[1] >= 0 && ev.p[1] < 8);
    }

    const warpEvents = buildWarpSpeedEvents(500);
    // 4 centers x 4 steps = 16 events
    assert.equal(warpEvents.length, 16);
    for (const ev of warpEvents) {
        assert.ok(ev.p[0] >= 0 && ev.p[0] < 8);
        assert.ok(ev.p[1] >= 0 && ev.p[1] < 8);
    }
});

