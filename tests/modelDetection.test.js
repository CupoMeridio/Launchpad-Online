import assert from 'node:assert/strict';
import test from 'node:test';
import { detectModel } from '../js/midi-profiles/modelDetection.js';

// Characterization table: the complete detection result for the port names
// seen across operating systems and drivers (captured before refactoring).
const CASES = [
    ['', {isLaunchpad: false, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    [null, {isLaunchpad: false, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Ableton Push 2', {isLaunchpad: false, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Launchpad', {isLaunchpad: true, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Launchpad S', {isLaunchpad: true, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Launchpad Mini', {isLaunchpad: true, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Launchpad Mini MK2', {isLaunchpad: true, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Launchpad Mini MK3', {isLaunchpad: true, family: 'rgb', modelType: 'mk3', productId: 13, isMk3: true, isPro: false}],
    ['MIDIIN2 (LPMiniMK3 MIDI)', {isLaunchpad: true, family: 'rgb', modelType: 'mk3', productId: 13, isMk3: true, isPro: false}],
    ['LPMini MIDI', {isLaunchpad: true, family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false}],
    ['Launchpad MK2', {isLaunchpad: true, family: 'rgb', modelType: 'classic', productId: 24, isMk3: false, isPro: false}],
    ['Launchpad mk 2', {isLaunchpad: true, family: 'rgb', modelType: 'classic', productId: 24, isMk3: false, isPro: false}],
    ['Launchpad X', {isLaunchpad: true, family: 'rgb', modelType: 'mk3', productId: 12, isMk3: true, isPro: false}],
    ['Launchpad X LPX MIDI', {isLaunchpad: true, family: 'rgb', modelType: 'mk3', productId: 12, isMk3: true, isPro: false}],
    ['LPX MIDI', {isLaunchpad: true, family: 'rgb', modelType: 'mk3', productId: 12, isMk3: true, isPro: false}],
    ['Launchpad Pro', {isLaunchpad: true, family: 'rgb', modelType: 'pro', productId: 16, isMk3: false, isPro: true}],
    ['Launchpad Pro MK3', {isLaunchpad: true, family: 'rgb', modelType: 'pro-mk3', productId: 14, isMk3: true, isPro: true}],
    ['Launchpad Pro mk 3', {isLaunchpad: true, family: 'rgb', modelType: 'pro-mk3', productId: 14, isMk3: true, isPro: true}],
    ['LPProMK3 MIDI', {isLaunchpad: true, family: 'rgb', modelType: 'pro-mk3', productId: 14, isMk3: true, isPro: true}],
    ['LPPro MIDI', {isLaunchpad: true, family: 'rgb', modelType: 'pro', productId: 16, isMk3: false, isPro: true}],
    ['  launchpad x  ', {isLaunchpad: true, family: 'rgb', modelType: 'mk3', productId: 12, isMk3: true, isPro: false}]

];

test('detectModel identifies every known port name completely', () => {
    for (const [portName, expected] of CASES) {
        assert.deepEqual(detectModel(portName), expected, `port name: ${JSON.stringify(portName)}`);
    }
});

test('detectModel returns a fresh object each time', () => {
    const first = detectModel('Launchpad X');
    first.productId = 99;
    assert.equal(detectModel('Launchpad X').productId, 0x0C);
});
