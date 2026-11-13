/**
 * Integration tests for js/audio.js on a mock Web Audio graph: loading and
 * error classification, playback keys (restart / isolation), and failure
 * reporting.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createRecordingSink } from './helpers/browserStubs.js';

const { elements } = installBrowserStubs();

// ---- Mock Web Audio ------------------------------------------------------------
class MockAudioBuffer {
    constructor({ length = 44100, duration = 1 } = {}) {
        this.length = length;
        this.duration = duration;
    }
}
globalThis.AudioBuffer = MockAudioBuffer;

const sources = [];
let decodeBehavior = () => new MockAudioBuffer();

globalThis.AudioContext = class MockAudioContext {
    constructor() {
        this.state = 'running';
        this.destination = {};
        this.resumeCalls = 0;
    }
    createAnalyser() {
        return { connect() {}, fftSize: 0, smoothingTimeConstant: 0 };
    }
    createBufferSource() {
        const source = {
            buffer: null,
            started: false,
            stopped: false,
            connect() {},
            disconnect() {},
            start() { this.started = true; },
            stop() { this.stopped = true; }
        };
        sources.push(source);
        return source;
    }
    async decodeAudioData(arrayBuffer) {
        return decodeBehavior(arrayBuffer);
    }
    async resume() {
        this.resumeCalls++;
        this.state = 'running';
    }
    async close() {}
};

const { setLogSink } = await import('../js/logger.js');
setLogSink(createRecordingSink());
const { audioEngine } = await import('../js/audio.js');
const { audioLoadingTracker, AUDIO_ERROR_TYPES } = await import('../js/audioErrorHandler.js');
await audioEngine.init();

const okResponse = () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
const failureTypeOf = (url) => audioLoadingTracker.getFailureStats().failureDetails[url]?.type;

test('loadSound decodes a sample and records the success', async () => {
    globalThis.fetch = async () => okResponse();
    decodeBehavior = () => new MockAudioBuffer({ duration: 2 });
    audioLoadingTracker.reset();

    const buffer = await audioEngine.loadSound('ok.wav');
    assert.equal(buffer.duration, 2);
    assert.equal(audioLoadingTracker.getFailureStats().successful, 1);
});

test('loadSound classifies failures instead of throwing', async () => {
    audioLoadingTracker.reset();

    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    assert.equal(await audioEngine.loadSound('offline.wav'), null);
    assert.equal(failureTypeOf('offline.wav'), AUDIO_ERROR_TYPES.NETWORK_ERROR);

    globalThis.fetch = async () => ({ ok: false, status: 404 });
    assert.equal(await audioEngine.loadSound('missing.wav'), null);
    assert.equal(failureTypeOf('missing.wav'), AUDIO_ERROR_TYPES.NETWORK_ERROR);

    globalThis.fetch = async () => okResponse();
    decodeBehavior = () => { throw new Error('NotSupportedError: codec'); };
    assert.equal(await audioEngine.loadSound('weird.xyz'), null);
    assert.equal(failureTypeOf('weird.xyz'), AUDIO_ERROR_TYPES.UNSUPPORTED_CODEC);

    decodeBehavior = () => new MockAudioBuffer({ length: 0, duration: 0 });
    assert.equal(await audioEngine.loadSound('empty.wav'), null);
    assert.equal(failureTypeOf('empty.wav'), AUDIO_ERROR_TYPES.CORRUPTED_FILE);

    assert.equal(audioLoadingTracker.getFailureStats().failed, 4);
});

test('loadBuffers reports failed samples to the user once', async () => {
    globalThis.fetch = async (url) => (url.includes('bad') ? { ok: false, status: 500 } : okResponse());
    decodeBehavior = () => new MockAudioBuffer();
    const before = elements.get('notification-container')?.children.length ?? 0;

    const result = await audioEngine.loadBuffers(['a.wav', 'bad1.wav', 'b.wav', 'bad2.wav']);

    assert.equal(result.total, 4);
    assert.equal(result.failed, 2);
    assert.deepEqual([...result.buffersByUrl.keys()].sort(), ['a.wav', 'b.wav']);
    const added = elements.get('notification-container').children.slice(before).map(n => n.textContent);
    assert.deepEqual(added, ['audio.loadFailures'], 'one translated warning for all failures');
});

test('re-playing the same key restarts it; other keys keep playing', () => {
    sources.length = 0;
    const buffer = new MockAudioBuffer({ duration: 1.5 });

    assert.equal(audioEngine.playBuffer(buffer, 'project:0:1'), 1.5);
    audioEngine.playBuffer(buffer, 'project:0:2');
    audioEngine.playBuffer(buffer, 'project:0:1');

    assert.equal(sources.length, 3);
    assert.deepEqual(sources.map(s => s.stopped), [true, false, false], 'only the previous source of the same pad stops');
    assert.ok(sources.every(s => s.started));
});

test('a finished sound frees its key without affecting a newer one', () => {
    sources.length = 0;
    const buffer = new MockAudioBuffer();
    audioEngine.playBuffer(buffer, 'k');
    const first = sources[0];
    audioEngine.playBuffer(buffer, 'k');
    first.onended?.(); // late end of the replaced source

    audioEngine.stopSound('k');
    assert.equal(sources[1].stopped, true, 'the newer source was still tracked and could be stopped');
});

test('draft sounds can be stopped without touching project sounds', () => {
    sources.length = 0;
    const buffer = new MockAudioBuffer();
    audioEngine.playBuffer(buffer, 'project:0:0');
    audioEngine.playBuffer(buffer, 'draft:0:0');
    audioEngine.playBuffer(buffer, 'draft:1:5');

    audioEngine.stopSoundsWithPrefix('draft:');
    assert.deepEqual(sources.map(s => s.stopped), [false, true, true]);

    audioEngine.stopAllSounds();
    assert.equal(sources[0].stopped, true);
});

test('invalid buffers are not played', () => {
    sources.length = 0;
    assert.equal(audioEngine.playBuffer(null, 'x'), 0);
    assert.equal(audioEngine.playBuffer({ duration: 1 }, 'x'), 0, 'not an AudioBuffer');
    assert.equal(sources.length, 0);
});

test('a suspended context is resumed when a sound is played', () => {
    audioEngine.audioContext.state = 'suspended';
    const resumesBefore = audioEngine.audioContext.resumeCalls;
    audioEngine.playBuffer(new MockAudioBuffer(), 'resume');
    assert.equal(audioEngine.audioContext.resumeCalls, resumesBefore + 1);
});

test('decodeAudioFile rejects files that decode to an empty buffer', async () => {
    const file = { arrayBuffer: async () => new ArrayBuffer(4) };
    decodeBehavior = () => new MockAudioBuffer({ duration: 3 });
    assert.equal((await audioEngine.decodeAudioFile(file)).duration, 3);

    decodeBehavior = () => new MockAudioBuffer({ length: 0, duration: 0 });
    await assert.rejects(audioEngine.decodeAudioFile(file), /empty/);
});
