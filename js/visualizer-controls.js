import { audioEngine } from './audio.js';

/**
 * Inizializza tutti i controlli per il visualizzatore.
 */
export function initializeVisualizerControls() {
    // Controllo Fluidità
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');
    if (smoothingSlider && smoothingInput) {
        const initialValue = audioEngine.getAnalyser().smoothingTimeConstant;
        smoothingSlider.value = initialValue;
        smoothingInput.value = initialValue;
        syncSliderAndInput(smoothingSlider, smoothingInput, (value) => {
            if (window.visualizer) window.visualizer.setSmoothing(value);
        });
    }

    // Controlli Colore e Gradiente
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
        
        // Imposta lo stato iniziale
        gradientControls.style.display = enableGradientCheckbox.checked ? 'block' : 'none';
        updateColors();
    }

    // Controllo Direzione Gradiente
    const gradientDirection = document.getElementById('gradient-direction');
    if (gradientDirection) {
        gradientDirection.addEventListener('change', function() {
            if (window.visualizer) {
                window.visualizer.setGradientDirection(this.value);
            }
        });
        // Imposta la direzione iniziale
        if (window.visualizer) {
            window.visualizer.setGradientDirection(gradientDirection.value);
        }
    }

    // Controllo Trasparenza
    const alphaSlider = document.getElementById('alpha-slider');
    const alphaInput = document.getElementById('alpha-input');
    if (alphaSlider && alphaInput) {
        syncSliderAndInput(alphaSlider, alphaInput, (value) => {
            if (window.visualizer) window.visualizer.setAlpha(value);
        });
        // Imposta la trasparenza iniziale
        if (window.visualizer) {
            window.visualizer.setAlpha(alphaSlider.value);
        }
    }

    const symmetricCheckbox = document.getElementById('symmetric-checkbox');
    if (symmetricCheckbox) {
        symmetricCheckbox.addEventListener('change', function() {
            if (window.visualizer) window.visualizer.setSymmetric(this.checked);
        });
        if (window.visualizer) window.visualizer.setSymmetric(symmetricCheckbox.checked);
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
 * Sincronizza un controllo di tipo slider con un input numerico.
 * @param {HTMLInputElement} slider - L'elemento slider.
 * @param {HTMLInputElement} input - L'elemento input numerico.
 * @param {Function} callback - La funzione da chiamare quando il valore cambia.
 */
function syncSliderAndInput(slider, input, callback) {
    slider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        input.value = value;
        callback(value);
    });

    input.addEventListener('input', function() {
        let value = parseFloat(this.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        
        if (isNaN(value)) return;

        value = Math.max(min, Math.min(max, value));
        this.value = value;
        slider.value = value;
        callback(value);
    });
}