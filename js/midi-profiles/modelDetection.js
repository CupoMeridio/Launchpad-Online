/**
 * LAUNCHPAD MODEL DETECTION (modelDetection.js)
 *
 * Pure port-name -> model identification. Kept in its own module so device
 * profiles (e.g. LaunchpadRGB) can use it without importing the ProfileRegistry
 * factory, which in turn imports the profiles.
 */

/**
 * @typedef {object} LaunchpadModel
 * @property {boolean} isLaunchpad
 * @property {'legacy'|'rgb'} family
 * @property {'classic'|'mk3'|'pro'|'pro-mk3'} modelType
 * @property {number|null} productId - SysEx product id (RGB models).
 * @property {boolean} isMk3
 * @property {boolean} isPro
 */

const MODELS = Object.freeze({
    // Launchpad Pro Mk3 (Programmer SysEx product id)
    proMk3: { family: 'rgb', modelType: 'pro-mk3', productId: 0x0E, isMk3: true, isPro: true },
    // Original Launchpad Pro (2015, Standalone SysEx id)
    pro: { family: 'rgb', modelType: 'pro', productId: 0x10, isMk3: false, isPro: true },
    // Launchpad X and Mini Mk3 (Programmer SysEx product ids)
    x: { family: 'rgb', modelType: 'mk3', productId: 0x0C, isMk3: true, isPro: false },
    miniMk3: { family: 'rgb', modelType: 'mk3', productId: 0x0D, isMk3: true, isPro: false },
    // Launchpad Mk2 (non-mini): RGB with the classic button layout
    mk2: { family: 'rgb', modelType: 'classic', productId: 0x18, isMk3: false, isPro: false },
    // Launchpad Classic / Mk1 / S and Mini Mk1-Mk2: legacy bicolor
    legacy: { family: 'legacy', modelType: 'classic', productId: null, isMk3: false, isPro: false }
});

/**
 * Port-name rules, checked in order (the first match wins). Names differ across
 * operating systems and drivers, e.g. Windows abbreviations such as "LPX MIDI"
 * or "MIDIIN2 (LPMiniMK3 MIDI)".
 */
const MODEL_RULES = [
    { matches: name => name.isPro && name.isMk3OrNewer, model: MODELS.proMk3 },
    { matches: name => name.isPro, model: MODELS.pro },
    { matches: name => name.has('lpx') || (name.has('launchpad') && /\bx\b/.test(name.lower)), model: MODELS.x },
    // Only the Mini Mk3 is RGB: Mini Mk1/Mk2 are legacy bicolor.
    { matches: name => name.isMini && name.isMk3OrNewer, model: MODELS.miniMk3 },
    { matches: name => name.isMini, model: MODELS.legacy },
    { matches: name => name.has('mk2') || name.has('mk 2'), model: MODELS.mk2 }
];

const LAUNCHPAD_MARKERS = ['launchpad', 'lpx', 'lpminimk3', 'lppromk3', 'lpmini', 'lppro'];

/**
 * Pre-computes the features of a port name the rules look at.
 * @param {string} portName
 */
function describePortName(portName) {
    const lower = (portName || '').trim().toLowerCase();
    const has = token => lower.includes(token);
    return {
        lower,
        has,
        isLaunchpad: LAUNCHPAD_MARKERS.some(has),
        isMk3OrNewer: has('mk3') || has('mk 3') || has('lpminimk3') || has('lppromk3'),
        isPro: has('pro') || has('lppro'),
        isMini: has('mini') || has('lpmini')
    };
}

/**
 * Detects model family, layout view type, product ID, and generation from a MIDI port or device name.
 * Single source of truth for all Launchpad device identification.
 * @param {string} portName
 * @returns {LaunchpadModel} A new object on every call.
 */
export function detectModel(portName) {
    const name = describePortName(portName);
    if (!name.isLaunchpad) {
        return { isLaunchpad: false, ...MODELS.legacy };
    }
    const rule = MODEL_RULES.find(candidate => candidate.matches(name));
    return { isLaunchpad: true, ...(rule ? rule.model : MODELS.legacy) };
}
