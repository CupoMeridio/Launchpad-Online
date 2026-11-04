/**
 * WEB INTERFACE MODULE (webInterface.js)
 * 
 * Handles all visual updates for the digital Launchpad in the web UI.
 */

import { LAUNCHPAD_COLS } from './constants.js';

/**
 * Map Launchpad hardware colors to pure saturated hues for the web UI.
 * Intensity/dimming is applied by the emissive --led-level layer in CSS,
 * so every color exposes a single `baseColor` hue.
 */
export const webColorMap = {
    'red': { baseColor: 'hsl(0, 100%, 50%)' },
    'green': { baseColor: 'hsl(120, 100%, 50%)' },
    'amber': { baseColor: 'hsl(45, 100%, 50%)' },
    'yellow': { baseColor: 'hsl(60, 100%, 50%)' },
    'orange': { baseColor: 'hsl(30, 100%, 50%)' },
    // Modern RGB palette extensions
    'blue': { baseColor: 'hsl(210, 100%, 50%)' },
    'cyan': { baseColor: 'hsl(180, 100%, 50%)' },
    'purple': { baseColor: 'hsl(280, 100%, 50%)' },
    'pink': { baseColor: 'hsl(330, 100%, 50%)' },
    'white': { baseColor: 'hsl(0, 0%, 100%)' }
};

/**
 * Emissive levels applied through the --led-level CSS custom property.
 * Shared by the fade engine so numeric levels never drift from these names.
 */
export const LED_LEVELS = {
    full: 1.0,
    medium: 0.65,
    low: 0.35,
    off: 0
};

let cachedPads = null;

/**
 * Clears the cached pad DOM elements so that subsequent queries re-read the DOM.
 */
export function invalidatePadCache() {
    cachedPads = null;
}

/**
 * Initializes the pad cache for the web UI.
 */
function ensurePadCache() {
    if (!cachedPads || cachedPads.length === 0) {
        cachedPads = document.querySelectorAll('.grid-item');
    }
}

/**
 * Gets a specific pad element by index.
 * @param {number} index - The pad index (0-63).
 * @returns {Element|null} The pad DOM element or null.
 */
export function getPadElement(index) {
    ensurePadCache();
    if (index >= 0 && index < cachedPads.length) {
        return cachedPads[index];
    }
    return null;
}

/**
 * Sets color on the digital (web) launchpad.
 * @param {string} color - CSS color or 'off'.
 * @param {number[]} p - [x, y] coordinates.
 * @param {number|string} [level] - Emission level, either a 0..1 number or an LED_LEVELS name.
 */
export function setWebColor(color, p, level = 1.0) {
    const index = p[1] * LAUNCHPAD_COLS + p[0];
    const pad = getPadElement(index);
    if (!pad) return;

    const numericLevel = typeof level === 'number'
        ? Math.max(0, Math.min(1, level))
        : (LED_LEVELS[level] ?? 1.0);

    // 'off' and a zero level both clear the emissive layer.
    if (color === 'off' || numericLevel <= 0) {
        pad.style.removeProperty('--led-color');
        pad.style.removeProperty('--led-level');
        pad.style.removeProperty('background-color');
        pad.style.removeProperty('box-shadow');
        pad.classList.remove('active');
        return;
    }

    pad.style.setProperty('--led-color', color);
    pad.style.setProperty('--led-level', String(numericLevel));
    if (pad.style.backgroundColor) pad.style.removeProperty('background-color');
    if (pad.style.boxShadow) pad.style.removeProperty('box-shadow');
    pad.classList.add('active');
}

/**
 * Updates the visual selection state of the side page buttons on the Launchpad.
 * @param {number} pageIndex
 */
export function updatePageButtonHighlight(pageIndex) {
    const sidePageButtons = document.querySelectorAll('#Launchpad .grid-item-menu[data-page]');
    sidePageButtons.forEach((btn, i) => {
        btn.classList.toggle('selected', i === pageIndex);
    });
}

/**
 * Updates the visual selection state of the mode buttons on the Launchpad.
 * @param {number} modeIndex
 */
export function updateModeButtonHighlight(modeIndex) {
    const modeButtons = document.querySelectorAll('#Launchpad .grid-item-menu[data-mode]');
    modeButtons.forEach((btn) => {
        const btnMode = parseInt(btn.dataset.mode, 10);
        btn.classList.toggle('selected', btnMode === modeIndex);
    });
}

