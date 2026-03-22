/**
 * MIDI MODULE (midi.js)
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
import { getProjectStateSnapshot } from './app.js';
import { registerListener, cleanup } from './eventCleanup.js';
import { isProjectReady, waitForProjectReady } from './projectLoadingState.js';
import { SCENE_BUTTONS_X, AUTOMAP_BUTTONS_Y, LAUNCHPAD_COLS, LAUNCHPAD_ROWS } from './constants.js';

// Launchpad instance
let launchpad = null;
let midiAccessRef = null;

/**
 * MIDI State Machine - Centralized state management to prevent race conditions
 * and ensure state consistency across all operations.
 * 
 * States:
 * - UNINITIALIZED: initMidi() has not been called
 * - INITIALIZED: initMidi() called, midiAccessRef acquired, listeners set up
 * - CONNECTING: connectToLaunchpad() in progress
 * - CONNECTED: Launchpad device is connected and ready
 * - SUSPENDED: Page visibility hidden (auto-disconnects to release MIDI resources)
 * - DISPOSED: disposeMidi() called, cleaning up
 */
const MIDI_STATE = {
    UNINITIALIZED: 'UNINITIALIZED',
    INITIALIZED: 'INITIALIZED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    SUSPENDED: 'SUSPENDED',
    DISPOSED: 'DISPOSED'
};

let midiState = MIDI_STATE.UNINITIALIZED;
let initializingPromise = null; // Guard for concurrent initMidi calls
let visibilityListenerAdded = false; // Prevents duplicate visibility listeners

export let isMidiConnected = false;

/**
 * Safely transitions to a new state, validating transitions and updating related flags.
 * @param {string} newState - Target state from MIDI_STATE
 * @returns {boolean} True if transition succeeded, false if it was invalid
 */
function setMidiState(newState) {
    const isValidTransition = {
        [MIDI_STATE.UNINITIALIZED]: [MIDI_STATE.INITIALIZED, MIDI_STATE.DISPOSED],
        [MIDI_STATE.INITIALIZED]: [MIDI_STATE.CONNECTING, MIDI_STATE.SUSPENDED, MIDI_STATE.DISPOSED, MIDI_STATE.INITIALIZED],
        [MIDI_STATE.CONNECTING]: [MIDI_STATE.CONNECTED, MIDI_STATE.INITIALIZED, MIDI_STATE.SUSPENDED, MIDI_STATE.DISPOSED],
        [MIDI_STATE.CONNECTED]: [MIDI_STATE.SUSPENDED, MIDI_STATE.CONNECTING, MIDI_STATE.DISPOSED],
        [MIDI_STATE.SUSPENDED]: [MIDI_STATE.CONNECTING, MIDI_STATE.INITIALIZED, MIDI_STATE.DISPOSED],
        [MIDI_STATE.DISPOSED]: [MIDI_STATE.UNINITIALIZED]
    }[midiState] || [];

    if (!isValidTransition.includes(newState)) {
        console.warn(`[MIDI] Invalid state transition: ${midiState} -> ${newState}`);
        return false;
    }

    console.log(`[MIDI] State transition: ${midiState} -> ${newState}`);
    midiState = newState;
    
    // Update isMidiConnected based on state
    isMidiConnected = (newState === MIDI_STATE.CONNECTED);
    
    return true;
}

/**
 * Get current MIDI state for debugging and testing
 */
export function getMidiState() {
    return midiState;
}

/**
 * Updates the MIDI connection status indicator.
 * @param {boolean} isConnected - True if Launchpad is connected, false otherwise.
 */
function updateMidiStatus(isConnected) {
    isMidiConnected = isConnected;
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
 * Only called once when transitioning to CONNECTED state.
 */
function setupLaunchpadEvents() {
    if (!launchpad) return;

    // Handler for key events (press and release)
    launchpad.on('key', (event) => {
        const { x, y, pressed } = event;

        // Side buttons (Scene) have x=SCENE_BUTTONS_X
        if (x === SCENE_BUTTONS_X && y < LAUNCHPAD_ROWS) {
            // Page change - only on press
            if (pressed) {
                const pageIndex = y;
                changeSoundSet(pageIndex);
            }
        } else if (x < LAUNCHPAD_COLS && y < LAUNCHPAD_ROWS) {
            // Main grid pads (excluding Automap buttons which have y=AUTOMAP_BUTTONS_Y)
            const padIndex = y * LAUNCHPAD_COLS + x;

            if (pressed) {
                // Trigger sound and light on press
                triggerPad(padIndex);
            } else {
                // Stop sound and light on release
                releasePad(padIndex);
            }
        }
        // Handler for top automap buttons (y=AUTOMAP_BUTTONS_Y)
        else if (y === AUTOMAP_BUTTONS_Y && x < LAUNCHPAD_COLS) {
            // Mode change - only on press
            if (pressed) {
                const modeIndex = x;
                changeMode(modeIndex);
            }
        }
    });
}

function getLayoutCodeFromMode(modeIndex) {
    if (modeIndex === 4 || modeIndex === 7) return 0x00;
    if (modeIndex === 5) return 0x01;
    if (modeIndex === 6) return 0x02;
    return 0x01;
}

function handleHardwareLayoutChange(event) {
    const modeIndex = event?.detail?.mode;
    if (modeIndex === undefined || modeIndex === null) return;
    if (!launchpad || !launchpad.midiOut) return;

    const layoutCode = getLayoutCodeFromMode(modeIndex);
    try {
        launchpad.sendRaw([0xb0, 0x00, layoutCode]);
        console.log(`[MIDI] Hardware layout switched to ${layoutCode} (Mode ${modeIndex})`);
    } catch (e) {
        console.warn("[MIDI] Failed to change hardware layout:", e);
    }
}

/**
 * Clears Launchpad instance and its event handlers.
 * Called whenever we need to reset the device state.
 */
function resetLaunchpadState() {
    if (launchpad && launchpad.observers) {
        launchpad.observers = {};
    }
    if (launchpad && launchpad.midiIn) {
        launchpad.midiIn.onmidimessage = null;
    }
}

/**
 * Attempts to find and connect to a Launchpad device.
 * Respects state transitions and prevents parallel connection attempts.
 */
async function connectToLaunchpad() {
    // Only allow connection from specific states
    if (midiState === MIDI_STATE.UNINITIALIZED || midiState === MIDI_STATE.DISPOSED) {
        console.log("[MIDI] Connection ignored: MIDI system not initialized");
        return;
    }

    if (midiState === MIDI_STATE.SUSPENDED) {
        console.log("[MIDI] Connection ignored: Page visibility is suspended");
        return;
    }

    // Prevent concurrent connection attempts
    if (midiState === MIDI_STATE.CONNECTING || midiState === MIDI_STATE.CONNECTED) {
        console.log("[MIDI] Already connecting or connected");
        return;
    }

    // Transition to CONNECTING state
    setMidiState(MIDI_STATE.CONNECTING);

    try {
        // Check if library is available
        if (!Launchpad) {
            throw new Error("launchpad-webmidi library not loaded correctly");
        }

        const input = findPort(midiAccessRef.inputs.values());
        const output = findPort(midiAccessRef.outputs.values());

        if (!input || !output) {
            console.log("[MIDI] No Launchpad found during scan.");
            // Return to INITIALIZED state if connection fails
            setMidiState(MIDI_STATE.INITIALIZED);
            updateMidiStatus(false);
            return;
        }

        // Connect to Launchpad
        resetLaunchpadState();
        launchpad = new Launchpad();
        launchpad.attach(input, output);

        // If connection is successful, assign it to the main variable
        setLaunchpadInstance(launchpad);
        console.log(`[MIDI] ${launchpad.name || ''} connected`);

        // Transition to CONNECTED state
        setMidiState(MIDI_STATE.CONNECTED);

        // Add visual connection indicator
        updateMidiStatus(true);
        showNotification(getTranslation('midi.status.connected'), 'success');

        // Set up pad event handlers
        setupLaunchpadEvents();

        // Always sync the current mode and hardware layout immediately
        // This forces the hardware into the correct layout (e.g. User 1)
        const state = getProjectStateSnapshot();
        if (state.mode !== null) {
            console.log(`[MIDI] Initial hardware layout sync to mode ${state.mode}`);
            changeMode(state.mode, true);
        }

        // Refresh physical lights for the current page
        // Wait briefly for project to be ready if it's loading, but don't block forever
        console.log("[MIDI] Syncing project lights for connected Launchpad...");
        if (!isProjectReady()) {
            console.log("[MIDI] Project not yet ready, waiting up to 3 seconds...");
            const isReady = await waitForProjectReady(3000);
            if (!isReady) {
                console.warn("[MIDI] Proceeding without project - lights will sync when project loads");
            }
        }
        
        // Sync project lights if available
        if (isProjectReady()) {
            const state = getProjectStateSnapshot();
            console.log(`[MIDI] Syncing to page ${state.page}`);
            changeSoundSet(state.page, true);   // Force visual update (lights)
        }

    } catch (error) {
        console.error("[MIDI] Connection error:", error);
        updateMidiStatus(false);
        // Return to INITIALIZED state on error
        setMidiState(MIDI_STATE.INITIALIZED);
    }
}

function findPort(iterator) {
    let item = iterator.next();
    while (!item.done) {
        if (item.value.name.includes('Launchpad')) return item.value;
        item = iterator.next();
    }
    return null;
}


/**
 * Initializes the MIDI system and sets up hot-plugging.
 * This is the module entry point, called by `app.js`.
 */
export async function initMidi() {
    // Return existing promise if initialization is already in progress
    if (initializingPromise) {
        console.log("[MIDI] MIDI system already initializing, returning existing promise.");
        return initializingPromise;
    }

    // Prevent re-initialization if already done
    if (midiState !== MIDI_STATE.UNINITIALIZED && midiState !== MIDI_STATE.DISPOSED) {
        console.log(`[MIDI] MIDI already initialized (state: ${midiState})`);
        return Promise.resolve();
    }

    initializingPromise = (async () => {
        console.log("[MIDI] Initializing MIDI system...");
        try {
            // Request MIDI access from the browser
            midiAccessRef = await navigator.requestMIDIAccess();
            console.log("[MIDI] Web MIDI API access granted.");

            // Transition to INITIALIZED state
            setMidiState(MIDI_STATE.INITIALIZED);

            // Set up the handler for device state changes (hot-plugging)
            midiAccessRef.onstatechange = (event) => {
                // A port change can trigger multiple times (once for input, once for output)
                // Only one of them is processed to avoid duplicate notifications
                if (event.port.type !== 'input') return;

                console.log(`[MIDI] Port state change: ${event.port.name}, ${event.port.state}`);

                const isLaunchpad = event.port.name.includes('Launchpad');

                if (event.port.state === 'disconnected' && isLaunchpad) {
                    console.log("[MIDI] Launchpad disconnected via onstatechange.");
                    updateMidiStatus(false);
                    showNotification(getTranslation('midi.status.disconnected'), 'error');
                    disposeMidi({ releaseAccess: false });
                } else if (event.port.state === 'connected' && isLaunchpad) {
                    // Only attempt connection if not already connecting/connected
                    if (midiState !== MIDI_STATE.CONNECTING && midiState !== MIDI_STATE.CONNECTED) {
                        console.log(`[MIDI] New Launchpad detected: ${event.port.name}`);
                        connectToLaunchpad();
                    }
                }
            };

            // Perform an initial scan for the Launchpad
            await connectToLaunchpad();

            registerListener(window, 'midi:setHardwareLayout', handleHardwareLayoutChange);

            // Handle visibility change (e.g., browser minimized/restored)
            // When page is hidden: fully dispose MIDI to avoid stale references
            // When page is visible: reinitialize MIDI from scratch for robustness
            if (!visibilityListenerAdded) {
                visibilityListenerAdded = true;
                registerListener(document, 'visibilitychange', () => {
                    if (document.visibilityState === 'hidden') {
                        console.log("[MIDI] Page hidden, fully disposing MIDI system...");
                        // Fully dispose: releases midiAccessRef and returns to UNINITIALIZED
                        disposeMidi({ releaseAccess: true });
                        return;
                    }

                    if (document.visibilityState === 'visible') {
                        console.log("[MIDI] Page visible, reinitializing MIDI system...");
                        // If MIDI was disposed, reinitialize from scratch
                        // This ensures midiAccessRef is fresh and avoids stale references
                        if (midiState === MIDI_STATE.UNINITIALIZED) {
                            // Give browser time to restore MIDI hardware access
                            setTimeout(() => {
                                console.log("[MIDI] Attempting full MIDI reinitialization...");
                                initMidi().catch(error => console.error("[MIDI] Reinitialization error:", error));
                            }, 500);
                        }
                    }
                });
            }

        } catch (error) {
            console.error("[MIDI] Web MIDI API not supported or access denied.", error);
            updateMidiStatus(false);
            showNotification(getTranslation('midi.notSupported'), 'error');
            // Keep state as UNINITIALIZED so user can retry
            throw error;
        } finally {
            initializingPromise = null;
        }
    })();

    return initializingPromise;
}

/**
 * Cleanly disposes of the MIDI system and disconnects the Launchpad.
 * @param {Object} options - Configuration options
 * @param {boolean} options.releaseAccess - If true, releases midiAccessRef and removes listeners
 */
export async function disposeMidi({ releaseAccess = false } = {}) {
    // Prevent concurrent dispose calls
    if (midiState === MIDI_STATE.DISPOSED) {
        console.log("[MIDI] Already disposed");
        return;
    }

    console.log("[MIDI] Disposing MIDI system...");
    setMidiState(MIDI_STATE.DISPOSED);

    try {
        if (launchpad) {
            resetLaunchpadState();
            try {
                launchpad.reset(0);
            } catch (e) {
                // Reset may fail if device is unplugged, ignore
            }
            launchpad = null;
            updateMidiStatus(false);
        }

        if (releaseAccess && midiAccessRef) {
            midiAccessRef.onstatechange = null;
            midiAccessRef = null;
            // Return to uninitialized state when fully disposed
            setMidiState(MIDI_STATE.UNINITIALIZED);
        }
    } catch (e) {
        console.error("[MIDI] Error during disposal:", e);
    }
}

/**
 * Cleanup on page unload
 */
registerListener(window, 'beforeunload', () => {
    disposeMidi({ releaseAccess: true });
});
