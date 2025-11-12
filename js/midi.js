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
function updateMidiStatus(connected) {
    let statusText = document.getElementById('midi-status-text');
    let statusDot = document.getElementById('midi-status-dot');

    if (!statusText || !statusDot) {
        console.error('MIDI status elements not found in DOM.');
        return;
    }

    if (connected) {
        statusText.textContent = 'Launchpad Connected';
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
    } else {
        statusText.textContent = 'Launchpad Disconnected';
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
        showTemporaryNotification('Launchpad Connected', 'success');
        
        // Set up pad event handlers
        setupLaunchpadEvents();
        
        // Handle disconnection
        if (launchpad && launchpad.on) {
            launchpad.on('disconnect', () => {
                console.log("[MIDI] Launchpad disconnected");
                updateMidiStatus(false);
                showTemporaryNotification('Launchpad Disconnected', 'error');
                launchpad = null;
            });
        }
        
    } catch (error) {
        console.log("[MIDI] Launchpad not found");
        updateMidiStatus(false);
        showTemporaryNotification('Launchpad Not Found', 'error');
    }
}