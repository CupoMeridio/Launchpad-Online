/**
 * PROFILE REGISTRY (ProfileRegistry.js)
 * 
 * Factory that detects connected Launchpad models, selects the right MIDI ports
 * (filtering out virtual DAW ports), and instantiates the appropriate DeviceProfile.
 */

import { LaunchpadLegacy } from './LaunchpadLegacy.js';
import { LaunchpadRGB } from './LaunchpadRGB.js';

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

export class ProfileRegistry {
    /**
     * Finds and pairs the best input and output ports for a Launchpad.
     * On modern devices (Mk3 / X / Pro), filters out DAW control ports and prefers MIDI ports.
     * 
     * @param {IterableIterator<MIDIInput>} inputs
     * @param {IterableIterator<MIDIOutput>} outputs
     * @returns {{ input: MIDIInput|null, output: MIDIOutput|null, deviceName: string }}
     */
    static findLaunchpadPorts(inputs, outputs) {
        const inputList = Array.from(inputs || []);
        const outputList = Array.from(outputs || []);

        const launchpadInputs = inputList.filter(port => detectModel(port.name).isLaunchpad);
        const launchpadOutputs = outputList.filter(port => detectModel(port.name).isLaunchpad);

        if (launchpadInputs.length === 0 || launchpadOutputs.length === 0) {
            return { input: null, output: null, deviceName: '' };
        }

        // Prefer ports that are NOT dedicated DAW ports (e.g. prefer "MIDI" or "LPMiniMK3 MIDI" over "DAW")
        const selectBestPort = (ports) => {
            if (ports.length === 1) return ports[0];
            const nonDaw = ports.filter(p => !((p.name || '').toLowerCase().includes('daw')));
            if (nonDaw.length > 0) {
                // If there's an explicit "midi" or "custom" port, prefer it
                const midiExplicit = nonDaw.find(p => (p.name || '').toLowerCase().includes('midi'));
                return midiExplicit || nonDaw[0];
            }
            return ports[0];
        };

        const chosenInput = selectBestPort(launchpadInputs);
        const chosenOutput = selectBestPort(launchpadOutputs);
        const deviceName = chosenInput.name || chosenOutput.name || 'Launchpad';

        return { input: chosenInput, output: chosenOutput, deviceName };
    }

    /**
     * Resolves and returns the corresponding DeviceProfile for a given device.
     * @param {string} portName
     * @param {MIDIOutput|null} outputPort
     * @param {MIDIInput|null} inputPort
     * @returns {import('./DeviceProfile.js').DeviceProfile}
     */
    static getProfile(portName, outputPort, inputPort) {
        const info = detectModel(portName);
        console.log(`[MIDI Profile] Resolving profile for device: "${portName}" -> family: ${info.family}, model: ${info.modelType}`);

        if (info.family === 'rgb') {
            return new LaunchpadRGB(outputPort, inputPort, portName, info);
        }

        return new LaunchpadLegacy(outputPort, inputPort, portName, info);
    }

    /**
     * Determines the physical layout/view model type for a device name.
     * @param {string} portName
     * @returns {'classic' | 'mk3' | 'pro' | 'pro-mk3'}
     */
    static getModelType(portName) {
        return detectModel(portName).modelType;
    }
}
