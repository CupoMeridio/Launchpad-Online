/**
 * DEVICE PROFILE BASE CLASS (DeviceProfile.js)
 * 
 * Abstract base class for all grid-based MIDI controllers.
 * Subclasses implement model-specific MIDI mapping (note vs CC),
 * color palette representations, and initialization routines (such as SysEx).
 */

export class DeviceProfile {
    /**
     * @param {MIDIOutput|null} outputPort - The Web MIDI output port.
     * @param {MIDIInput|null} inputPort - The Web MIDI input port.
     * @param {string} name - Human-readable device profile name.
     * @param {'legacy'|'rgb'} type - Controller color capability type.
     */
    constructor(outputPort, inputPort, name = 'Generic Device', type = 'legacy') {
        this.midiOut = outputPort;
        this.midiIn = inputPort;
        this.name = name;
        this.type = type;
    }

    /**
     * Initializes the controller (e.g. handshake, entering programmer/custom mode).
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log(`[MIDI Profile] Initializing ${this.name}...`);
        this.clear();
    }

    /**
     * Restores default state before disconnecting (e.g. exiting programmer mode).
     * @returns {Promise<void>}
     */
    async dispose() {
        this.clear();
    }

    /**
     * Clears all lights / resets LEDs on the device.
     */
    clear() {
        if (!this.midiOut) return;
        try {
            this.midiOut.send([0xB0, 0x00, 0x00]);
        } catch (_) {}
    }

    /**
     * Parses an incoming raw MIDI message into normalized Launchpad coordinates.
     * Normalized coordinates:
     * - Main grid: x: 0..7 (columns left-to-right), y: 0..7 (rows top-to-bottom)
     * - Scene/Page buttons: x: 8, y: 0..7
     * - Automap/Mode buttons: x: 0..7, y: 8
     * 
     * @param {Uint8Array|number[]} msg - Raw MIDI message [status, data1, data2].
     * @returns {{ x: number, y: number, pressed: boolean }|null}
     */
    parseMessage(msg) {
        return null;
    }

    /**
     * Builds raw MIDI message bytes to set an LED at (x, y) with colorCode.
     * @param {number} x - Horizontal coordinate (0..8).
     * @param {number} y - Vertical coordinate (0..8).
     * @param {number} colorCode - MIDI velocity / color index.
     * @returns {number[]|null} Array of 3 bytes [status, noteOrCC, velocity] or null.
     */
    buildColorMessage(x, y, colorCode) {
        return null;
    }

    /**
     * Resolves a color name and brightness level to a model-specific color descriptor.
     * @param {string} colorName - e.g. 'red', 'green', 'amber', 'yellow', 'orange', 'blue', etc.
     * @param {'full'|'medium'|'low'|null} [level] - Optional brightness level.
     * @returns {{ code: number, full?: { code: number }, medium?: { code: number }, low?: { code: number } }|null}
     */
    getColor(colorName, level = null) {
        return null;
    }

    /**
     * Switches hardware internal layout (e.g. User 1 vs Session) if supported.
     * @param {number} modeIndex - Mode index (e.g. 4-7).
     */
    setLayout(modeIndex) {}
}
