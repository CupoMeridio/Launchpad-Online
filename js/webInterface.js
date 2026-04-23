/**
 * WEB INTERFACE MODULE (webInterface.js)
 * 
 * Handles all visual updates for the digital Launchpad in the web UI.
 */

import { LAUNCHPAD_COLS } from './constants.js';

/**
 * Map launchpad-webmidi colors to CSS colors for the web UI.
 */
export const webColorMap = {
    // HSL: Hue (colore), Saturation (intensità), Lightness (chiarezza)
    'red': {
        full: 'hsl(0, 100%, 50%)',
        medium: 'hsla(0, 98%, 60%, 1.00)',
        low: 'hsla(0, 100%, 73%, 1.00)'
    },
    'green': {
        full: 'hsl(120, 100%, 50%)',
        medium: 'hsla(120, 100%, 68%, 1.00)',
        low: 'hsla(120, 100%, 78%, 1.00)'
    },
    'amber': {
        full: 'hsl(45, 100%, 50%)',
        medium: 'hsla(45, 92%, 67%, 1.00)',
        low: 'hsla(44, 100%, 77%, 1.00)'
    },
    'yellow': {
        full: 'hsl(60, 100%, 50%)',
        medium: 'hsla(60, 100%, 70%, 1.00)',
        low: 'hsla(60, 100%, 78%, 1.00)'
    },
    'orange': {
        full: 'hsl(30, 100%, 50%)',
        medium: 'hsla(30, 100%, 67%, 1.00)',
        low: 'hsla(30, 100%, 77%, 1.00)'
    }
};

let cachedPads = null;

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
 */
export function setWebColor(color, p) {
    const index = p[1] * LAUNCHPAD_COLS + p[0];
    const pad = getPadElement(index);
    if (pad) {
        if (color === 'off') {
            pad.style.backgroundColor = '';
            pad.style.boxShadow = '';
            pad.classList.remove('active');
        } else {
            pad.style.backgroundColor = color;
            pad.style.boxShadow = `0 0 10px ${color}`;
            pad.classList.add('active');
        }
    }
}
