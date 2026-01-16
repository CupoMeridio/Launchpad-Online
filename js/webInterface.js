/**
 * =============================================================================
 * WEB INTERFACE MODULE (webInterface.js)
 * =============================================================================
 * 
 * Handles all visual updates for the digital Launchpad in the web UI.
 */

/**
 * Map launchpad-webmidi colors to CSS colors for the web UI.
 */
export const webColorMap = {
    // HSL: Hue (colore), Saturation (intensità), Lightness (chiarezza)
    'red': { 
        full: 'hsl(0, 100%, 50%)', 
        medium: 'hsl(0, 70%, 70%)', 
        low: 'hsl(0, 50%, 85%)' 
    },
    'green': { 
        full: 'hsl(120, 100%, 50%)', 
        medium: 'hsl(120, 70%, 70%)', 
        low: 'hsl(120, 50%, 85%)' 
    },
    'amber': { 
        full: 'hsl(45, 100%, 50%)', 
        medium: 'hsl(45, 70%, 70%)', 
        low: 'hsl(45, 50%, 85%)' 
    }
};

/**
 * Sets color on the digital (web) launchpad.
 * @param {string} color - CSS color or 'off'.
 * @param {number[]} p - [x, y] coordinates.
 */
export function setWebColor(color, p) {
    const pads = document.querySelectorAll('.grid-item');
    // The grid is 8x8, indexed from 0 to 63.
    // Assuming x is column and y is row.
    const index = p[1] * 8 + p[0];
    if (pads[index]) {
        if (color === 'off') {
            pads[index].style.backgroundColor = '';
            pads[index].style.boxShadow = '';
            pads[index].classList.remove('active');
        } else {
            pads[index].style.backgroundColor = color;
            pads[index].style.boxShadow = `0 0 10px ${color}`;
            pads[index].classList.add('active');
        }
    }
}
