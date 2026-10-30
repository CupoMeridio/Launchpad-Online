/**
 * LAUNCHPAD RGB PROFILE (LaunchpadRGB.js)
 * 
 * Supports modern Novation Launchpad RGB controllers:
 * - Launchpad Mk2
 * - Launchpad Mini Mk3
 * - Launchpad X
 * - Launchpad Pro (Mk1 / Mk2 / Mk3)
 * 
 * Features:
 * - 127-color Novation velocity palette (full RGB spectrum)
 * - Programmer Mode switching via SysEx
 * - Decimal coordinate layout ((8 - y) * 10 + x + 1)
 */

import { DeviceProfile } from './DeviceProfile.js';
import { detectModel } from './ProfileRegistry.js';
import { debug } from '../logger.js';

export class LaunchpadRGB extends DeviceProfile {
    /**
     * @param {MIDIOutput|null} outputPort
     * @param {MIDIInput|null} inputPort
     * @param {string} [name]
     * @param {object|null} [modelInfo]
     */
    constructor(outputPort, inputPort, name = 'Launchpad RGB (Mk2/Pro/X/Mini Mk3)', modelInfo = null) {
        super(outputPort, inputPort, name, 'rgb');

        const info = modelInfo || detectModel(name);
        this.productId = info.productId;
        this.isPro = info.isPro;
        this.isMk3 = info.isMk3;

        // Novation standard 127-color RGB velocity palette
        this.colorPalette = {
            'off': { code: 0, full: { code: 0 }, medium: { code: 0 }, low: { code: 0 } },
            'red': { code: 5, full: { code: 5 }, medium: { code: 6 }, low: { code: 7 } },
            'green': { code: 21, full: { code: 21 }, medium: { code: 22 }, low: { code: 23 } },
            'amber': { code: 11, full: { code: 11 }, medium: { code: 10 }, low: { code: 9 } },
            'yellow': { code: 13, full: { code: 13 }, medium: { code: 14 }, low: { code: 15 } },
            'orange': { code: 9, full: { code: 9 }, medium: { code: 10 }, low: { code: 11 } },
            'blue': { code: 45, full: { code: 45 }, medium: { code: 46 }, low: { code: 47 } },
            'cyan': { code: 37, full: { code: 37 }, medium: { code: 38 }, low: { code: 39 } },
            'purple': { code: 53, full: { code: 53 }, medium: { code: 54 }, low: { code: 55 } },
            'pink': { code: 95, full: { code: 95 }, medium: { code: 94 }, low: { code: 93 } },
            'white': { code: 3, full: { code: 3 }, medium: { code: 2 }, low: { code: 1 } }
        };
    }

    /**
     * Detect Novation Product ID for Programmer Mode SysEx commands.
     * @param {string} portName
     * @returns {number|null}
     */
    detectProductId(portName) {
        return detectModel(portName).productId;
    }

    /**
     * Switch device into Programmer/Custom Mode and clear pads.
     */
    async initialize() {
        debug(`[MIDI Profile] Initializing ${this.name}...`);
        if (this.midiOut) {
            try {
                if (this.isMk3 && this.productId) {
                    // Mk3 Programmer Mode SysEx: [F0, 00, 20, 29, 02, PID, 0E, 01, F7]
                    this.midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x02, this.productId, 0x0E, 0x01, 0xF7]);
                } else if (this.isPro && !this.isMk3) {
                    // Launchpad Pro 2015: Programmer Mode via command 0x2C 0x03
                    this.midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x2C, 0x03, 0xF7]);
                } else if (!this.isMk3 && !this.isPro && this.productId === 0x18) {
                    // Launchpad Mk2: Explicitly ensure Session layout (0x00: notes 11-88, 19-89, CC 104-111)
                    this.midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x22, 0x00, 0xF7]);
                }
            } catch (err) {
                console.warn(`[MIDI Profile] SysEx initialization failed for ${this.name}:`, err);
            }
        }
        this.clear();
    }

    /**
     * Restore device to standard Live/DAW mode.
     */
    async dispose() {
        this.clear();
        if (this.midiOut) {
            try {
                if (this.isMk3 && this.productId) {
                    // Return to Live/DAW layout (00)
                    this.midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x02, this.productId, 0x0E, 0x00, 0xF7]);
                } else if (this.isPro && !this.isMk3) {
                    // Launchpad Pro 2015: return to Live/Session mode (0x00)
                    this.midiOut.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x2C, 0x00, 0xF7]);
                }
            } catch (_) {}
        }
    }

    /**
     * Reset LEDs on the device by clearing all pads and CC buttons with velocity 0.
     */
    clear() {
        if (!this.midiOut) return;
        try {
            const batch = [];
            // Clear 8x8 grid pads (notes 11-88) and 8 scene buttons (notes 19-89)
            for (let row = 1; row <= 8; row++) {
                for (let col = 1; col <= 9; col++) {
                    batch.push(0x90, row * 10 + col, 0x00);
                }
            }
            // Clear top CCs: 91-98 on modern Programmer mode (Pro, Mini Mk3, X) or 104-111 on Mk2
            const useCc91 = this.isPro || this.isMk3;
            const startCc = useCc91 ? 91 : 104;
            for (let cc = startCc; cc <= startCc + 7; cc++) {
                batch.push(0xB0, cc, 0x00);
            }
            this.midiOut.send(new Uint8Array(batch));
        } catch (_) {}
    }

    /**
     * Parses incoming MIDI message:
     * - Note On / Off in Programmer Mode (notes 11-88 grid, 19-89 scene)
     * - CC 91-98 (Pro, Mini Mk3, X) or CC 104-111 (Mk2) for top Automap buttons
     * 
     * @param {Uint8Array|number[]} msg
     * @returns {{ x: number, y: number, pressed: boolean }|null}
     */
    parseMessage(msg) {
        if (!msg || msg.length < 3) return null;

        const status = msg[0] & 0xF0;
        const data1 = msg[1];
        const data2 = msg[2];

        if (status === 0x90 || status === 0x80) {
            const pressed = (status === 0x90 && data2 > 0);
            const note = data1;

            if (note >= 11 && note <= 89) {
                const row = Math.floor(note / 10); // 1..8 (1 is bottom row, 8 is top row)
                const col = note % 10;            // 1..9 (1..8 is grid pad, 9 is scene button)

                if (row >= 1 && row <= 8) {
                    const y = 8 - row; // Map to 0..7 (0 is top row, 7 is bottom row)

                    if (col === 9) {
                        // Scene button (column 8)
                        return { x: 8, y, pressed };
                    } else if (col >= 1 && col <= 8) {
                        // 8x8 Grid pad
                        return { x: col - 1, y, pressed };
                    }
                }
            }
        } else if (status === 0xB0) {
            const pressed = data2 > 0;
            const useCc91 = this.isPro || this.isMk3;
            if (useCc91) {
                // Top row on Pro, Mini Mk3 and X (CC 91..98)
                if (data1 >= 91 && data1 <= 98) {
                    return { x: data1 - 91, y: 8, pressed };
                }
            } else {
                // Top row on Mk2 Session mode (CC 104..111)
                if (data1 >= 104 && data1 <= 111) {
                    return { x: data1 - 104, y: 8, pressed };
                }
            }
        }

        return null;
    }

    /**
     * Builds MIDI bytes for RGB Launchpad.
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
            // Automap button (top row) -> CC (91-98 on Pro / Mk3 / X, 104-111 on Mk2)
            const cc = (this.isPro || this.isMk3 ? 91 : 104) + x;
            return [0xB0, cc, colorCode];
        }
        if (x === 8) {
            // Scene button (column 8) -> Note ((8 - y) * 10) + 9
            const note = ((8 - y) * 10) + 9;
            return [0x90, note, colorCode];
        }
        // Grid pad -> Note ((8 - y) * 10) + (x + 1)
        const note = ((8 - y) * 10) + (x + 1);
        return [0x90, note, colorCode];
    }

    /**
     * Resolves color descriptor with full RGB support.
     * @param {string} colorName
     * @param {'full'|'medium'|'low'|null} [level]
     */
    getColor(colorName, level = null) {
        const base = this.colorPalette[colorName] || this.colorPalette['white'];
        if (level && base[level]) {
            return base[level];
        }
        return base;
    }

    /**
     * RGB layout switching / page confirmation.
     * @param {number} _modeIndex
     */
    setLayout(_modeIndex) {
        // Modern Launchpads remain in Programmer Mode for full custom illumination
    }
}
