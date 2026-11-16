/**
 * Behaviour of the audio visualizer (js/visualizer.js) on recording canvases:
 * which canvas each mode draws on, mirroring, symmetry, bass pulse and the
 * animation loop lifecycle.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const background = { style: { transform: '' } };
let frameRequests = 0;
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = { querySelector: (sel) => (sel === '.background-media' ? background : null) };
globalThis.requestAnimationFrame = () => ++frameRequests;
globalThis.cancelAnimationFrame = () => {};
globalThis.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o?.detail; } };

function recordingCanvas(width = 400, height = 120) {
    const bars = [];
    const ctx = {
        bars,
        clearRect() {},
        fillRect: (x, y, w, h) => bars.push({ x, y, w, h }),
        createLinearGradient: () => ({ addColorStop() {} }),
        fillStyle: null
    };
    return { width: 0, height: 0, ctx, getBoundingClientRect: () => ({ width, height }), getContext: () => ctx };
}

const { Visualizer } = await import('../js/visualizer.js');

/** Loud low frequencies, quiet highs. */
const analyser = {
    frequencyBinCount: 64,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData(arr) { for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, 250 - i * 5); }
};

function drawOnce({ mode, symmetric = false, reverse = false, bass = null }) {
    const top = recordingCanvas();
    const bottom = recordingCanvas();
    const v = new Visualizer(analyser, top, bottom);
    v.mode = mode;
    v.isSymmetric = symmetric;
    v.symmetryReverse = reverse;
    v.bassPulseEnabled = bass !== null;
    if (bass !== null) v.bassThreshold = bass;
    v.draw();
    return { v, top: top.ctx.bars, bottom: bottom.ctx.bars };
}

test('each mode draws on its canvases; bottom bars rise from the bottom edge', () => {
    const top = drawOnce({ mode: 'top' });
    assert.ok(top.top.length > 0);
    assert.equal(top.bottom.length, 0);
    assert.ok(top.top.every(bar => bar.y === 0), 'top bars hang from the top edge');

    const bottom = drawOnce({ mode: 'bottom' });
    assert.equal(bottom.top.length, 0);
    assert.ok(bottom.bottom.every(bar => bar.y + bar.h === 120), 'bottom bars stand on the bottom edge');

    const both = drawOnce({ mode: 'both' });
    assert.equal(both.top.length, both.bottom.length);
});

test('mirrored modes put the low frequencies on the right', () => {
    const plain = drawOnce({ mode: 'bottom' }).bottom;
    const mirrored = drawOnce({ mode: 'bottom-mirror' }).bottom;
    assert.equal(plain.length, mirrored.length);
    assert.ok(plain[0].x < 1, 'the first (loudest) bar starts at the left edge');
    assert.ok(Math.abs(mirrored[0].x + mirrored[0].w - 400) < 1, 'and at the right edge when mirrored');
    assert.equal(mirrored[0].h, plain[0].h);
});

test('symmetric mode draws pairs of equal bars around the centre', () => {
    const { bottom } = drawOnce({ mode: 'bottom', symmetric: true });
    assert.equal(bottom.length % 2, 0);
    for (let i = 0; i < bottom.length; i += 2) {
        const [left, right] = [bottom[i], bottom[i + 1]];
        assert.equal(left.h, right.h);
        assert.ok(Math.abs((left.x + left.w + right.x) / 2 - 200) < 2, 'centred on the canvas middle');
    }
    const centreLoud = bottom[0].h;
    const reversed = drawOnce({ mode: 'bottom', symmetric: true, reverse: true }).bottom;
    assert.ok(reversed[0].h < centreLoud, 'reversed symmetry moves the loud lows to the edges');
});

test('bass pulse scales the background only above the threshold', () => {
    drawOnce({ mode: 'bottom', bass: 100 });
    assert.match(background.style.transform, /^scale\(1\.0\d+\)$/);
    drawOnce({ mode: 'bottom', bass: 254 });
    assert.equal(background.style.transform, 'scale(1)');
});

test('"off" stops the animation loop; other modes request the next frame', () => {
    const before = frameRequests;
    const { v } = drawOnce({ mode: 'both' });
    assert.equal(frameRequests, before + 1);
    v.mode = 'off';
    v.draw();
    assert.equal(v.animationId, null);
    assert.equal(frameRequests, before + 1, 'no new frame once off');
});
