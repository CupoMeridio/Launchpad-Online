import assert from 'node:assert/strict';
import test from 'node:test';

import {
    maxCornerDistance,
    buildCrossEvents,
    buildReverseCrossEvents,
    buildWaveEvents
} from '../js/animationClasses.js';

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
