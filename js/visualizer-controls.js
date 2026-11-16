import { audioEngine } from './audio.js';
import { syncInputSlider } from './formControls.js';
import * as VisualizerManager from './visualizerManager.js';
import { registerListener } from './eventCleanup.js';
import { debug } from './logger.js';

let visualizerControlsInitialized = false; // Prevent duplicate listener registration

const show = (element, visible) => {
    if (element) element.style.display = visible ? 'block' : 'none';
};

/**
 * Marks the visualizer menu entry of `mode` as selected.
 * @param {HTMLElement} menu
 * @param {string} mode
 */
function highlightModeOption(menu, mode) {
    menu.querySelectorAll('.menu-option[data-mode]').forEach(b => b.classList.remove('selected'));
    menu.querySelector(`.menu-option[data-mode="${mode}"]`)?.classList.add('selected');
}

/** Groups shown only while the visualizer is on. */
const MODE_DEPENDENT_GROUPS = [
    'smoothing-group', 'color1-group', 'enable-gradient-group', 'gradient-controls',
    'alpha-group', 'symmetric-group', 'bass-pulse-group'
];

/**
 * Shows the settings groups while the visualizer is on. The second colour's
 * controls additionally require the gradient to be enabled.
 * @param {string} mode
 */
function updateControlsVisibility(mode) {
    const visualizerOn = mode !== 'off';
    const gradientEnabled = Boolean(document.getElementById('enable-color2-checkbox')?.checked);
    MODE_DEPENDENT_GROUPS.forEach(id => {
        const group = document.getElementById(id);
        show(group, visualizerOn && (id !== 'gradient-controls' || gradientEnabled));
    });
}

function initSmoothingControl() {
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');
    if (!smoothingSlider || !smoothingInput) return;

    const initialValue = audioEngine.getAnalyser().smoothingTimeConstant;
    smoothingSlider.value = initialValue;
    smoothingInput.value = initialValue;
    syncInputSlider({
        sliderId: 'smoothing-slider',
        inputId: 'smoothing-input',
        min: 0,
        max: 0.95,
        isFloat: true,
        onChange: (value) => VisualizerManager.setSmoothing(value)
    });
}

function initColorControls() {
    const color1Picker = document.getElementById('color1-picker');
    const color2Picker = document.getElementById('color2-picker');
    const enableGradientCheckbox = document.getElementById('enable-color2-checkbox');
    const gradientControls = document.getElementById('gradient-controls');
    if (!color1Picker || !color2Picker || !enableGradientCheckbox || !gradientControls) return;

    // Without a gradient both ends use the first colour.
    const updateColors = () => {
        const color1 = color1Picker.value;
        VisualizerManager.setColors(color1, enableGradientCheckbox.checked ? color2Picker.value : color1);
    };

    registerListener(enableGradientCheckbox, 'change', () => {
        show(gradientControls, enableGradientCheckbox.checked);
        updateColors();
    });
    registerListener(color1Picker, 'input', updateColors);
    registerListener(color2Picker, 'input', updateColors);

    show(gradientControls, enableGradientCheckbox.checked);
    updateColors();
}

function initGradientDirectionControl() {
    const gradientDirection = document.getElementById('gradient-direction');
    if (!gradientDirection) return;
    registerListener(gradientDirection, 'change', function () {
        VisualizerManager.setGradientDirection(this.value);
    });
    VisualizerManager.setGradientDirection(gradientDirection.value);
}

function initAlphaControl() {
    const alphaSlider = document.getElementById('alpha-slider');
    if (!alphaSlider || !document.getElementById('alpha-input')) return;
    syncInputSlider({
        sliderId: 'alpha-slider',
        inputId: 'alpha-input',
        min: 0,
        max: 1,
        isFloat: true,
        onChange: (value) => VisualizerManager.setAlpha(value)
    });
    VisualizerManager.setAlpha(alphaSlider.value);
}

function initSymmetryControls() {
    const symmetricCheckbox = document.getElementById('symmetric-checkbox');
    const symmetricMode = document.getElementById('symmetric-mode');
    const symmetricModeSelect = document.getElementById('symmetric-mode-select');
    if (!symmetricCheckbox || !symmetricMode || !symmetricModeSelect) return;

    const applySymmetry = () => {
        const enabled = !!symmetricCheckbox.checked;
        VisualizerManager.setSymmetric(enabled);
        VisualizerManager.setSymmetryReverse(symmetricModeSelect.value === 'reverse');
        show(symmetricMode, enabled);
    };
    registerListener(symmetricCheckbox, 'change', applySymmetry);
    registerListener(symmetricModeSelect, 'change', applySymmetry);
    applySymmetry();
}

function initBassPulseControls() {
    const bassPulseToggle = document.getElementById('bass-pulse-toggle');
    const bassThresholdControls = document.getElementById('bass-threshold-controls');
    const bassThresholdSlider = document.getElementById('bass-threshold-slider');
    if (!bassPulseToggle || !bassThresholdControls || !bassThresholdSlider || !document.getElementById('bass-threshold-input')) return;

    const applyBassPulse = () => {
        const enabled = !!bassPulseToggle.checked;
        VisualizerManager.setBassPulse(enabled);
        show(bassThresholdControls, enabled);
    };
    registerListener(bassPulseToggle, 'change', applyBassPulse);
    syncInputSlider({
        sliderId: 'bass-threshold-slider',
        inputId: 'bass-threshold-input',
        min: 0,
        max: 255,
        onChange: (value) => VisualizerManager.setBassThreshold(value)
    });

    applyBassPulse();
    VisualizerManager.setBassThreshold(parseInt(bassThresholdSlider.value, 10));
}

/**
 * Visualizer mode menu: switches the mode on click and follows mode changes
 * coming from anywhere (e.g. a project load) to update the menu and groups.
 */
function initModeMenu() {
    const menu = document.getElementById('visualizer-menu');

    registerListener(window, 'visualizer:mode', (e) => {
        updateControlsVisibility(e.detail?.mode);
        if (menu) highlightModeOption(menu, e.detail?.mode);
    });

    const initialMode = VisualizerManager.getVisualizer()?.mode || 'off';
    updateControlsVisibility(initialMode);
    if (!menu) return;

    menu.querySelectorAll('.menu-option[data-mode]').forEach(btn => {
        registerListener(btn, 'click', () => {
            if (btn.classList.contains('selected')) return;
            VisualizerManager.setMode(btn.dataset.mode);
        });
    });
    highlightModeOption(menu, initialMode);
}

/**
 * Initializes all controls for the visualizer.
 * Only initializes once to prevent duplicate listeners.
 */
export function initializeVisualizerControls() {
    if (visualizerControlsInitialized) {
        debug("[VisualizerControls] Already initialized, skipping duplicate setup");
        return;
    }
    visualizerControlsInitialized = true;

    initSmoothingControl();
    initColorControls();
    initGradientDirectionControl();
    initAlphaControl();
    initSymmetryControls();
    initBassPulseControls();
    initModeMenu();
}

