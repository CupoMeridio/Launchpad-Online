import { audioEngine } from './audio.js';
import { syncInputSlider } from './formControls.js';
import * as VisualizerManager from './visualizerManager.js';
import { registerListener } from './eventCleanup.js';
import { debug } from './logger.js';

let visualizerControlsInitialized = false; // Prevent duplicate listener registration

/**
 * Initializes all controls for the visualizer.
 * Only initializes once to prevent duplicate listeners.
 */
// eslint-disable-next-line complexity -- Known debt (complexity 23): refactor, then remove this waiver.
export function initializeVisualizerControls() {
    // Prevent multiple initializations
    if (visualizerControlsInitialized) {
        debug("[VisualizerControls] Already initialized, skipping duplicate setup");
        return;
    }
    visualizerControlsInitialized = true;
    // Smoothing control
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');
    if (smoothingSlider && smoothingInput) {
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

    // Color and gradient controls
    const color1Picker = document.getElementById('color1-picker');
    const color2Picker = document.getElementById('color2-picker');
    const enableGradientCheckbox = document.getElementById('enable-color2-checkbox');
    const gradientControls = document.getElementById('gradient-controls');

    if (color1Picker && color2Picker && enableGradientCheckbox && gradientControls) {
        const updateColors = () => {
            const color1 = color1Picker.value;
            const color2 = enableGradientCheckbox.checked ? color2Picker.value : color1;
            VisualizerManager.setColors(color1, color2);
        };

        registerListener(enableGradientCheckbox, 'change', () => {
            gradientControls.style.display = enableGradientCheckbox.checked ? 'block' : 'none';
            updateColors();
        });

        registerListener(color1Picker, 'input', updateColors);
        registerListener(color2Picker, 'input', updateColors);

        // Set initial state
        gradientControls.style.display = enableGradientCheckbox.checked ? 'block' : 'none';
        updateColors();
    }

    // Gradient direction control
    const gradientDirection = document.getElementById('gradient-direction');
    if (gradientDirection) {
        registerListener(gradientDirection, 'change', function () {
            VisualizerManager.setGradientDirection(this.value);
        });
        // Set initial direction
        VisualizerManager.setGradientDirection(gradientDirection.value);
    }

    // Transparency control
    const alphaSlider = document.getElementById('alpha-slider');
    const alphaInput = document.getElementById('alpha-input');
    if (alphaSlider && alphaInput) {
        syncInputSlider({
            sliderId: 'alpha-slider',
            inputId: 'alpha-input',
            min: 0,
            max: 1,
            isFloat: true,
            onChange: (value) => VisualizerManager.setAlpha(value)
        });
        // Set initial transparency
        VisualizerManager.setAlpha(alphaSlider.value);
    }

    const symmetricCheckbox = document.getElementById('symmetric-checkbox');
    const symmetricMode = document.getElementById('symmetric-mode');
    const symmetricModeSelect = document.getElementById('symmetric-mode-select');
    if (symmetricCheckbox && symmetricMode && symmetricModeSelect) {
        const applySymmetry = () => {
            const enabled = !!symmetricCheckbox.checked;
            VisualizerManager.setSymmetric(enabled);
            VisualizerManager.setSymmetryReverse(symmetricModeSelect.value === 'reverse');
            symmetricMode.style.display = enabled ? 'block' : 'none';
        };
        registerListener(symmetricCheckbox, 'change', applySymmetry);
        registerListener(symmetricModeSelect, 'change', applySymmetry);
        applySymmetry();
    }

    // Bass Pulse controls
    const bassPulseToggle = document.getElementById('bass-pulse-toggle');
    const bassThresholdControls = document.getElementById('bass-threshold-controls');
    const bassThresholdSlider = document.getElementById('bass-threshold-slider');
    const bassThresholdInput = document.getElementById('bass-threshold-input');

    if (bassPulseToggle && bassThresholdControls && bassThresholdSlider && bassThresholdInput) {
        const applyBassPulse = () => {
            const enabled = !!bassPulseToggle.checked;
            VisualizerManager.setBassPulse(enabled);
            bassThresholdControls.style.display = enabled ? 'block' : 'none';
        };

        registerListener(bassPulseToggle, 'change', applyBassPulse);

        syncInputSlider({
            sliderId: 'bass-threshold-slider',
            inputId: 'bass-threshold-input',
            min: 0,
            max: 255,
            onChange: (value) => VisualizerManager.setBassThreshold(value)
        });

        // Set initial state
        applyBassPulse();
        VisualizerManager.setBassThreshold(parseInt(bassThresholdSlider.value, 10));
    }

    const updateControlsVisibility = (mode) => {
        const groups = [
            document.getElementById('smoothing-group'),
            document.getElementById('color1-group'),
            document.getElementById('enable-gradient-group'),
            document.getElementById('gradient-controls'),
            document.getElementById('alpha-group'),
            document.getElementById('symmetric-group'),
            document.getElementById('bass-pulse-group'),
        ];
        const show = mode !== 'off';
        groups.forEach(el => {
            if (!el) return;
            el.style.display = show ? (el.id === 'gradient-controls' ? (document.getElementById('enable-color2-checkbox')?.checked ? 'block' : 'none') : 'block') : 'none';
        });
    };

    registerListener(window, 'visualizer:mode', (e) => {
        updateControlsVisibility(e.detail?.mode);
        const menu = document.getElementById('visualizer-menu');
        if (menu) {
            const buttons = menu.querySelectorAll('.menu-option[data-mode]');
            buttons.forEach(b => b.classList.remove('selected'));
            const active = menu.querySelector(`.menu-option[data-mode="${e.detail?.mode}"]`);
            if (active) active.classList.add('selected');
        }
    });

    const initialMode = VisualizerManager.getVisualizer()?.mode || 'off';
    updateControlsVisibility(initialMode);
    const menu = document.getElementById('visualizer-menu');
    if (menu) {
        const buttons = menu.querySelectorAll('.menu-option[data-mode]');

        // Add click listeners to change mode
        buttons.forEach(btn => {
            registerListener(btn, 'click', () => {
                if (btn.classList.contains('selected')) return;
                VisualizerManager.setMode(btn.dataset.mode);
            });
        });

        buttons.forEach(b => b.classList.remove('selected'));
        const active = menu.querySelector(`.menu-option[data-mode="${initialMode}"]`);
        if (active) active.classList.add('selected');
    }
}

/**
 * Update the visibility of the visualizer controls based on the mode.
 */
