import { audioEngine } from './audio.js';
import { syncInputSlider } from './ui.js';

/**
 * Initializes all controls for the visualizer.
 */
export function initializeVisualizerControls() {
    // Smoothing control
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');
    if (smoothingSlider && smoothingInput) {
        const initialValue = audioEngine.getAnalyser().smoothingTimeConstant;
        smoothingSlider.value = initialValue;
        smoothingInput.value = initialValue;
        syncInputSlider('smoothing-slider', 'smoothing-input', (value) => {
            if (window.visualizer) window.visualizer.setSmoothing(value);
        }, 0, 0.95, true);
    }

    // Color and gradient controls
    const color1Picker = document.getElementById('color1-picker');
    const color2Picker = document.getElementById('color2-picker');
    const enableGradientCheckbox = document.getElementById('enable-color2-checkbox');
    const gradientControls = document.getElementById('gradient-controls');

    if (color1Picker && color2Picker && enableGradientCheckbox && gradientControls) {
        const updateColors = () => {
            if (window.visualizer) {
                const color1 = color1Picker.value;
                const color2 = enableGradientCheckbox.checked ? color2Picker.value : color1;
                window.visualizer.setColors(color1, color2);
            }
        };

        enableGradientCheckbox.addEventListener('change', () => {
            gradientControls.style.display = enableGradientCheckbox.checked ? 'block' : 'none';
            updateColors();
        });

        color1Picker.addEventListener('input', updateColors);
        color2Picker.addEventListener('input', updateColors);
        
        // Set initial state
        gradientControls.style.display = enableGradientCheckbox.checked ? 'block' : 'none';
        updateColors();
    }

    // Gradient direction control
    const gradientDirection = document.getElementById('gradient-direction');
    if (gradientDirection) {
        gradientDirection.addEventListener('change', function() {
            if (window.visualizer) {
                window.visualizer.setGradientDirection(this.value);
            }
        });
        // Set initial direction
        if (window.visualizer) {
            window.visualizer.setGradientDirection(gradientDirection.value);
        }
    }

    // Transparency control
    const alphaSlider = document.getElementById('alpha-slider');
    const alphaInput = document.getElementById('alpha-input');
    if (alphaSlider && alphaInput) {
        syncInputSlider('alpha-slider', 'alpha-input', (value) => {
            if (window.visualizer) window.visualizer.setAlpha(value);
        }, 0, 1, true);
        // Set initial transparency
        if (window.visualizer) {
            window.visualizer.setAlpha(alphaSlider.value);
        }
    }

    const symmetricCheckbox = document.getElementById('symmetric-checkbox');
    const symmetricMode = document.getElementById('symmetric-mode');
    const symmetricModeSelect = document.getElementById('symmetric-mode-select');
    if (symmetricCheckbox && symmetricMode && symmetricModeSelect) {
        const applySymmetry = () => {
            const enabled = !!symmetricCheckbox.checked;
            if (window.visualizer) {
                window.visualizer.setSymmetric(enabled);
                window.visualizer.setSymmetryReverse(symmetricModeSelect.value === 'reverse');
            }
            symmetricMode.style.display = enabled ? 'block' : 'none';
        };
        symmetricCheckbox.addEventListener('change', applySymmetry);
        symmetricModeSelect.addEventListener('change', applySymmetry);
        applySymmetry();
    }

    const updateControlsVisibility = (mode) => {
        const groups = [
            document.getElementById('smoothing-group'),
            document.getElementById('color1-group'),
            document.getElementById('enable-gradient-group'),
            document.getElementById('gradient-controls'),
            document.getElementById('alpha-group'),
            document.getElementById('symmetric-group'),
        ];
        const show = mode !== 'off';
        groups.forEach(el => {
            if (!el) return;
            el.style.display = show ? (el.id === 'gradient-controls' ? (document.getElementById('enable-color2-checkbox')?.checked ? 'block' : 'none') : 'block') : 'none';
        });
    };

    window.addEventListener('visualizer:mode', (e) => {
        updateControlsVisibility(e.detail?.mode);
        const menu = document.getElementById('visualizer-menu');
        if (menu) {
            const buttons = menu.querySelectorAll('.menu-option[data-mode]');
            buttons.forEach(b => b.classList.remove('selected'));
            const active = menu.querySelector(`.menu-option[data-mode="${e.detail?.mode}"]`);
            if (active) active.classList.add('selected');
        }
    });

    const initialMode = window.visualizer ? window.visualizer.mode : 'both';
    updateControlsVisibility(initialMode);
    const menu = document.getElementById('visualizer-menu');
    if (menu) {
        const buttons = menu.querySelectorAll('.menu-option[data-mode]');
        buttons.forEach(b => b.classList.remove('selected'));
        const active = menu.querySelector(`.menu-option[data-mode="${initialMode}"]`);
        if (active) active.classList.add('selected');
    }
}

/**
 * Update the visibility of the visualizer controls based on the mode.
 */
