/**
 * =============================================================================
 * PHYSICAL INTERFACE MODULE (physicalInterface.js)
 * =============================================================================
 * 
 * Handles all communication with the physical Launchpad device via WebMIDI.
 */

let launchpad = null;

/**
 * Sets the launchpad instance to be used.
 * @param {object} lp - The launchpad-webmidi instance.
 */
export function setLaunchpadInstance(lp) {
    console.log("[PHYSICAL] Launchpad instance set:", lp);
    launchpad = lp;
}

/**
 * Gets the current launchpad instance.
 * @returns {object|null}
 */
export function getLaunchpad() {
    return launchpad;
}

/**
 * Sets color on the physical launchpad.
 * @param {object} colorObj - The color object from launchpad-webmidi.
 * @param {number[]} p - [x, y] coordinates.
 */
export function setPhysicalColor(colorObj, p) {
    if (launchpad) {
        launchpad.col(colorObj, p);
    }
}

/**
 * Utility to get color objects from the launchpad instance safely.
 * @param {string} colorName - 'red', 'green', 'amber', 'off'.
 * @param {string} [level] - 'full', 'medium', 'low'.
 * @returns {object|null}
 */
export function getLpColor(colorName, level = null) {
    if (!launchpad) return null;
    if (colorName === 'off') return launchpad.off;
    
    const base = launchpad[colorName];
    if (!base) return null;
    
    if (level && base[level]) {
        return base[level];
    }
    return base;
}
