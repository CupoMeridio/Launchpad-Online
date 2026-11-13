import { audioEngine } from './audio.js';
import { getActiveProject, getCurrentPage, setCurrentPage, getCurrentMode, setCurrentMode, isProjectReady } from './projectState.js';
import { triggerAnimation, releaseAnimation } from './lights.js';
import { resolveLightDuration } from './animationData.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';
import { getPadElement, updatePageButtonHighlight, updateModeButtonHighlight } from './webInterface.js';
import { registerListener } from './eventCleanup.js';
import { debug, logger } from './logger.js';
import { createPadStep } from './projectModel.js';
import { 
    LAUNCHPAD_COLS, 
    SCENE_BUTTONS_X, 
    AUTOMAP_BUTTONS_Y, 
    ERROR_SHAKE_DURATION_MS, 
    TOTAL_PAGES, 
    TOTAL_MODES, 
    FIRST_MODE_INDEX, 
    TOTAL_AUTOMAP_BUTTONS
} from './constants.js';

/** @typedef {import('./projectModel.js').PadStep} PadStep */

/**
 * What a pad press should play, as resolved by a pad source.
 * @typedef {object} PadPlayback
 * @property {PadStep} step - The step to play (sound and/or light).
 * @property {number} stepIndex - Index of `step` within the pad's steps.
 * @property {number} totalSteps - Number of steps of the pad (>= 1).
 * @property {string} soundKey - Audio engine key: re-pressing the pad restarts its sound.
 * @property {string|null} counterKey - Round-robin cursor key, or null to keep the cursor still.
 */

/**
 * Provider of pad behaviour. The performance project is the default source;
 * the Studio Creator registers its own while editing.
 * @typedef {object} PadSource
 * @property {function(number): (PadPlayback|null)} getPadPlayback - Resolves the playback for a pad index (0-63).
 * @property {function(number): void} [onPadPress] - Notified before a pad plays.
 * @property {function(number, boolean): void} [onPageChange] - Handles page buttons (replaces project paging).
 */

let interactionInitialized = false; // Track if listeners have been set up
let shakeTimeoutId = null; // Track error shake timeout to prevent stacking

/** A pad with no steps still gives press feedback, it just plays nothing. */
const EMPTY_STEP = Object.freeze(createPadStep());

let currentPadSource = null;
const padStepCounters = new Map();
const activePressAnimations = new Map();

/**
 * Resets pad step round-robin counters (e.g. on project load).
 */
export function resetPadStepCounters() {
    padStepCounters.clear();
    activePressAnimations.clear();
}

/**
 * Registers an active pad source (e.g. Studio Creator).
 * Pass null to revert to the performance project.
 * @param {PadSource|null} provider
 */
export function setPadSource(provider) {
    currentPadSource = provider;
}

export function getPadSource() {
    return currentPadSource;
}

/**
 * Reads a pad's round-robin step cursor without advancing it.
 * Letting the pad source read (but never mutate) the cursor keeps the
 * advancement in a single place: `triggerPad`.
 * @param {string} counterKey
 * @returns {number}
 */
export function getPadStepCursor(counterKey) {
    return padStepCounters.get(counterKey) || 0;
}

/**
 * Default pad source: the active performance project.
 * @param {number} index - Pad index (0-63).
 * @returns {PadPlayback|null}
 */
function getProjectPadPlayback(index) {
    const active = getActiveProject();
    const page = getCurrentPage();
    if (!active || page === null) return null;

    const steps = active.pages[page]?.[index] || [];
    const soundKey = `project:${page}:${index}`;
    if (steps.length === 0) {
        return { step: EMPTY_STEP, stepIndex: 0, totalSteps: 1, soundKey, counterKey: null };
    }

    const counterKey = `${page}:${index}`;
    const stepIndex = getPadStepCursor(counterKey) % steps.length;
    return {
        step: steps[stepIndex],
        stepIndex,
        totalSteps: steps.length,
        soundKey,
        counterKey
    };
}

/**
 * Activates a pad programmatically (e.g., via MIDI input or click).
 * @param {number} index - The index of the pad to activate (0-63).
 */
export function triggerPad(index) {
    const pad = getPadElement(index);
    if (!pad) return;

    currentPadSource?.onPadPress?.(index);

    const playback = currentPadSource ? currentPadSource.getPadPlayback(index) : getProjectPadPlayback(index);
    if (!playback) return;

    const { step } = playback;
    const soundDuration = step.buffer ? audioEngine.playBuffer(step.buffer, playback.soundKey) : 0;

    if (step.light) {
        const x = index % LAUNCHPAD_COLS;
        const y = Math.floor(index / LAUNCHPAD_COLS);
        triggerAnimation(step.light, x, y, resolveLightDuration(step.syncToSound, soundDuration, step.duration));
        activePressAnimations.set(index, step.light);
    } else {
        activePressAnimations.delete(index);
    }

    // Advance the round-robin step cursor here, and only here, for every pad
    // source (performance project and Studio Creator live preview alike).
    // Advancing while *reading* the playback would double-count whenever the pad
    // is released without an active animation (e.g. a step with no light).
    if (playback.counterKey && playback.totalSteps > 1) {
        padStepCounters.set(playback.counterKey, (playback.stepIndex + 1) % playback.totalSteps);
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

    const animationName = activePressAnimations.get(index);
    activePressAnimations.delete(index);

    if (animationName) {
        const x = index % LAUNCHPAD_COLS;
        const y = Math.floor(index / LAUNCHPAD_COLS);
        releaseAnimation(animationName, x, y);
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
 * Lights one physical button orange and the others off, in a single flush.
 * @param {Array<[number, number]>} coordinates - Physical [x, y] of each button in the row.
 * @param {number} activeIndex - Index (into `coordinates`) of the button to highlight.
 */
function lightPhysicalButtonRow(coordinates, activeIndex) {
    const orange = getLpColor('orange');
    if (!orange) return; // Physical launchpad not connected or colors not ready
    const off = getLpColor('off');

    coordinates.forEach((position, i) => {
        setPhysicalColor(i === activeIndex ? orange : off, position, false);
    });
    flushPhysicalColors();
}

// Page buttons are the scene buttons on the right side (x = SCENE_BUTTONS_X).
const PAGE_BUTTON_COORDINATES = Array.from({ length: TOTAL_PAGES }, (_, i) => [SCENE_BUTTONS_X, i]);
// Mode buttons are the official modes (4-7) on the top automap row.
const MODE_BUTTON_COORDINATES = Array.from(
    { length: TOTAL_AUTOMAP_BUTTONS - FIRST_MODE_INDEX },
    (_, i) => [FIRST_MODE_INDEX + i, AUTOMAP_BUTTONS_Y]
);

/**
 * Updates the lights for the page buttons on the physical Launchpad.
 * @param {number} activeIndex - The index of the currently active page.
 */
export function updatePhysicalPageLights(activeIndex) {
    lightPhysicalButtonRow(PAGE_BUTTON_COORDINATES, activeIndex);
}

/**
 * Synchronizes the visual state and physical lights of Launchpad side page buttons
 * with the active performance page.
 * @param {number} pageIndex
 */
export function syncPerformancePageButtons(pageIndex = getCurrentPage()) {
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

    if (!isProjectReady()) {
        logger.warn('[Interaction] Cannot change sound set: Project not ready');
        return;
    }

    const active = getActiveProject();
    if (active && index < active.project.pages.length) {
        const pageChanged = (index !== getCurrentPage());
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
    lightPhysicalButtonRow(MODE_BUTTON_COORDINATES, activeIndex - FIRST_MODE_INDEX);
}

/**
 * Synchronizes the visual state and physical lights of Launchpad mode buttons
 * with the active mode.
 * @param {number} modeIndex
 */
export function syncPerformanceModeButtons(modeIndex = getCurrentMode()) {
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
        logger.warn(`[Interaction] Mode index ${index} is not an official mode (4-7). Ignoring.`);
        return;
    }

    const modeChanged = (index !== getCurrentMode());

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