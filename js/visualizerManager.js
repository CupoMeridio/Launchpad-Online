/**
 * VISUALIZER MANAGER (visualizerManager.js)
 * 
 * Mediator module that manages the visualizer instance without exposing it globally.
 * This module provides a clean API for controlling the visualizer while avoiding
 * the anti-pattern of window.visualizer globals.
 * 
 * Pattern: Mediator/Facade - Centralizes access to visualizer functionality.
 */

let visualizerInstance = null;

/**
 * Sets the visualizer instance (called by app.js after initialization).
 * @param {Visualizer} instance - The visualizer instance to manage.
 */
export function setVisualizer(instance) {
    visualizerInstance = instance;
}

/**
 * Gets the current visualizer instance (only for app.js during initialization).
 * @returns {Visualizer|null} The visualizer instance or null if not initialized.
 */
export function getVisualizer() {
    return visualizerInstance;
}

/**
 * Checks if the visualizer is initialized.
 * @returns {boolean} True if visualizer is available.
 */
export function isVisualizerReady() {
    return visualizerInstance !== null;
}

/**
 * Sets the smoothing value of the analyser.
 * @param {number} value - Smoothing constant (0-0.95).
 */
export function setSmoothing(value) {
    if (visualizerInstance) {
        visualizerInstance.setSmoothing(value);
    }
}

/**
 * Sets the visualizer colors.
 * @param {string} color1 - First color (hex).
 * @param {string} color2 - Second color (hex).
 */
export function setColors(color1, color2) {
    if (visualizerInstance) {
        visualizerInstance.setColors(color1, color2);
    }
}

/**
 * Sets the gradient direction.
 * @param {string} direction - Direction: 'vertical', 'vertical-reverse', 'horizontal', 'horizontal-reverse'.
 */
export function setGradientDirection(direction) {
    if (visualizerInstance) {
        visualizerInstance.setGradientDirection(direction);
    }
}

/**
 * Sets the transparency (alpha) of the visualizer.
 * @param {number} alpha - Alpha value (0-1).
 */
export function setAlpha(alpha) {
    if (visualizerInstance) {
        visualizerInstance.setAlpha(alpha);
    }
}

/**
 * Enables or disables symmetric visualization.
 * @param {boolean} enabled - True to enable symmetry.
 */
export function setSymmetric(enabled) {
    if (visualizerInstance) {
        visualizerInstance.setSymmetric(enabled);
    }
}

/**
 * Sets the symmetry reversal mode.
 * @param {boolean} reverse - True for reverse symmetry.
 */
export function setSymmetryReverse(reverse) {
    if (visualizerInstance) {
        visualizerInstance.setSymmetryReverse(reverse);
    }
}

/**
 * Enables or disables bass pulse effect.
 * @param {boolean} enabled - True to enable bass pulse.
 */
export function setBassPulse(enabled) {
    if (visualizerInstance) {
        visualizerInstance.setBassPulse(enabled);
    }
}

/**
 * Sets the bass detection threshold.
 * @param {number} threshold - Threshold value for bass detection.
 */
export function setBassThreshold(threshold) {
    if (visualizerInstance) {
        visualizerInstance.setBassThreshold(threshold);
    }
}

/**
 * Sets the visualizer display mode.
 * @param {string} mode - Mode name ('off', 'bars', 'waveform', etc.).
 */
export function setMode(mode) {
    if (visualizerInstance) {
        visualizerInstance.setMode(mode);
    }
}
