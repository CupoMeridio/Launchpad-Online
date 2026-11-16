/**
 * Behaviour of the visualizer settings panel (js/visualizer-controls.js):
 * initial state pushed to the visualizer, control events, group visibility
 * and the mode menu.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createElement } from './helpers/browserStubs.js';

installBrowserStubs();
const el = (id) => globalThis.document.getElementById(id);

// Initial markup state
el('color1-picker').value = '#112233';
el('color2-picker').value = '#445566';
el('enable-color2-checkbox').checked = true;
el('gradient-direction').value = 'horizontal';
el('alpha-slider').value = '0.4';
el('symmetric-checkbox').checked = false;
el('symmetric-mode-select').value = 'reverse';
el('bass-pulse-toggle').checked = false;
el('bass-threshold-slider').value = '120';
['smoothing-slider', 'smoothing-input', 'alpha-input', 'bass-threshold-input', 'gradient-controls',
    'symmetric-mode', 'bass-threshold-controls', 'smoothing-group', 'color1-group', 'alpha-group'].forEach(el);

const modeButtons = ['off', 'top', 'both'].map(mode => createElement('button', { className: 'menu-option', dataset: { mode } }));
const menu = el('visualizer-menu');
menu.querySelectorAll = () => modeButtons;
menu.querySelector = (sel) => modeButtons.find(b => sel.includes(`data-mode="${b.dataset.mode}"`)) || null;

// A visualizer that records the settings it receives.
const calls = [];
const visualizer = new Proxy({ mode: 'top' }, {
    get: (target, prop) => (prop in target ? target[prop] : (...args) => calls.push([String(prop), ...args]))
});
const lastCall = (name) => calls.filter(([n]) => n === name).at(-1)?.slice(1);

const { audioEngine } = await import('../js/audio.js');
audioEngine.analyser = { smoothingTimeConstant: 0.55 };
const manager = await import('../js/visualizerManager.js');
manager.setVisualizer(visualizer);
const { initializeVisualizerControls } = await import('../js/visualizer-controls.js');

initializeVisualizerControls();
const selectedMode = () => modeButtons.find(b => b.classList.contains('selected'))?.dataset.mode;

test('initialization pushes the panel state to the visualizer', () => {
    assert.deepEqual(lastCall('setColors'), ['#112233', '#445566']);
    assert.deepEqual(lastCall('setGradientDirection'), ['horizontal']);
    assert.deepEqual(lastCall('setAlpha'), ['0.4']);
    assert.deepEqual(lastCall('setSymmetric'), [false]);
    assert.deepEqual(lastCall('setSymmetryReverse'), [true]);
    assert.deepEqual(lastCall('setBassPulse'), [false]);
    assert.deepEqual(lastCall('setBassThreshold'), [120]);
    assert.equal(el('smoothing-slider').value, 0.55, 'smoothing starts from the analyser');
    assert.equal(selectedMode(), 'top', 'the menu shows the current mode');
});

test('turning the gradient off uses the first colour for both ends and hides colour 2', () => {
    el('enable-color2-checkbox').checked = false;
    el('enable-color2-checkbox').dispatch('change');
    assert.deepEqual(lastCall('setColors'), ['#112233', '#112233']);
    assert.equal(el('gradient-controls').style.display, 'none');

    el('color1-picker').value = '#abcdef';
    el('color1-picker').dispatch('input');
    assert.deepEqual(lastCall('setColors'), ['#abcdef', '#abcdef']);
});

test('symmetry and bass pulse controls show their options only when enabled', () => {
    el('symmetric-checkbox').checked = true;
    el('symmetric-checkbox').dispatch('change');
    assert.deepEqual(lastCall('setSymmetric'), [true]);
    assert.equal(el('symmetric-mode').style.display, 'block');

    el('bass-pulse-toggle').checked = true;
    el('bass-pulse-toggle').dispatch('change');
    assert.deepEqual(lastCall('setBassPulse'), [true]);
    assert.equal(el('bass-threshold-controls').style.display, 'block');
});

test('mode changes from anywhere update the groups and the menu', () => {
    globalThis.window.dispatchEvent(new CustomEvent('visualizer:mode', { detail: { mode: 'off' } }));
    assert.equal(el('alpha-group').style.display, 'none', 'settings are hidden while off');
    assert.equal(selectedMode(), 'off');

    el('enable-color2-checkbox').checked = true;
    globalThis.window.dispatchEvent(new CustomEvent('visualizer:mode', { detail: { mode: 'both' } }));
    assert.equal(el('alpha-group').style.display, 'block');
    assert.equal(el('gradient-controls').style.display, 'block', 'colour 2 shows again with the gradient on');
    assert.equal(selectedMode(), 'both');
});

test('clicking a mode switches to it; clicking the selected one does nothing', () => {
    calls.length = 0;
    modeButtons[1].dispatch('click');
    assert.deepEqual(lastCall('setMode'), ['top']);

    calls.length = 0;
    modeButtons[2].dispatch('click'); // 'both' is selected
    assert.equal(lastCall('setMode'), undefined);
});
