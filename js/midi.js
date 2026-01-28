/**
 * =============================================================================
 * MIDI MODULE (midi.js)
 * =============================================================================
 *
 * This module handles interaction with physical MIDI controllers, specifically
 * the Novation Launchpad, using the launchpad-webmidi library.
 * This is an advanced feature that requires:
 * 1. A browser that supports Web MIDI API (e.g., Chrome, Edge, Opera).
 * 2. A connected Launchpad controller (or compatible device).
 *
 * Its responsibilities are:
 * - Detect and connect to the Launchpad device via launchpad-webmidi.
 * - Map incoming MIDI signals (pad presses) to application actions.
 * - Handle dynamic connection/disconnection (hot-plugging) of the device.
 */

// Import launchpad-webmidi library
import Launchpad from './vendor/launchpad-webmidi.js';
import { getTranslation, showNotification } from './ui.js';
import { setLaunchpadInstance } from './physicalInterface.js';
import { triggerPad, releasePad, changeSoundSet, changeMode } from './interaction.js';
import { currentPage, currentMode } from './app.js';

// Launchpad instance
let launchpad = null;
let midiAccessRef = null;
let midiDisposed = false;
let isConnecting = false;

/**
 * Updates the MIDI connection status indicator.
 * @param {boolean} isConnected - True if Launchpad is connected, false otherwise.
 */
function updateMidiStatus(isConnected) {
    let statusText = document.getElementById('midi-status-text');
    let statusDot = document.getElementById('midi-status-dot');

    if (!statusText || !statusDot) {
        console.error('MIDI status elements not found in DOM.');
        return;
    }

    if (isConnected) {
        statusText.setAttribute('data-i18n', 'midi.status.connected');
        statusText.textContent = getTranslation('midi.status.connected');
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
    } else {
        statusText.setAttribute('data-i18n', 'midi.status.disconnected');
        statusText.textContent = getTranslation('midi.status.disconnected');
        statusDot.classList.remove('connected');
        statusDot.classList.add('disconnected');
    }
}

/**
 * Sets up event handlers for the Launchpad using the library.
 */
function setupLaunchpadEvents() {
    if (!launchpad) return;

    // Handler for key events (press and release)
    launchpad.on('key', (event) => {
        const { x, y, pressed } = event;

        // Side buttons (Scene) have x=8
        if (x === 8 && y < 8) {
            // Page change - only on press
            if (pressed) {
                const pageIndex = y;
                window.changeSoundSet(pageIndex);
            }
        } else if (x < 8 && y < 8) {
            // 8x8 grid pads (excluding Automap buttons which have y=8)
            const padIndex = y * 8 + x;

            if (pressed) {
                // Trigger sound and light on press
                triggerPad(padIndex);
            } else {
                // Stop sound and light on release
                releasePad(padIndex);
            }
        }
        // Handler for top automap buttons (y=8)
        else if (y === 8 && x < 8) {
            // Mode change - only on press
            if (pressed) {
                const modeIndex = x;
                window.changeMode(modeIndex);
            }
        }
    });
}

/**
 * Attempts to find and connect to a Launchpad device.
 */
async function connectToLaunchpad() {
    // If a connection is already in progress, or already connected, do nothing.
    if (isConnecting || (launchpad && launchpad.connected)) {
        return;
    }

    isConnecting = true;
    try {
        // Check if library is available
        if (!Launchpad) {
            throw new Error("launchpad-webmidi library not loaded correctly");
        }

        // Create a new Launchpad instance to scan for devices
        const tempLaunchpad = new Launchpad(''); // Empty name to find any Launchpad

        // Connect to Launchpad
        await tempLaunchpad.connect();

        // If connection is successful, assign it to the main variable
        launchpad = tempLaunchpad;
        setLaunchpadInstance(launchpad);
        console.log(`[MIDI] Launchpad ${launchpad.name || ''} connected`);

        // Add visual connection indicator
        updateMidiStatus(true);
        showNotification(getTranslation('midi.status.connected'), 'success');

        // Set up pad event handlers
        setupLaunchpadEvents();

        // Refresh physical lights for the current page and mode
        changeSoundSet(currentPage);
        changeMode(currentMode);

    } catch (error) {
        console.log("[MIDI] No Launchpad found during scan.");
        // Ensure status is updated if connection fails
        if (!launchpad || !launchpad.connected) {
            updateMidiStatus(false);
        }
    } finally {
        isConnecting = false;
    }
}

/**
 * Initializes the MIDI system and sets up hot-plugging.
 * This is the module entry point, called by `app.js`.
 */
export async function initMidi() {
    console.log("[MIDI] Initializing MIDI system...");

    try {
        // Request MIDI access from the browser
        midiAccessRef = await navigator.requestMIDIAccess({ sysex: false });
        console.log("[MIDI] Web MIDI API access granted.");

        // Set up the handler for device state changes (hot-plugging)
        midiAccessRef.onstatechange = (event) => {
            // A port change can trigger multiple times (once for input, once for output)
            // We only process one of them to avoid duplicate notifications
            if (event.port.type !== 'input') return;

            console.log(`[MIDI] MIDI device state change: ${event.port.name}, ${event.port.state}`);

            const isLaunchpad = event.port.name.includes('Launchpad');

            if (event.port.state === 'disconnected' && isLaunchpad) {
                console.log("[MIDI] Launchpad disconnected via onstatechange.");
                // Update status and notify even if launchpad variable is null, 
                // as long as we know a Launchpad device was disconnected.
                updateMidiStatus(false);
                showNotification(getTranslation('midi.status.disconnected'), 'error');
                launchpad = null;
            } else if (event.port.state === 'connected') {
                // A new device is connected, try to find a launchpad
                connectToLaunchpad();
            }
        };

        // Perform an initial scan for the Launchpad
        await connectToLaunchpad();

        // Handle visibility change (e.g., browser minimized/restored)
        // Some browsers suspend MIDI access or drop connections in the background
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log("[MIDI] Tab became visible, checking connection...");
                // Small delay to ensure hardware is ready
                setTimeout(() => {
                    if (!launchpad || !launchpad.connected) {
                        console.log("[MIDI] Reconnecting Launchpad...");
                        connectToLaunchpad();
                    }
                }, 500);
            }
        });

    } catch (error) {
        console.error("[MIDI] Web MIDI API not supported or access denied.", error);
        updateMidiStatus(false);
        showNotification(getTranslation('midi.notSupported'), 'error');
    }
}

export async function disposeMidi() {
    if (midiDisposed) return;
    midiDisposed = true;
    try {
        if (launchpad) {
            try { launchpad.reset(0); } catch (e) { }
            try { if (launchpad.midiIn && typeof launchpad.midiIn.close === 'function') await launchpad.midiIn.close(); } catch (e) { }
            try { if (launchpad.midiOut && typeof launchpad.midiOut.close === 'function') await launchpad.midiOut.close(); } catch (e) { }
            launchpad = null;
            updateMidiStatus(false);
        }
        if (midiAccessRef) {
            midiAccessRef.onstatechange = null;
            midiAccessRef = null;
        }
    } catch (e) { }
}

window.addEventListener('beforeunload', () => { disposeMidi(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) disposeMidi(); });
window.disconnectMidi = disposeMidi;