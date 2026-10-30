/**
 * MIDI MODULE (midi.js)
 *
 * This module handles interaction with physical MIDI controllers, specifically
 * the Novation Launchpad family, using native Web MIDI API and Device Profiles.
 * Supports Legacy Launchpads (Mk1/S/Mini) and modern RGB Launchpads (Mk2/Mk3/X/Pro)
 * without third-party dependencies.
 */

import { ProfileRegistry, detectModel } from './midi-profiles/ProfileRegistry.js';
import { getTranslation, showNotification } from './ui.js';
import { setDeviceProfile } from './physicalInterface.js';
import { triggerPad, releasePad, changeSoundSet, changeMode } from './interaction.js';
import { getProjectStateSnapshot } from './app.js';
import { registerListener, removeListener } from './eventCleanup.js';
import { onVisibilityChange } from './visibilityManager.js';
import { isProjectReady, waitForProjectReady } from './projectLoadingState.js';
import { SCENE_BUTTONS_X, AUTOMAP_BUTTONS_Y, LAUNCHPAD_COLS, LAUNCHPAD_ROWS } from './constants.js';
import { setDetectedHardwareModel } from './launchpadView.js';
import { debug } from './logger.js';

// Active DeviceProfile and MIDI Access instances
let activeProfile = null;
let midiAccessRef = null;

/**
 * MIDI State Machine - Centralized state management to prevent race conditions
 * and ensure state consistency across all operations.
 */
const MIDI_STATE = {
    UNINITIALIZED: 'UNINITIALIZED',
    INITIALIZED: 'INITIALIZED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED'
};

let midiState = MIDI_STATE.UNINITIALIZED;
let initializingPromise = null; // Guard for concurrent initMidi calls
let visibilityUnsubscribe = null; // Store visibility change unsubscribe function
let hardwareLayoutListener = null; // Store hardware layout listener reference for cleanup
let reinitTimer = null; // Pending visibility-triggered reinitialization timer

/**
 * Safely transitions to a new state, validating allowed transitions.
 * @param {string} newState - Target state from MIDI_STATE
 * @returns {boolean} True if transition succeeded, false if it was invalid
 */
function setMidiState(newState) {
    const isValidTransition = {
        [MIDI_STATE.UNINITIALIZED]: [MIDI_STATE.INITIALIZED],
        [MIDI_STATE.INITIALIZED]: [MIDI_STATE.CONNECTING, MIDI_STATE.UNINITIALIZED, MIDI_STATE.INITIALIZED],
        [MIDI_STATE.CONNECTING]: [MIDI_STATE.CONNECTED, MIDI_STATE.INITIALIZED, MIDI_STATE.UNINITIALIZED],
        [MIDI_STATE.CONNECTED]: [MIDI_STATE.CONNECTING, MIDI_STATE.UNINITIALIZED, MIDI_STATE.INITIALIZED]
    }[midiState] || [];

    if (!isValidTransition.includes(newState)) {
        console.warn(`[MIDI] Invalid state transition: ${midiState} -> ${newState}`);
        return false;
    }

    debug(`[MIDI] State transition: ${midiState} -> ${newState}`);
    midiState = newState;
    
    return true;
}

/**
 * Updates the MIDI connection status indicator in the UI.
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
 * Sets up incoming MIDI message handler on the active DeviceProfile's input port.
 */
function setupLaunchpadEvents() {
    if (!activeProfile || !activeProfile.midiIn) return;

    activeProfile.midiIn.onmidimessage = (event) => {
        const parsed = activeProfile.parseMessage(event.data);
        if (!parsed) return;

        const { x, y, pressed } = parsed;

        // Side buttons (Scene / Pages) have x=SCENE_BUTTONS_X
        if (x === SCENE_BUTTONS_X && y < LAUNCHPAD_ROWS) {
            if (pressed) {
                changeSoundSet(y);
            }
        } else if (x < LAUNCHPAD_COLS && y < LAUNCHPAD_ROWS) {
            // Main playable 8x8 grid pads
            const padIndex = y * LAUNCHPAD_COLS + x;
            if (pressed) {
                triggerPad(padIndex);
            } else {
                releasePad(padIndex);
            }
        } else if (y === AUTOMAP_BUTTONS_Y && x < LAUNCHPAD_COLS) {
            // Top Automap / Mode buttons
            if (pressed) {
                changeMode(x);
            }
        }
    };
}

/**
 * Handles layout changes for controllers supporting hardware layout switching (e.g. User 1 mode).
 * @param {CustomEvent} event
 */
function handleHardwareLayoutChange(event) {
    const modeIndex = event?.detail?.mode;
    if (modeIndex === undefined || modeIndex === null) return;
    if (!activeProfile) return;

    if (typeof activeProfile.setLayout === 'function') {
        try {
            activeProfile.setLayout(modeIndex);
            debug(`[MIDI] Hardware layout switched for mode ${modeIndex}`);
        } catch (e) {
            console.warn("[MIDI] Failed to change hardware layout:", e);
        }
    }
}

/**
 * Resets active controller event handlers.
 */
function resetLaunchpadState() {
    if (activeProfile && activeProfile.midiIn) {
        activeProfile.midiIn.onmidimessage = null;
    }
}

/**
 * Attempts to find and connect to a Launchpad device.
 * Respects state transitions and prevents parallel connection attempts.
 */
async function connectToLaunchpad() {
    // Only allow connection from specific states
    if (midiState === MIDI_STATE.UNINITIALIZED) {
        debug("[MIDI] Connection ignored: MIDI system not initialized");
        return;
    }

    // Prevent concurrent connection attempts
    if (midiState === MIDI_STATE.CONNECTING || midiState === MIDI_STATE.CONNECTED) {
        debug("[MIDI] Already connecting or connected");
        return;
    }

    // Transition to CONNECTING state
    setMidiState(MIDI_STATE.CONNECTING);

    try {
        if (!midiAccessRef) {
            throw new Error("Web MIDI API access not available");
        }

        const { input, output, deviceName } = ProfileRegistry.findLaunchpadPorts(
            midiAccessRef.inputs.values(),
            midiAccessRef.outputs.values()
        );

        if (!input || !output) {
            debug("[MIDI] No Launchpad found during scan.");
            setMidiState(MIDI_STATE.INITIALIZED);
            updateMidiStatus(false);
            return;
        }

        // Initialize active profile
        resetLaunchpadState();
        activeProfile = ProfileRegistry.getProfile(deviceName, output, input);
        await activeProfile.initialize();

        // Connect physical interface system
        setDeviceProfile(activeProfile);
        setDetectedHardwareModel(ProfileRegistry.getModelType(deviceName));
        debug(`[MIDI] ${activeProfile.name} connected`);

        // Transition to CONNECTED state
        setMidiState(MIDI_STATE.CONNECTED);

        // Add visual connection indicator
        updateMidiStatus(true);
        showNotification(getTranslation('midi.status.connected'), 'success');

        // Set up pad event handlers
        setupLaunchpadEvents();

        // Always sync the current mode and hardware layout immediately
        const state = getProjectStateSnapshot();
        if (state.mode !== null) {
            debug(`[MIDI] Initial hardware layout sync to mode ${state.mode}`);
            changeMode(state.mode, true);
        }

        // Refresh physical lights for the current page
        debug("[MIDI] Syncing project lights for connected Launchpad...");
        if (!isProjectReady()) {
            debug("[MIDI] Project not yet ready, waiting up to 3 seconds...");
            const isReady = await waitForProjectReady(3000);
            if (!isReady) {
                console.warn("[MIDI] Proceeding without project - lights will sync when project loads");
            }
        }
        
        // Sync project lights if available
        if (isProjectReady()) {
            const currentState = getProjectStateSnapshot();
            debug(`[MIDI] Syncing to page ${currentState.page}`);
            changeSoundSet(currentState.page, true);
        }

    } catch (error) {
        console.error("[MIDI] Connection error:", error);
        updateMidiStatus(false);
        setMidiState(MIDI_STATE.INITIALIZED);
    }
}

/**
 * Initializes the MIDI system and sets up hot-plugging.
 * This is the module entry point, called by `app.js`.
 */
export async function initMidi() {
    // Return existing promise if initialization is already in progress
    if (initializingPromise) {
        debug("[MIDI] MIDI system already initializing, returning existing promise.");
        return initializingPromise;
    }

    // Prevent re-initialization if already done
    if (midiState !== MIDI_STATE.UNINITIALIZED) {
        debug(`[MIDI] MIDI already initialized (state: ${midiState})`);
        return Promise.resolve();
    }

    initializingPromise = (async () => {
        debug("[MIDI] Initializing MIDI system...");
        try {
            // Request MIDI access with SysEx capability for RGB Programmer Mode
            try {
                midiAccessRef = await navigator.requestMIDIAccess({ sysex: true });
                debug("[MIDI] Web MIDI API access granted (SysEx enabled).");
            } catch (_) {
                midiAccessRef = await navigator.requestMIDIAccess({ sysex: false });
                debug("[MIDI] Web MIDI API access granted (standard mode).");
            }

            // Transition to INITIALIZED state
            setMidiState(MIDI_STATE.INITIALIZED);

            // Set up the handler for device state changes (hot-plugging)
            midiAccessRef.onstatechange = (event) => {
                if (event.port.type !== 'input') return;

                debug(`[MIDI] Port state change: ${event.port.name}, ${event.port.state}`);

                const modelInfo = detectModel(event.port.name);

                if (event.port.state === 'disconnected' && modelInfo.isLaunchpad) {
                    debug("[MIDI] Launchpad disconnected via onstatechange.");
                    updateMidiStatus(false);
                    showNotification(getTranslation('midi.status.disconnected'), 'error');
                    disposeMidi({ releaseAccess: false });
                } else if (event.port.state === 'connected' && modelInfo.isLaunchpad) {
                    if (midiState !== MIDI_STATE.CONNECTING && midiState !== MIDI_STATE.CONNECTED) {
                        debug(`[MIDI] New Launchpad detected: ${event.port.name}`);
                        connectToLaunchpad();
                    }
                }
            };

            // Perform an initial scan for the Launchpad
            await connectToLaunchpad();

            // Clean up previous hardware layout listener if exists
            if (hardwareLayoutListener) {
                removeListener(window, 'midi:setHardwareLayout', hardwareLayoutListener);
            }
            hardwareLayoutListener = handleHardwareLayoutChange;
            registerListener(window, 'midi:setHardwareLayout', hardwareLayoutListener);

            // Clean up previous visibility callback before registering a new one
            if (visibilityUnsubscribe) {
                visibilityUnsubscribe();
            }

            // Handle visibility change (e.g. browser minimized/restored)
            visibilityUnsubscribe = onVisibilityChange((isVisible) => {
                if (!isVisible) {
                    debug("[MIDI] Page hidden, fully disposing MIDI system...");
                    if (reinitTimer !== null) {
                        clearTimeout(reinitTimer);
                        reinitTimer = null;
                    }
                    disposeMidi({ releaseAccess: true });
                    return;
                }

                debug("[MIDI] Page visible, reinitializing MIDI system...");
                if (midiState === MIDI_STATE.UNINITIALIZED) {
                    reinitTimer = setTimeout(() => {
                        reinitTimer = null;
                        if (document.visibilityState !== 'visible') return;
                        debug("[MIDI] Attempting full MIDI reinitialization...");
                        initMidi().catch(error => console.error("[MIDI] Reinitialization error:", error));
                    }, 500);
                }
            });

        } catch (error) {
            console.error("[MIDI] Web MIDI API not supported or access denied.", error);
            updateMidiStatus(false);
            showNotification(getTranslation('midi.notSupported'), 'error');
            throw error;
        } finally {
            initializingPromise = null;
        }
    })();

    return initializingPromise;
}

/**
 * Cleanly disposes of the MIDI system and disconnects the Launchpad.
 * @param {Object} options
 * @param {boolean} [options.releaseAccess=false]
 */
async function disposeMidi({ releaseAccess = false } = {}) {
    if (midiState === MIDI_STATE.UNINITIALIZED) {
        debug("[MIDI] Already disposed");
        return;
    }

    debug("[MIDI] Disposing MIDI system...");

    try {
        if (activeProfile) {
            resetLaunchpadState();
            await activeProfile.dispose();
            activeProfile = null;
            setDeviceProfile(null);
            setDetectedHardwareModel(null);
            updateMidiStatus(false);
        }

        if (releaseAccess) {
            if (midiAccessRef) {
                midiAccessRef.onstatechange = null;
                midiAccessRef = null;
            }
            setMidiState(MIDI_STATE.UNINITIALIZED);
        } else {
            // Keep Web MIDI access alive and ready for hot-reconnection
            setMidiState(MIDI_STATE.INITIALIZED);
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
