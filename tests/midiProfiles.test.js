import assert from 'node:assert/strict';
import test from 'node:test';

import { DeviceProfile } from '../js/midi-profiles/DeviceProfile.js';
import { LaunchpadLegacy } from '../js/midi-profiles/LaunchpadLegacy.js';
import { LaunchpadRGB } from '../js/midi-profiles/LaunchpadRGB.js';
import { ProfileRegistry } from '../js/midi-profiles/ProfileRegistry.js';
import { setDeviceProfile, setPhysicalColor, flushPhysicalColors, getLpColor } from '../js/physicalInterface.js';

test('ProfileRegistry correctly pairs ports and filters out DAW ports', () => {
    const inputs = [
        { name: 'Launchpad Mini MK3 DAW', type: 'input' },
        { name: 'Launchpad Mini MK3 LPMiniMK3 MIDI', type: 'input' },
        { name: 'Other Synth', type: 'input' }
    ];
    const outputs = [
        { name: 'Launchpad Mini MK3 DAW', type: 'output' },
        { name: 'Launchpad Mini MK3 LPMiniMK3 MIDI', type: 'output' },
        { name: 'Other Synth', type: 'output' }
    ];

    const result = ProfileRegistry.findLaunchpadPorts(inputs.values(), outputs.values());
    assert.ok(result.input);
    assert.ok(result.output);
    assert.equal(result.input.name, 'Launchpad Mini MK3 LPMiniMK3 MIDI');
    assert.equal(result.output.name, 'Launchpad Mini MK3 LPMiniMK3 MIDI');

    // When no Launchpad is connected
    const emptyResult = ProfileRegistry.findLaunchpadPorts([].values(), [].values());
    assert.equal(emptyResult.input, null);
    assert.equal(emptyResult.output, null);
});

test('ProfileRegistry resolves Legacy vs RGB profile based on device name', () => {
    const legacyDevice = ProfileRegistry.getProfile('Launchpad S', null, null);
    assert.ok(legacyDevice instanceof LaunchpadLegacy);
    assert.equal(legacyDevice.type, 'legacy');

    const legacyMini = ProfileRegistry.getProfile('Launchpad Mini', null, null);
    assert.ok(legacyMini instanceof LaunchpadLegacy);

    const miniMk2Device = ProfileRegistry.getProfile('Launchpad Mini MK2', null, null);
    assert.ok(miniMk2Device instanceof LaunchpadLegacy, 'Mini Mk2 must resolve to Legacy bicolor profile');

    const mk2Device = ProfileRegistry.getProfile('Launchpad MK2', null, null);
    assert.ok(mk2Device instanceof LaunchpadRGB);
    assert.equal(mk2Device.type, 'rgb');
    assert.equal(mk2Device.productId, 0x18);

    const mk3Device = ProfileRegistry.getProfile('Launchpad Mini MK3 MIDI', null, null);
    assert.ok(mk3Device instanceof LaunchpadRGB);
    assert.equal(mk3Device.productId, 0x0D);

    const xDevice = ProfileRegistry.getProfile('Launchpad X LPX MIDI', null, null);
    assert.ok(xDevice instanceof LaunchpadRGB);
    assert.equal(xDevice.productId, 0x0C);

    const proDevice = ProfileRegistry.getProfile('Launchpad Pro MK3', null, null);
    assert.ok(proDevice instanceof LaunchpadRGB);
    assert.equal(proDevice.isPro, true);

    // Test getModelType classification
    assert.equal(ProfileRegistry.getModelType('Launchpad S'), 'classic');
    assert.equal(ProfileRegistry.getModelType('Launchpad Mini'), 'classic');
    assert.equal(ProfileRegistry.getModelType('Launchpad Mini MK2'), 'classic');
    assert.equal(ProfileRegistry.getModelType('Launchpad MK2'), 'classic');
    assert.equal(ProfileRegistry.getModelType('Launchpad Mini MK3 MIDI'), 'mk3');
    assert.equal(ProfileRegistry.getModelType('Launchpad X LPX MIDI'), 'mk3');
    assert.equal(ProfileRegistry.getModelType('Launchpad Pro'), 'pro');
    assert.equal(ProfileRegistry.getModelType('Launchpad Pro MK3'), 'pro-mk3');
});

test('LaunchpadLegacy maps notes, CCs and colors accurately', () => {
    const profile = new LaunchpadLegacy(null, null);

    // Coordinate parsing
    assert.deepEqual(profile.parseMessage([0x90, 0x00, 127]), { x: 0, y: 0, pressed: true });
    assert.deepEqual(profile.parseMessage([0x90, 0x10, 127]), { x: 0, y: 1, pressed: true });
    assert.deepEqual(profile.parseMessage([0x90, 0x77, 127]), { x: 7, y: 7, pressed: true });
    assert.deepEqual(profile.parseMessage([0x90, 0x08, 127]), { x: 8, y: 0, pressed: true }); // Scene button 0
    assert.deepEqual(profile.parseMessage([0x90, 0x78, 0]), { x: 8, y: 7, pressed: false }); // Scene button 7 release
    assert.deepEqual(profile.parseMessage([0x80, 0x00, 0]), { x: 0, y: 0, pressed: false }); // Note off
    assert.deepEqual(profile.parseMessage([0xB0, 104, 127]), { x: 0, y: 8, pressed: true }); // Automap button 0
    assert.deepEqual(profile.parseMessage([0xB0, 111, 0]), { x: 7, y: 8, pressed: false }); // Automap button 7 release

    // Message building
    assert.deepEqual(profile.buildColorMessage(0, 0, 3), [0x90, 0x00, 3]);
    assert.deepEqual(profile.buildColorMessage(7, 7, 48), [0x90, 0x77, 48]);
    assert.deepEqual(profile.buildColorMessage(8, 0, 51), [0x90, 0x08, 51]);
    assert.deepEqual(profile.buildColorMessage(0, 8, 51), [0xB0, 104, 51]);

    // Color resolution with fallbacks
    assert.equal(profile.getColor('red').code, 3);
    assert.equal(profile.getColor('green').code, 48);
    assert.equal(profile.getColor('amber').code, 51);
    assert.equal(profile.getColor('blue').code, 48); // Fallback to green
    assert.equal(profile.getColor('purple').code, 3); // Fallback to red
    assert.equal(profile.getColor('white').code, 51); // Fallback to amber
});

test('LaunchpadRGB maps programmer layout and 127-color palette accurately', () => {
    const sentMessages = [];
    const mockOutput = {
        send: (bytes) => sentMessages.push(Array.from(bytes))
    };
    const profile = new LaunchpadRGB(mockOutput, null, 'Launchpad Mini MK3');

    // SysEx initialization
    profile.initialize();
    assert.deepEqual(sentMessages[0], [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0D, 0x0E, 0x01, 0xF7]);
    assert.deepEqual(sentMessages[1], [0xB0, 0x00, 0x00]);

    // Coordinate parsing (11-88 decimal grid)
    assert.deepEqual(profile.parseMessage([0x90, 81, 127]), { x: 0, y: 0, pressed: true }); // Top-left
    assert.deepEqual(profile.parseMessage([0x90, 88, 127]), { x: 7, y: 0, pressed: true }); // Top-right
    assert.deepEqual(profile.parseMessage([0x90, 11, 127]), { x: 0, y: 7, pressed: true }); // Bottom-left
    assert.deepEqual(profile.parseMessage([0x90, 18, 127]), { x: 7, y: 7, pressed: true }); // Bottom-right
    assert.deepEqual(profile.parseMessage([0x90, 89, 127]), { x: 8, y: 0, pressed: true }); // Top Scene button
    assert.deepEqual(profile.parseMessage([0x90, 19, 0]), { x: 8, y: 7, pressed: false }); // Bottom Scene release
    assert.deepEqual(profile.parseMessage([0xB0, 104, 127]), { x: 0, y: 8, pressed: true }); // Top Automap 0

    // Message building
    assert.deepEqual(profile.buildColorMessage(0, 0, 5), [0x90, 81, 5]); // Top-left red
    assert.deepEqual(profile.buildColorMessage(7, 7, 21), [0x90, 18, 21]); // Bottom-right green
    assert.deepEqual(profile.buildColorMessage(8, 0, 45), [0x90, 89, 45]); // Scene 0 blue
    assert.deepEqual(profile.buildColorMessage(0, 8, 13), [0xB0, 104, 13]); // Automap 0 yellow

    // Native RGB colors
    assert.equal(profile.getColor('blue').code, 45);
    assert.equal(profile.getColor('cyan').code, 37);
    assert.equal(profile.getColor('purple').code, 53);
    assert.equal(profile.getColor('pink').code, 95);
    assert.equal(profile.getColor('white').code, 3);
});

test('physicalInterface delegates to active DeviceProfile with batching', () => {
    const batches = [];
    const mockOutput = {
        send: (data) => batches.push(Array.from(data))
    };
    const profile = new LaunchpadLegacy(mockOutput, null);
    setDeviceProfile(profile);

    // Resolve color
    const red = getLpColor('red', 'full');
    assert.equal(red.code, 3);

    // Buffer updates
    setPhysicalColor(red, [0, 0], false);
    setPhysicalColor(red, [1, 0], false);
    assert.equal(batches.length, 0, 'No messages sent before flush');

    // Flush batch
    flushPhysicalColors();
    assert.equal(batches.length, 1);
    assert.deepEqual(batches[0], [0x90, 0x00, 3, 0x90, 0x01, 3]);

    // Immediate send
    setPhysicalColor(red, [2, 0], true);
    assert.equal(batches.length, 2);
    assert.deepEqual(batches[1], [0x90, 0x02, 3]);

    setDeviceProfile(null);
});
