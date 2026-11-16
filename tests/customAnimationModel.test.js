import assert from 'node:assert/strict';
import test from 'node:test';
import {
    customLightName,
    parseCustomLightName,
    padKey,
    parsePadKey,
    createCustomAnimation,
    createCustomAnimationId,
    normalizeCustomAnimation,
    normalizeCustomAnimations,
    compileCustomAnimation,
    scaleCompiledEvents,
    usesRgbOnlyColors,
    MIN_FRAME_DURATION_MS,
    MAX_FRAME_DURATION_MS,
    DEFAULT_FRAME_DURATION_MS,
    setFrameCell,
    floodFillFrame,
    transformFramePads,
    FRAME_TRANSFORMS,
    getShortestFrameMs,
    getCustomAnimationColors
} from '../js/customAnimationModel.js';

const RED = { color: 'red', level: 'full' };
const RED_LOW = { color: 'red', level: 'low' };
const GREEN = { color: 'green', level: 'full' };

test('light names and pad keys', () => {
    assert.equal(customLightName('anim-1'), 'custom:anim-1');
    assert.equal(parseCustomLightName('custom:anim-1'), 'anim-1');
    assert.equal(parseCustomLightName('fade_red'), null);
    assert.equal(parseCustomLightName(null), null);

    assert.equal(padKey(3, 7), '3,7');
    assert.deepEqual(parsePadKey('3,7'), [3, 7]);
    assert.equal(parsePadKey('8,0'), null, 'off the grid');
    assert.equal(parsePadKey('a,b'), null);
});

test('new animations start with one empty frame and get unique ids', () => {
    assert.deepEqual(createCustomAnimation({ id: 'anim-1', name: 'Intro' }), {
        id: 'anim-1', name: 'Intro', playback: 'once', frames: [{ duration: DEFAULT_FRAME_DURATION_MS, pads: {} }]
    });
    assert.equal(createCustomAnimationId([]), 'anim-1');
    assert.equal(createCustomAnimationId(['anim-1', 'anim-3']), 'anim-2');
});

test('normalization fills defaults and drops invalid cells', () => {
    const animation = normalizeCustomAnimation({
        id: 'a',
        playback: 'loop?',
        frames: [{
            duration: 1,
            pads: { '0,0': { color: 'red' }, '9,9': RED, '1,1': { color: 'no-such-colour' }, '2,2': { color: 'green', level: 'dim' } }
        }, { duration: 999999, pads: {} }]
    });
    assert.equal(animation.playback, 'once');
    assert.equal(animation.name, '');
    assert.equal(animation.frames[0].duration, MIN_FRAME_DURATION_MS, 'durations are clamped');
    assert.equal(animation.frames[1].duration, MAX_FRAME_DURATION_MS);
    assert.deepEqual(animation.frames[0].pads, { '0,0': RED, '2,2': GREEN }, 'level defaults to full; bad keys/colours dropped');

    assert.deepEqual(normalizeCustomAnimations(undefined), []);
    assert.equal(normalizeCustomAnimation({ id: 'b', frames: [] }).frames.length, 1, 'never without frames');
});

test('compilation emits one event per pad and run of the same colour', () => {
    const { events, duration } = compileCustomAnimation({
        frames: [
            { duration: 100, pads: { '0,0': RED, '1,0': RED } },
            { duration: 50, pads: { '0,0': RED, '1,0': GREEN } },   // 0,0 unchanged; 1,0 changes colour
            { duration: 200, pads: { '0,0': RED_LOW } }              // 0,0 changes level; 1,0 turns off
        ]
    });
    assert.equal(duration, 350);
    assert.deepEqual(events, [
        { p: [0, 0], time: 0, dur: 150, color: 'red', level: 'full' },
        { p: [1, 0], time: 0, dur: 100, color: 'red', level: 'full' },
        { p: [1, 0], time: 100, dur: 50, color: 'green', level: 'full' },
        { p: [0, 0], time: 150, dur: 200, color: 'red', level: 'low' }
    ]);
});

test('a single frame compiles to steady lights for its duration; empty frames are pauses', () => {
    assert.deepEqual(compileCustomAnimation({ frames: [{ duration: 400, pads: { '7,7': GREEN } }] }), {
        events: [{ p: [7, 7], time: 0, dur: 400, color: 'green', level: 'full' }],
        duration: 400
    });
    const withPause = compileCustomAnimation({
        frames: [{ duration: 100, pads: { '0,0': RED } }, { duration: 100, pads: {} }, { duration: 100, pads: { '0,0': RED } }]
    });
    assert.deepEqual(withPause.events.map(e => [e.time, e.dur]), [[0, 100], [200, 100]]);
});

test('scaling keeps the proportions between frames', () => {
    const compiled = compileCustomAnimation({
        frames: [{ duration: 100, pads: { '0,0': RED } }, { duration: 300, pads: { '1,1': GREEN } }]
    });
    const stretched = scaleCompiledEvents(compiled, 800);
    assert.deepEqual(stretched.map(e => [e.time, e.dur]), [[0, 200], [200, 600]]);
    assert.equal(scaleCompiledEvents(compiled, 0), compiled.events, 'no target: natural speed');
    assert.equal(scaleCompiledEvents(compiled, 400), compiled.events, 'already the right length');
});

test('RGB-only colours are detected inside frames', () => {
    assert.equal(usesRgbOnlyColors({ frames: [{ duration: 100, pads: { '0,0': RED } }] }), false);
    assert.equal(usesRgbOnlyColors({ frames: [{ duration: 100, pads: {} }, { duration: 100, pads: { '0,0': { color: 'blue', level: 'full' } } }] }), true);
});

const BLUE = { color: 'blue', level: 'full' };
const keys = pads => Object.keys(pads).sort();

test('setting a cell never toggles: same cell is a no-op, null turns it off', () => {
    const frame = { duration: 100, pads: {} };
    assert.equal(setFrameCell(frame, 1, 1, RED), true);
    assert.equal(setFrameCell(frame, 1, 1, RED), false, 'already red: unchanged, not toggled off');
    assert.equal(setFrameCell(frame, 1, 1, BLUE), true);
    assert.deepEqual(frame.pads['1,1'], BLUE);
    assert.equal(setFrameCell(frame, 1, 1, null), true);
    assert.equal(setFrameCell(frame, 1, 1, null), false);
});

test('flood fill paints the connected region of identical pads only', () => {
    // A red vertical wall at x = 3 splits the grid into two off regions.
    const pads = {};
    for (let y = 0; y < 8; y++) pads[padKey(3, y)] = { ...RED };
    const frame = { duration: 100, pads };

    assert.equal(floodFillFrame(frame, 0, 0, BLUE), true);
    const blue = Object.entries(frame.pads).filter(([, cell]) => cell.color === 'blue').map(([key]) => key);
    assert.equal(blue.length, 24, 'the 3 x 8 region left of the wall');
    assert.ok(blue.every(key => Number(key.split(',')[0]) < 3));
    assert.equal(frame.pads['5,5'], undefined, 'the other side of the wall is untouched');

    assert.equal(floodFillFrame(frame, 3, 4, null), true, 'erasing the wall region');
    assert.equal(Object.values(frame.pads).some(cell => cell.color === 'red'), false);
    assert.equal(floodFillFrame(frame, 7, 7, null), false, 'filling off with off changes nothing');
});

test('transforms move, mirror and rotate the drawing; shifts wrap around', () => {
    const pads = { '0,0': RED, '7,3': BLUE };
    assert.deepEqual(keys(transformFramePads(pads, 'shiftLeft')), ['6,3', '7,0']);
    assert.deepEqual(keys(transformFramePads(pads, 'shiftDown')), ['0,1', '7,4']);
    assert.deepEqual(keys(transformFramePads(pads, 'flipHorizontal')), ['0,3', '7,0']);
    assert.deepEqual(keys(transformFramePads(pads, 'flipVertical')), ['0,7', '7,4']);
    assert.deepEqual(transformFramePads(pads, 'rotateClockwise')['7,0'], RED, 'top-left goes top-right');
    assert.equal(transformFramePads(pads, 'nope'), null);

    // Inverse pairs and full cycles give the drawing back.
    let rotated = pads;
    for (let i = 0; i < 4; i++) rotated = transformFramePads(rotated, 'rotateClockwise');
    assert.deepEqual(rotated, pads);
    assert.deepEqual(transformFramePads(transformFramePads(pads, 'rotateClockwise'), 'rotateCounterClockwise'), pads);
    let shifted = pads;
    for (let i = 0; i < 8; i++) shifted = transformFramePads(shifted, 'shiftRight');
    assert.deepEqual(shifted, pads);
    assert.equal(Object.keys(FRAME_TRANSFORMS).length, 8);

    const copy = transformFramePads(pads, 'flipVertical');
    copy['0,7'].color = 'green';
    assert.equal(pads['0,0'].color, 'red', 'cells are copied');
});

test('shortest frame accounts for stretching to a target duration', () => {
    const animation = createCustomAnimation({ id: 'a' });
    animation.frames = [{ duration: 100, pads: {} }, { duration: 300, pads: {} }];
    assert.equal(getShortestFrameMs(animation), 100);
    assert.equal(getShortestFrameMs(animation, 200), 50, 'compressed to half');
    assert.equal(getShortestFrameMs(animation, 800), 200, 'stretched to double');
});

test('animation colours are ordered by how visible they are, not by drawing order', () => {
    const cells = (color, count) => Object.fromEntries(Array.from({ length: count }, (_, x) => [padKey(x, 0), { color, level: 'full' }]));
    const animation = createCustomAnimation({ id: 'a' });
    animation.frames = [
        { duration: 100, pads: { ...cells('red', 1), '0,1': { color: 'blue', level: 'low' }, '1,1': { color: 'blue', level: 'low' } } },
        { duration: 500, pads: cells('green', 1) },
        { duration: 100, pads: cells('blue', 3) }
    ];
    // red 1x100 = 100, blue 2x100 + 3x100 = 500, green 1x500 = 500
    assert.deepEqual(getCustomAnimationColors(animation), ['blue', 'green', 'red'],
        'drawn first, red is still last; blue and green tie and keep their order of appearance');

    animation.frames[0].pads = { ...cells('red', 8) }; // red 800 now dominates
    assert.equal(getCustomAnimationColors(animation)[0], 'red');
    assert.deepEqual(getCustomAnimationColors(createCustomAnimation({ id: 'empty' })), []);
});
