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
 */

// Import launchpad-webmidi library
import Launchpad from './vendor/launchpad-webmidi.js';

// Launchpad instance
let launchpad = null;

/**
 * Updates the visual MIDI status indicator in the interface.
 * @param {boolean} connected - True if Launchpad is connected, false otherwise.
 */
function updateMidiStatus(connected) {
    // Try to find or create a MIDI status indicator
    let statusIndicator = document.getElementById('midi-status');
    
    if (!statusIndicator) {
        // If it doesn't exist, create a temporary one
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'midi-status';
        statusIndicator.style.position = 'fixed';
        statusIndicator.style.top = '10px';
        statusIndicator.style.right = '10px';
        statusIndicator.style.padding = '5px 10px';
        statusIndicator.style.borderRadius = '5px';
        statusIndicator.style.fontSize = '12px';
        statusIndicator.style.fontFamily = 'Arial, sans-serif';
        statusIndicator.style.zIndex = '1000';
        document.body.appendChild(statusIndicator);
    }
    
    if (connected) {
        statusIndicator.textContent = 'Launchpad Connected ✓';
        statusIndicator.style.backgroundColor = '#4CAF50';
        statusIndicator.style.color = 'white';
    } else {
        statusIndicator.textContent = 'Launchpad Disconnected ✗';
        statusIndicator.style.backgroundColor = '#f44336';
        statusIndicator.style.color = 'white';
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
            const pageIndex = y + 1;
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
 * Initializes connection with the Launchpad via launchpad-webmidi.
 * This is the module entry point, called by `app.js`.
 */
export async function initMidi() {
    console.log("[MIDI] Initializing Launchpad connection...");
    
    try {
        // Check if library is available
        if (!Launchpad) {
            throw new Error("launchpad-webmidi library not loaded correctly");
        }

        // Create Launchpad instance
        launchpad = new Launchpad(''); // Empty name to find any Launchpad
        
        // Connect to Launchpad
        await launchpad.connect();
        console.log(`[MIDI] Launchpad ${launchpad.name || ''} connected`);
        
        // Add visual connection indicator
        updateMidiStatus(true);
        
        // Set up pad event handlers
        setupLaunchpadEvents();
        
        // Handle disconnection
        if (launchpad && launchpad.on) {
            launchpad.on('disconnect', () => {
                console.log("[MIDI] Launchpad disconnected");
                updateMidiStatus(false);
                launchpad = null;
            });
        }
        
    } catch (error) {
        console.log("[MIDI] Launchpad not found");
        updateMidiStatus(false);
    }
}