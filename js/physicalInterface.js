/**
 * =============================================================================
 * PHYSICAL INTERFACE MODULE (physicalInterface.js)
 * =============================================================================
 * 
 * Handles all communication with the physical Launchpad device via WebMIDI.
 */

let launchpad = null;
const colorCache = new Map();
const pendingUpdates = new Map(); // Key: key index, Value: {cmd, vel}

/**
 * Sets the launchpad instance to be used.
 * @param {object} lp - The launchpad-webmidi instance.
 */
export function setLaunchpadInstance(lp) {
    console.log("[PHYSICAL] Launchpad instance set:", lp);
    launchpad = lp;
    colorCache.clear();
    pendingUpdates.clear();
}

/**
 * Gets the current launchpad instance.
 * @returns {object|null}
 */
export function getLaunchpad() {
    return launchpad;
}

/**
 * Sets color on the physical launchpad using a batching system.
 * @param {object|number} colorObj - The color object or code.
 * @param {number[]} p - [x, y] coordinates.
 * @param {boolean} immediate - If true, sends the message immediately instead of buffering.
 */
export function setPhysicalColor(colorObj, p, immediate = false) {
    if (!launchpad || colorObj === null || colorObj === undefined) return;

    const x = p[0];
    const y = p[1];

    // Calculate MIDI command and key (matches launchpad-webmidi logic)
    const cmd = y >= 8 ? 0xb0 : 0x90;
    const key = y >= 8 ? 0x68 + x : 0x10 * y + x;
    const vel = typeof colorObj === 'number' ? colorObj : (colorObj.code !== undefined ? colorObj.code : 0);

    if (immediate) {
        launchpad.col(colorObj, p);
        pendingUpdates.delete(key);
    } else {
        pendingUpdates.set(key, { cmd, vel });
    }
}

/**
 * Sends all buffered MIDI updates to the device in a single batch.
 * Should be called at the end of an animation frame or interaction cycle.
 */
export function flushPhysicalColors() {
    if (launchpad && launchpad.midiOut && pendingUpdates.size > 0) {
        const batch = [];
        pendingUpdates.forEach((val, key) => {
            batch.push(val.cmd, key, val.vel);
        });

        try {
            launchpad.midiOut.send(new Uint8Array(batch));
        } catch (e) {
            console.warn("[PHYSICAL] Failed to send MIDI batch:", e);
        }

        pendingUpdates.clear();
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

    const cacheKey = `${colorName}_${level || 'default'}`;
    if (colorCache.has(cacheKey)) {
        return colorCache.get(cacheKey);
    }

    let color;
    if (colorName === 'off') {
        color = launchpad.off;
    } else if (colorName === 'orange') {
        // Custom orange for Launchpad S/Mini/Classic (r=3, g=1 or 2)
        // Code 35 is a good orange (r=3, g=2)
        color = { code: 35, full: { code: 35 }, medium: { code: 19 }, low: { code: 18 } };
    } else {
        const base = launchpad[colorName];
        if (!base) return null;
        color = (level && base[level]) ? base[level] : base;
    }

    colorCache.set(cacheKey, color);
    return color;
}