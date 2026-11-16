import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, getElementById() { return null; } };

const { audioEngine } = await import('../js/audio.js');
const { AUDIO_LOAD_CONCURRENCY } = await import('../js/constants.js');

test('loadBuffers loads each URL once, with bounded concurrency, and reports progress', async () => {
    const requested = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const originalLoadSound = audioEngine.loadSound;
    audioEngine.loadSound = async (url) => {
        requested.push(url);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // Uneven delays: a pool keeps going while a slow file is pending.
        await new Promise(resolve => setTimeout(resolve, url.endsWith('0.wav') ? 15 : 1));
        inFlight--;
        return url.includes('broken') ? null : { url };
    };

    const urls = [
        ...Array.from({ length: 20 }, (_, i) => `s${i}.wav`),
        's1.wav', 's2.wav', // duplicates
        'broken.wav'
    ];
    const progress = [];

    try {
        const result = await audioEngine.loadBuffers(urls, (loaded, total) => progress.push([loaded, total]));

        assert.equal(requested.length, 21, 'each distinct URL is requested exactly once');
        assert.ok(maxInFlight <= AUDIO_LOAD_CONCURRENCY, `at most ${AUDIO_LOAD_CONCURRENCY} loads in flight (saw ${maxInFlight})`);
        assert.equal(result.total, 21);
        assert.equal(result.buffersByUrl.size, 20, 'failed URLs are absent from the result');
        assert.deepEqual(result.buffersByUrl.get('s3.wav'), { url: 's3.wav' });
        assert.deepEqual(progress[0], [0, 21]);
        assert.deepEqual(progress.at(-1), [21, 21]);
    } finally {
        audioEngine.loadSound = originalLoadSound;
    }
});

test('loadBuffers with no URLs resolves immediately', async () => {
    const result = await audioEngine.loadBuffers([]);
    assert.equal(result.total, 0);
    assert.equal(result.buffersByUrl.size, 0);
});
