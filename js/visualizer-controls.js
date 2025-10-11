import { audioEngine } from './audio.js';

/**
 * Inizializza i controlli per il visualizzatore (es. slider della fluidità).
 */
export function initializeVisualizerControls() {
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');

    if (smoothingSlider && smoothingInput) {
        const initialValue = audioEngine.getAnalyser().smoothingTimeConstant;
        smoothingSlider.value = initialValue;
        smoothingInput.value = initialValue;

        function syncSmoothingControls(slider, input) {
            slider.addEventListener('input', function() {
                input.value = this.value;
                if (window.visualizer) {
                    window.visualizer.setSmoothing(this.value);
                }
            });

            input.addEventListener('input', function() {
                let value = parseFloat(this.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                
                value = Math.max(min, Math.min(max, value));
                this.value = value;
                slider.value = value;
                if (window.visualizer) {
                    window.visualizer.setSmoothing(this.value);
                }
            });
        }
        syncSmoothingControls(smoothingSlider, smoothingInput);
    }
}