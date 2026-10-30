import { audioEngine } from './audio.js';
import { currentPage, setCurrentPage, currentMode, setCurrentMode, getProjectStateSnapshot } from './app.js';
import { triggerAnimation, releaseAnimation } from './lights.js';
import { resolveLightDuration } from './animationData.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';
import { getPadElement, updatePageButtonHighlight, updateModeButtonHighlight } from './webInterface.js';
import { registerListener } from './eventCleanup.js';
import { isProjectReady } from './projectLoadingState.js';
import { debug } from './logger.js';
import { 
    LAUNCHPAD_COLS, 
    LAUNCHPAD_PADS, 
    SCENE_BUTTONS_X, 
    AUTOMAP_BUTTONS_Y, 
    ERROR_SHAKE_DURATION_MS, 
    TOTAL_PAGES, 
    TOTAL_MODES, 
    FIRST_MODE_INDEX, 
    TOTAL_AUTOMAP_BUTTONS, 
    DEFAULT_LIGHT_DURATION_SEC
} from './constants.js';

let interactionInitialized = false; // Track if listeners have been set up
let shakeTimeoutId = null; // Track error shake timeout to prevent stacking

let currentPadSource = null;

/**
 * Registers an active pad configuration source provider (e.g. Studio Creator).
 * Pass null to revert to standard Performance project mode.
 * @param {object|null} provider
 */
export function setPadSource(provider) {
    currentPadSource = provider;
}

export function getPadSource() {
    return currentPadSource;
}

function getDefaultPadConfig(index) {
    const state = getProjectStateSnapshot();
    if (!state.project) return null;
    const soundIndex = state.page * LAUNCHPAD_PADS + index;
    const isReady = isProjectReady();
    return {
        soundIndex,
        soundBuffer: null,
        animationName: isReady && state.lights ? state.lights[soundIndex] : null,
        syncToSound: state.lightSyncToSound?.[soundIndex] ?? true,
        manualDuration: state.lightDurations?.[soundIndex] ?? DEFAULT_LIGHT_DURATION_SEC
    };
}

/**
 * Activates a pad programmatically (e.g., via MIDI input or click).
 * @param {number} index - The index of the pad to activate (0-63).
 */
export function triggerPad(index) {
    const pad = getPadElement(index);
    if (!pad) return;

    if (currentPadSource?.onPadPress) {
        currentPadSource.onPadPress(index);
    }

    const config = currentPadSource ? currentPadSource.getPadConfig(index) : getDefaultPadConfig(index);
    if (!config) return;

    let duration = 0;
    if (config.soundBuffer) {
        const soundKey = config.soundKey !== undefined ? config.soundKey : `draft:${index}`;
        duration = audioEngine.playBuffer(config.soundBuffer, soundKey);
    } else if (config.soundIndex !== undefined) {
        duration = audioEngine.playPadSound(config.soundIndex);
    }

    if (config.animationName) {
        const x = index % LAUNCHPAD_COLS;
        const y = Math.floor(index / LAUNCHPAD_COLS);
        const animationDuration = resolveLightDuration(config.syncToSound, duration, config.manualDuration);
        triggerAnimation(config.animationName, x, y, animationDuration);
    }

    pad.classList.add('active');
}

/**
 * Deactivates a pad programmatically (e.g., via MIDI input or mouse release).
 * @param {number} index - The index of the pad to deactivate (0-63).
 */
export function releasePad(index) {
    const pad = getPadElement(index);
    if (!pad) return;

    const config = currentPadSource ? currentPadSource.getPadConfig(index) : getDefaultPadConfig(index);
    if (config?.animationName) {
        const x = index % LAUNCHPAD_COLS;
        const y = Math.floor(index / LAUNCHPAD_COLS);
        releaseAnimation(config.animationName, x, y);
    }

    pad.classList.remove('active');
}

/**
 * Initializes interaction listeners for the grid pads using event delegation.
 * Only initializes once to prevent duplicate listeners.
 */
export function initInteraction() {
    // Prevent multiple initializations
    if (interactionInitialized) {
        debug("[Interaction] Already initialized, skipping duplicate setup");
        return;
    }
    interactionInitialized = true;

    const launchpad = document.getElementById('Launchpad');
    if (!launchpad) return;

    // Handle Press (mousedown and touchstart)
    const handlePress = (e) => {
        if (e.type === 'touchstart') {
            e.preventDefault(); // Prevent default behavior for touch events
        }

        const target = e.target.closest('.grid-item, .grid-item-menu');
        if (!target) return;

        if (target.dataset.index !== undefined) {
            triggerPad(parseInt(target.dataset.index, 10));
        } else if (target.dataset.page !== undefined) {
            changeSoundSet(parseInt(target.dataset.page, 10));
        } else if (target.dataset.mode !== undefined) {
            changeMode(parseInt(target.dataset.mode, 10));
        }
    };

    // Handle Release (mouseup, touchend, touchcancel)
    const handleRelease = (e) => {
        const target = e.target.closest('.grid-item');
        if (target && target.dataset.index !== undefined) {
            releasePad(parseInt(target.dataset.index, 10));
        }
    };

    // Mouseout is used to stop sound when moving the cursor out of a pad while pressed
    const handleMouseOut = (e) => {
        const pad = e.target.closest('.grid-item');
        if (pad && !pad.contains(e.relatedTarget) && pad.dataset.index !== undefined) {
            releasePad(parseInt(pad.dataset.index, 10));
        }
    };

    // Add delegated listeners to the Launchpad container using tracked event system
    registerListener(launchpad, 'mousedown', handlePress);
    registerListener(launchpad, 'touchstart', handlePress, { passive: false });

    registerListener(launchpad, 'mouseup', handleRelease);
    registerListener(launchpad, 'touchend', handleRelease);
    registerListener(launchpad, 'touchcancel', handleRelease);

    registerListener(launchpad, 'mouseout', handleMouseOut);

    registerListener(window, 'launchpad-view-changed', () => {
        if (currentPadSource) return;
        syncPerformancePageButtons();
        syncPerformanceModeButtons();
    });

    debug("[Interaction] Interaction listeners initialized");
}

/**
 * Updates the lights for the page buttons on the physical Launchpad.
 * @param {number} activeIndex - The index of the currently active page.
 */
export function updatePhysicalPageLights(activeIndex) {
    const orange = getLpColor('orange');
    const off = getLpColor('off');

    if (!orange) return; // Physical launchpad not connected or colors not ready

    for (let i = 0; i < TOTAL_PAGES; i++) {
        // Page buttons are at x=SCENE_BUTTONS_X (Scene buttons on right side)
        const color = (i === activeIndex) ? orange : off;
        setPhysicalColor(color, [SCENE_BUTTONS_X, i], false);
    }
    flushPhysicalColors();
}

/**
 * Synchronizes the visual state and physical lights of Launchpad side page buttons
 * with the active performance page.
 * @param {number} pageIndex
 */
export function syncPerformancePageButtons(pageIndex = currentPage) {
    if (currentPadSource) return; // Prevent highlighting performance page during Creator editing
    if (pageIndex === null || pageIndex === undefined) return;
    updatePageButtonHighlight(pageIndex);
    updatePhysicalPageLights(pageIndex);
}

/**
 * Changes the current sound page.
 * 
 * IMPORTANT: Pages are PROJECT-DEPENDENT
 * The number of pages varies per project: typically 0-7, but determined by project.pages.length.
 * This function requires the project to be loaded and includes validation.
 * Invalid page selection triggers ERROR-SHAKE feedback for user awareness.
 * 
 * @param {number} index - The index of the page to load (0 to project.pages.length-1).
 * @param {boolean} updateVisuals - Whether to update the visual state (default: true).
 */
export function changeSoundSet(index, updateVisuals = true) {
    if (currentPadSource?.onPageChange) {
        currentPadSource.onPageChange(index, updateVisuals);
        return;
    }

    // Check if project is ready before proceeding
    // This prevents race condition where currentProject is set but projectLights isn't
    if (!isProjectReady()) {
        console.warn(`[Interaction] Cannot change sound set: Project not ready (state: ${isProjectReady() ? 'ready' : 'loading'})`);
        return;
    }

    // Get a consistent snapshot to ensure project state is coherent
    const state = getProjectStateSnapshot();
    
    if (state.project && index < state.project.pages.length) {
        const pageChanged = (index !== state.page);
        setCurrentPage(index);
        
        if (pageChanged) {
            debug(`Page changed: ${index}`);
        }

        if (updateVisuals) {
            syncPerformancePageButtons(index);
        }
    } else {
        const launchpadElement = document.getElementById('Launchpad');
        if (launchpadElement) {
            // Cancel any previous shake timeout to prevent stacking
            // This prevents memory leak when user repeatedly clicks invalid pages
            if (shakeTimeoutId !== null) {
                clearTimeout(shakeTimeoutId);
            }
            
            launchpadElement.classList.add('error-shake');
            shakeTimeoutId = setTimeout(() => {
                launchpadElement.classList.remove('error-shake');
                shakeTimeoutId = null;
            }, ERROR_SHAKE_DURATION_MS);
        }
    }
}

/**
 * Updates the lights for the mode buttons on the physical Launchpad.
 * @param {number} activeIndex - The index of the currently active mode (4-7).
 */
function updatePhysicalModeLights(activeIndex) {
    const orange = getLpColor('orange');
    const off = getLpColor('off');

    if (!orange) return; // Physical launchpad not connected or colors not ready

    // Update only the 4 official modes (4-7)
    for (let i = FIRST_MODE_INDEX; i < TOTAL_AUTOMAP_BUTTONS; i++) {
        // Mode buttons are at y=AUTOMAP_BUTTONS_Y (Top row buttons)
        const color = (i === activeIndex) ? orange : off;
        setPhysicalColor(color, [i, AUTOMAP_BUTTONS_Y], false);
    }
    flushPhysicalColors();
}

/**
 * Synchronizes the visual state and physical lights of Launchpad mode buttons
 * with the active mode.
 * @param {number} modeIndex
 */
export function syncPerformanceModeButtons(modeIndex = currentMode) {
    if (modeIndex === null || modeIndex === undefined) return;
    updateModeButtonHighlight(modeIndex);
    updatePhysicalModeLights(modeIndex);
}

/**
 * Changes the current Launchpad mode.
 * 
 * IMPORTANT: Modes are HARDWARE-DEPENDENT and FIXED
 * The Launchpad hardware has 8 automap buttons (0-7).
 * Official modes are 4-7: Session, User 1, User 2, Mixer.
 * Navigation buttons 0-3 are currently ignored.
 * 
 * @param {number} index - The index of the mode to set (4-7).
 * @param {boolean} updateVisuals - Whether to update the visual state (default: true).
 */
export function changeMode(index, updateVisuals = true) {
    // Only allow official modes (4-7)
    if (index < FIRST_MODE_INDEX || index >= FIRST_MODE_INDEX + TOTAL_MODES) {
        console.warn(`[Interaction] Mode index ${index} is not an official mode (4-7). Ignoring.`);
        return;
    }

    const state = getProjectStateSnapshot();
    const modeChanged = (index !== state.mode);

    setCurrentMode(index);
    if (modeChanged) {
        debug(`Mode changed: ${index}`);
    }

    // Always dispatch event to ensure hardware layout is synced with current state
    // even if the internal mode didn't change (e.g. on MIDI reconnection)
    window.dispatchEvent(new CustomEvent('midi:setHardwareLayout', { 
        detail: { mode: index } 
    }));

    if (updateVisuals) {
        syncPerformanceModeButtons(index);
    }
}