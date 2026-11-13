/**
 * PROFILE REGISTRY (ProfileRegistry.js)
 * 
 * Factory that detects connected Launchpad models, selects the right MIDI ports
 * (filtering out virtual DAW ports), and instantiates the appropriate DeviceProfile.
 */

import { LaunchpadLegacy } from './LaunchpadLegacy.js';
import { LaunchpadRGB } from './LaunchpadRGB.js';
import { detectModel } from './modelDetection.js';
import { debug } from '../logger.js';

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
        debug(`[MIDI Profile] Resolving profile for device: "${portName}" -> family: ${info.family}, model: ${info.modelType}`);

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
