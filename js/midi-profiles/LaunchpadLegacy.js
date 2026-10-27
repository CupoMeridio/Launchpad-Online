/**
 * LAUNCHPAD LEGACY PROFILE (LaunchpadLegacy.js)
 * 
 * Supports first-generation Novation Launchpad controllers:
 * - Launchpad Classic / Mk1
 * - Launchpad S
 * - Launchpad Mini (Mk1 and Mk2)
 * 
 * Uses standard note mapping: (y * 16) + x, CC 104-111 for top buttons,
 * and 2-bit per color (Red & Green) velocity byte format.
 */

import { DeviceProfile } from './DeviceProfile.js';

export class LaunchpadLegacy extends DeviceProfile {
    /**
     * @param {MIDIOutput|null} outputPort
     * @param {MIDIInput|null} inputPort
     * @param {string} [name]
     */
    constructor(outputPort, inputPort, name = 'Launchpad Legacy (Mk1/S/Mini)') {
        super(outputPort, inputPort, name, 'legacy');

        // Bicolor palette: { code, full, medium, low }
        this.colorPalette = {
            'off': { code: 0, full: { code: 0 }, medium: { code: 0 }, low: { code: 0 } },
            'red': { code: 3, full: { code: 3 }, medium: { code: 2 }, low: { code: 1 } },
            'green': { code: 48, full: { code: 48 }, medium: { code: 32 }, low: { code: 16 } },
            'amber': { code: 51, full: { code: 51 }, medium: { code: 34 }, low: { code: 17 } },
            'yellow': { code: 50, full: { code: 50 }, medium: { code: 33 }, low: { code: 17 } },
            'orange': { code: 35, full: { code: 35 }, medium: { code: 19 }, low: { code: 18 } }
        };

        // Fallback substitutions for colors not physically available on bi-color LEDs
        this.colorFallbacks = {
            'blue': 'green',
            'cyan': 'green',
            'purple': 'red',
            'pink': 'red',
            'white': 'amber'
        };
    }

    /**
     * Reset and select session layout (layout 1).
     */
    async initialize() {
        await super.initialize();
        if (this.midiOut) {
            try {
                // Set default layout 1 (session / normal)
                this.midiOut.send([0xB0, 0x00, 0x01]);
            } catch (_) {}
        }
    }


    /**
     * Parse incoming MIDI message:
     * - Status 0x90 (Note On) or 0x80 (Note Off)
     * - Status 0xB0 (Control Change for Automap buttons)
     * 
     * @param {Uint8Array|number[]} msg
     * @returns {{ x: number, y: number, pressed: boolean }|null}
     */
    parseMessage(msg) {
        if (!msg || msg.length < 3) return null;

        const status = msg[0] & 0xF0;
        const data1 = msg[1];
        const data2 = msg[2];

        // 0x90 = Note On, 0x80 = Note Off
        if (status === 0x90 || status === 0x80) {
            const pressed = (status === 0x90 && data2 > 0);
            const x = data1 % 16;
            const y = Math.floor(data1 / 16);

            // Grid pads (x: 0..7, y: 0..7) or Scene buttons (x: 8, y: 0..7)
            if (x <= 8 && y < 8) {
                return { x, y, pressed };
            }
        } else if (status === 0xB0) {
            // Top row: Automap / Mode buttons (CC 104 to 111)
            if (data1 >= 104 && data1 <= 111) {
                const x = data1 - 104;
                const y = 8;
                const pressed = data2 > 0;
                return { x, y, pressed };
            }
        }

        return null;
    }

    /**
     * Builds MIDI bytes for Legacy Launchpad.
     * @param {number} x
     * @param {number} y
     * @param {number} colorCode
     * @returns {number[]}
     */
    buildColorMessage(x, y, colorCode) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 8 || y < 0 || y > 8) {
            return null;
        }
        if (y >= 8) {
            // Automap button (top row) -> CC 104 + x
            return [0xB0, 104 + x, colorCode];
        }
        // Grid pad or Scene button -> Note (y * 16) + x
        return [0x90, (y * 16) + x, colorCode];
    }

    /**
     * Resolves color descriptor with fallback.
     * @param {string} colorName
     * @param {'full'|'medium'|'low'|null} [level]
     */
    getColor(colorName, level = null) {
        const resolvedName = this.colorPalette[colorName] ? colorName : (this.colorFallbacks[colorName] || 'amber');
        const base = this.colorPalette[resolvedName] || this.colorPalette['off'];
        if (level && base[level]) {
            return base[level];
        }
        return base;
    }

    /**
     * Switches hardware internal layout (e.g. User 1 vs Session).
     * @param {number} modeIndex
     */
    setLayout(modeIndex) {
        if (!this.midiOut) return;
        let layoutCode = 0x01;
        if (modeIndex === 4 || modeIndex === 7) layoutCode = 0x00;
        else if (modeIndex === 5) layoutCode = 0x01;
        else if (modeIndex === 6) layoutCode = 0x02;

        try {
            this.midiOut.send([0xB0, 0x00, layoutCode]);
        } catch (_) {}
    }
}
