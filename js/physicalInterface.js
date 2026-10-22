/**
 * PHYSICAL INTERFACE MODULE (physicalInterface.js)
 * 
 * Handles all communication with the physical Launchpad device via active DeviceProfile.
 * Supports batching, immediate color sends, and palette lookups across Legacy and RGB hardware.
 */

let activeProfile = null;
const colorCache = new Map();
const pendingUpdates = new Map(); // Key: (status << 8) | key, Value: number[] msg

/**
 * Sets the active device profile.
 * @param {import('./midi-profiles/DeviceProfile.js').DeviceProfile|null} profile
 */
export function setDeviceProfile(profile) {
    console.log("[PHYSICAL] Device profile set:", profile ? profile.name : "null");
    activeProfile = profile;
    colorCache.clear();
    pendingUpdates.clear();
}

/**
 * Backward compatibility alias for setDeviceProfile.
 * @param {object|null} profile
 */
export function setLaunchpadInstance(profile) {
    setDeviceProfile(profile);
}

/**
 * Gets the current active device profile.
 * @returns {import('./midi-profiles/DeviceProfile.js').DeviceProfile|null}
 */
export function getDeviceProfile() {
    return activeProfile;
}

/**
 * Backward compatibility alias for getDeviceProfile.
 * @returns {object|null}
 */
export function getLaunchpad() {
    return activeProfile;
}

/**
 * Sets color on the physical Launchpad using a batching system.
 * @param {object|number} colorObj - The color object or velocity code.
 * @param {number[]} p - [x, y] coordinates.
 * @param {boolean} [immediate=false] - If true, sends the message immediately instead of buffering.
 */
export function setPhysicalColor(colorObj, p, immediate = false) {
    if (!activeProfile || colorObj === null || colorObj === undefined) return;

    const x = p[0];
    const y = p[1];
    const vel = typeof colorObj === 'number' ? colorObj : (colorObj?.code !== undefined ? colorObj.code : 0);

    const msg = activeProfile.buildColorMessage(x, y, vel);
    if (!msg || !activeProfile.midiOut) return;

    if (immediate) {
        try {
            activeProfile.midiOut.send(msg);
        } catch (_) {}
        const keyId = (msg[0] << 8) | msg[1];
        pendingUpdates.delete(keyId);
    } else {
        const keyId = (msg[0] << 8) | msg[1];
        pendingUpdates.set(keyId, msg);
    }
}

/**
 * Sends all buffered MIDI updates to the device in a single batch.
 * Should be called at the end of an animation frame or interaction cycle.
 */
export function flushPhysicalColors() {
    if (activeProfile && activeProfile.midiOut && pendingUpdates.size > 0) {
        const batch = [];
        pendingUpdates.forEach(msg => {
            batch.push(msg[0], msg[1], msg[2]);
        });

        try {
            activeProfile.midiOut.send(new Uint8Array(batch));
        } catch (e) {
            console.warn("[PHYSICAL] Failed to send MIDI batch:", e);
        }

        pendingUpdates.clear();
    }
}

/**
 * Utility to get color objects safely mapped for the active controller.
 * @param {string} colorName - e.g. 'red', 'green', 'amber', 'yellow', 'orange', 'blue', etc.
 * @param {string} [level] - 'full', 'medium', 'low'.
 * @returns {object|null}
 */
export function getLpColor(colorName, level = null) {
    if (!activeProfile) return null;

    const cacheKey = `${colorName}_${level || 'default'}`;
    if (colorCache.has(cacheKey)) {
        return colorCache.get(cacheKey);
    }

    const color = activeProfile.getColor(colorName, level);
    if (!color) return null;

    colorCache.set(cacheKey, color);
    return color;
}