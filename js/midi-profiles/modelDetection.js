/**
 * LAUNCHPAD MODEL DETECTION (modelDetection.js)
 *
 * Pure port-name -> model identification. Kept in its own module so device
 * profiles (e.g. LaunchpadRGB) can use it without importing the ProfileRegistry
 * factory, which in turn imports the profiles.
 */

/**
 * Detects model family, layout view type, product ID, and generation from a MIDI port or device name.
 * Single source of truth for all Launchpad device identification.
 * 
 * @param {string} portName
 * @returns {{
 *   isLaunchpad: boolean,
 *   family: 'legacy' | 'rgb',
 *   modelType: 'classic' | 'mk3' | 'pro' | 'pro-mk3',
 *   productId: number | null,
 *   isMk3: boolean,
 *   isPro: boolean
 * }}
 */
export function detectModel(portName) {
    const raw = (portName || '').trim();
    const lower = raw.toLowerCase();

    // Check whether port name identifies a Launchpad device across operating systems
    // Supports standard names and Windows driver abbreviations (e.g. "LPX MIDI", "MIDIIN2 (LPMiniMK3 MIDI)")
    const isLaunchpad = lower.includes('launchpad') ||
                        lower.includes('lpx') ||
                        lower.includes('lpminimk3') ||
                        lower.includes('lppromk3') ||
                        lower.includes('lpmini') ||
                        lower.includes('lppro');

    if (!isLaunchpad) {
        return {
            isLaunchpad: false,
            family: 'legacy',
            modelType: 'classic',
            productId: null,
            isMk3: false,
            isPro: false
        };
    }

    const isMk3OrNewer = lower.includes('mk3') || lower.includes('mk 3') || lower.includes('lpminimk3') || lower.includes('lppromk3');
    const isPro = lower.includes('pro') || lower.includes('lppro');

    // 1. Launchpad Pro family
    if (isPro) {
        if (isMk3OrNewer) {
            return {
                isLaunchpad: true,
                family: 'rgb',
                modelType: 'pro-mk3',
                productId: 0x0E, // Launchpad Pro Mk3 Programmer SysEx Product ID
                isMk3: true,
                isPro: true
            };
        }
        // Original Launchpad Pro (2015)
        return {
            isLaunchpad: true,
            family: 'rgb',
            modelType: 'pro',
            productId: 0x10, // Launchpad Pro 2015 Standalone SysEx ID
            isMk3: false,
            isPro: true
        };
    }

    // 2. Launchpad X
    if (lower.includes('lpx') || (lower.includes('launchpad') && /\bx\b/.test(lower))) {
        return {
            isLaunchpad: true,
            family: 'rgb',
            modelType: 'mk3',
            productId: 0x0C, // Launchpad X Programmer SysEx Product ID
            isMk3: true,
            isPro: false
        };
    }

    // 3. Mini series: Mini Mk1 and Mini Mk2 are Legacy bicolor! Only Mini Mk3 is RGB.
    const isMini = lower.includes('mini') || lower.includes('lpmini');
    if (isMini) {
        if (isMk3OrNewer) {
            return {
                isLaunchpad: true,
                family: 'rgb',
                modelType: 'mk3',
                productId: 0x0D, // Launchpad Mini Mk3 Programmer SysEx Product ID
                isMk3: true,
                isPro: false
            };
        }
        return {
            isLaunchpad: true,
            family: 'legacy',
            modelType: 'classic',
            productId: null,
            isMk3: false,
            isPro: false
        };
    }

    // 4. Launchpad Mk2 (non-mini) is RGB with Classic button layout
    if (lower.includes('mk2') || lower.includes('mk 2')) {
        return {
            isLaunchpad: true,
            family: 'rgb',
            modelType: 'classic',
            productId: 0x18, // Launchpad Mk2 SysEx Family ID
            isMk3: false,
            isPro: false
        };
    }

    // 5. Default: Launchpad Classic / Mk1 / S (Legacy bicolor)
    return {
        isLaunchpad: true,
        family: 'legacy',
        modelType: 'classic',
        productId: null,
        isMk3: false,
        isPro: false
    };
}
