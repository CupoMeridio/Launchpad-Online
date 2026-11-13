/**
 * Integration tests for js/midi.js with a mocked Web MIDI API and a real
 * legacy Launchpad profile: connection, routing of incoming messages to pads,
 * pages and modes, hardware layout sync and hot-unplug.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createRecordingSink } from './helpers/browserStubs.js';

const { elements } = installBrowserStubs();

// ---- Web MIDI mock: one Launchpad S (legacy) ------------------------------------
const sentToDevice = [];
const input = { id: 'in-1', name: 'Launchpad S', type: 'input', state: 'connected', onmidimessage: null };
const output = { id: 'out-1', name: 'Launchpad S', type: 'output', state: 'connected', send: (bytes) => sentToDevice.push([...bytes]) };
const midiAccess = {
    inputs: new Map([[input.id, input]]),
    outputs: new Map([[output.id, output]]),
    onstatechange: null
};
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { requestMIDIAccess: async () => midiAccess }
});

const { setLogSink } = await import('../js/logger.js');
setLogSink(createRecordingSink());

const { initMidi } = await import('../js/midi.js');
const { initInteraction, resetPadStepCounters, changeMode } = await import('../js/interaction.js');
const { commitProject, setCurrentPage, getCurrentPage, getCurrentMode } = await import('../js/projectState.js');
const { normalizeProjectData } = await import('../js/projectModel.js');
const { audioEngine } = await import('../js/audio.js');
const { getActiveDeviceProfile } = await import('../js/physicalInterface.js');

// A two-page project whose pads all have a (fake) sample.
const pads = Array.from({ length: 64 }, (_, i) => [`s${i}.wav`]);
const runtime = normalizeProjectData({ id: 'midi', name: 'Midi', pages: [{ name: 'A', sounds: pads }, { name: 'B', sounds: pads }] });
runtime.pages.forEach((page, pageIndex) => page.forEach((steps, padIndex) => {
    steps[0].buffer = { pageIndex, padIndex, duration: 1 };
}));
commitProject(runtime);
setCurrentPage(0);
resetPadStepCounters();
initInteraction();
changeMode(5);

const played = [];
audioEngine.playBuffer = (buffer, key) => {
    played.push({ key, ...buffer });
    return buffer.duration;
};

const receive = (...bytes) => input.onmidimessage({ data: new Uint8Array(bytes) });
const notifications = () => (elements.get('notification-container')?.children || []).map(n => n.textContent);

await initMidi();

test('the Launchpad connects, gets a legacy profile and the current mode layout', () => {
    assert.equal(getActiveDeviceProfile()?.type, 'legacy');
    assert.equal(typeof input.onmidimessage, 'function', 'incoming messages are handled');
    assert.ok(notifications().includes('midi.status.connected'));
    assert.ok(sentToDevice.some(msg => msg[0] === 0xB0 && msg[1] === 0x00 && msg[2] === 0x01), 'User 1 layout (mode 5) is sent');
});

test('grid notes play and release the matching pad', () => {
    played.length = 0;
    const pad = elements.get('Launchpad').children[11]; // x=3, y=1

    receive(0x90, 1 * 16 + 3, 127);
    assert.deepEqual(played.map(p => p.key), ['project:0:11']);
    assert.equal(pad.classList.contains('active'), true);

    receive(0x90, 1 * 16 + 3, 0);
    assert.equal(pad.classList.contains('active'), false, 'velocity 0 releases the pad');
});

test('scene buttons change the page on press only', () => {
    receive(0x90, 1 * 16 + 8, 127);
    assert.equal(getCurrentPage(), 1);
    receive(0x90, 0 * 16 + 8, 0);
    assert.equal(getCurrentPage(), 1, 'releasing a scene button does nothing');

    played.length = 0;
    receive(0x90, 0, 127);
    assert.deepEqual(played.map(p => p.key), ['project:1:0'], 'pads now play the second page');
    receive(0x90, 0, 0);
});

test('top-row buttons change the mode and switch the hardware layout', () => {
    sentToDevice.length = 0;
    receive(0xB0, 104 + 6, 127);
    assert.equal(getCurrentMode(), 6);
    assert.ok(sentToDevice.some(msg => msg[0] === 0xB0 && msg[1] === 0x00 && msg[2] === 0x02), 'User 2 layout is sent');

    receive(0xB0, 104 + 1, 127);
    assert.equal(getCurrentMode(), 6, 'navigation buttons are ignored');
});

test('unplugging the Launchpad disconnects it and stops routing', () => {
    midiAccess.onstatechange({ port: { type: 'input', name: 'Launchpad S', state: 'disconnected' } });
    assert.ok(notifications().includes('midi.status.disconnected'));
    assert.equal(input.onmidimessage, null, 'the input handler is removed');
});
