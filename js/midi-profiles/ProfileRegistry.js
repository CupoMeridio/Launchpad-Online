/**
 * PROFILE REGISTRY (ProfileRegistry.js)
 * 
 * Factory that detects connected Launchpad models, selects the right MIDI ports
 * (filtering out virtual DAW ports), and instantiates the appropriate DeviceProfile.
 */

import { LaunchpadLegacy } from './LaunchpadLegacy.js';
import { LaunchpadRGB } from './LaunchpadRGB.js';

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

        const launchpadInputs = inputList.filter(port => (port.name || '').toLowerCase().includes('launchpad'));
        const launchpadOutputs = outputList.filter(port => (port.name || '').toLowerCase().includes('launchpad'));

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
        const name = (portName || '').toLowerCase();

        console.log(`[MIDI Profile] Resolving profile for device: "${portName}"`);

        // Mini Mk1 and Mini Mk2 are Legacy bicolor! Only Mini Mk3 is RGB.
        const isMini = name.includes('mini');
        const isMk3OrNewer = name.includes('mk3') || name.includes('mk 3') || name.includes('lpminimk3');
        if (isMini && !isMk3OrNewer) {
            return new LaunchpadLegacy(outputPort, inputPort, portName);
        }

        // RGB models (Mk2, Mini Mk3, Launchpad X, Launchpad Pro)
        const isRgb = isMk3OrNewer ||
                      name.includes('mk2') ||
                      name.includes('mk 2') ||
                      name.includes('pro') ||
                      name.includes('lpx');

        if (isRgb) {
            return new LaunchpadRGB(outputPort, inputPort, portName);
        }

        // Default: Legacy Launchpad (Mk1, S, Classic)
        return new LaunchpadLegacy(outputPort, inputPort, portName);
    }
}
