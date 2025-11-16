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
import { getTranslation } from './ui.js';

// Launchpad instance
let launchpad = null;

function showTemporaryNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.zIndex = '1000';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease-in-out';

    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50'; // Green
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336'; // Red
    } else {
        notification.style.backgroundColor = '#2196F3'; // Blue (default)
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3000);
}

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

        // Only when key is pressed (not when released)
        if (!pressed) return;

        // Side buttons (Scene) have x=8
        if (x === 8 && y < 8) {
            // Page change
            const pageIndex = y;
            window.changeSoundSet(pageIndex);
        } else if (x < 8 && y < 8) {
            // 8x8 grid pads (excluding Automap buttons which have y=8)
            const padIndex = y * 8 + x;
            window.triggerPad(padIndex);
        }
        // Handler for top automap buttons (y=8)
        else if (y === 8 && x < 8) {
            // Automap buttons - future functionality
        }
    });
}

/**
 * Attempts to find and connect to a Launchpad device.
 */
async function connectToLaunchpad() {
    // If a launchpad is already connected, do nothing.
    if (launchpad && launchpad.connected) {
        return;
    }

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
        console.log(`[MIDI] Launchpad ${launchpad.name || ''} connected`);

        // Add visual connection indicator
        updateMidiStatus(true);
        showTemporaryNotification(getTranslation('midi.status.connected'), 'success');

        // Set up pad event handlers
        setupLaunchpadEvents();

    } catch (error) {
        console.log("[MIDI] No Launchpad found during scan.");
        // Ensure status is updated if connection fails
        if (!launchpad || !launchpad.connected) {
            updateMidiStatus(false);
        }
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
        const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
        console.log("[MIDI] Web MIDI API access granted.");

        // Set up the handler for device state changes (hot-plugging)
        midiAccess.onstatechange = (event) => {
            console.log(`[MIDI] MIDI device state change: ${event.port.name}, ${event.port.state}`);
            
            const isLaunchpad = event.port.name.includes('Launchpad');

            if (event.port.state === 'disconnected' && isLaunchpad) {
                console.log("[MIDI] Launchpad disconnected via onstatechange.");
                updateMidiStatus(false);
                showTemporaryNotification(getTranslation('midi.status.disconnected'), 'error');
                launchpad = null;
            } else if (event.port.state === 'connected') {
                // A new device is connected, try to find a launchpad
                connectToLaunchpad();
            }
        };

        // Perform an initial scan for the Launchpad
        await connectToLaunchpad();

    } catch (error) {
        console.error("[MIDI] Web MIDI API not supported or access denied.", error);
        updateMidiStatus(false);
        showTemporaryNotification(getTranslation('midi.notSupported'), 'error');
}
}