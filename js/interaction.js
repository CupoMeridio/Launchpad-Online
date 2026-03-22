import { audioEngine } from './audio.js';
import { currentPage, currentProject, projectLights, activePageButton, setCurrentPage, setActivePageButton, activeModeButton, setCurrentMode, setActiveModeButton, getProjectStateSnapshot } from './app.js';
import { triggerAnimation, releaseAnimation } from './lights.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';
import { getPadElement } from './webInterface.js';
import { registerListener } from './eventCleanup.js';
import { isProjectReady } from './projectLoadingState.js';
import { LAUNCHPAD_COLS, LAUNCHPAD_PADS, SCENE_BUTTONS_X, AUTOMAP_BUTTONS_Y, ERROR_SHAKE_DURATION_MS, TOTAL_PAGES, TOTAL_MODES, FIRST_MODE_INDEX, TOTAL_AUTOMAP_BUTTONS } from './constants.js';

let interactionInitialized = false; // Track if listeners have been set up
let shakeTimeoutId = null; // Track error shake timeout to prevent stacking

/**
 * Activates a pad programmatically (e.g., via MIDI input).
 * @param {number} index - The index of the pad to activate (0-63).
 */
export function triggerPad(index) {
    const pad = getPadElement(index);
    if (pad) {
        // Get a consistent snapshot to avoid race conditions during project loading
        const state = getProjectStateSnapshot();
        
        const soundIndex = state.page * LAUNCHPAD_PADS + index;

        // Play audio
        const duration = audioEngine.playPadSound(soundIndex);

        // Trigger light animation ONLY if project is ready
        // This prevents race conditions where projectLights might be incomplete
        if (isProjectReady() && state.lights && state.lights[soundIndex]) {
            const animationName = state.lights[soundIndex];
            const x = index % LAUNCHPAD_COLS;
            const y = Math.floor(index / LAUNCHPAD_COLS);
            triggerAnimation(animationName, x, y, duration);
        } else if (!isProjectReady()) {
            console.log(`[Interaction] Project not ready, skipping light animation for pad ${index}`);
        }

        pad.classList.add('active');
        // Note: For MIDI, release is handled separately in midi.js
    }
}

/**
 * Deactivates a pad programmatically (e.g., via MIDI input).
 * @param {number} index - The index of the pad to deactivate (0-63).
 */
export function releasePad(index) {
    const pad = getPadElement(index);
    if (pad) {
        // Get a consistent snapshot to avoid race conditions during project loading
        const state = getProjectStateSnapshot();
        
        const soundIndex = state.page * LAUNCHPAD_PADS + index;

        // Stop light animation ONLY if project is ready
        if (isProjectReady() && state.lights && state.lights[soundIndex]) {
            const animationName = state.lights[soundIndex];
            const x = index % LAUNCHPAD_COLS;
            const y = Math.floor(index / LAUNCHPAD_COLS);
            releaseAnimation(animationName, x, y);
        } else if (!isProjectReady()) {
            console.log(`[Interaction] Project not ready, skipping light release for pad ${index}`);
        }

        pad.classList.remove('active');
    }
}

/**
 * Initializes interaction listeners for the grid pads using event delegation.
 * Only initializes once to prevent duplicate listeners.
 */
export function initInteraction() {
    // Prevent multiple initializations
    if (interactionInitialized) {
        console.log("[Interaction] Already initialized, skipping duplicate setup");
        return;
    }
    interactionInitialized = true;

    const launchpad = document.getElementById('Launchpad');
    if (!launchpad) return;

    // Initialize pads: set data-index for delegation
    const pads = launchpad.querySelectorAll('.grid-item');
    pads.forEach((pad, index) => {
        pad.dataset.index = index;
    });

    // Initialize menu buttons: set data-page for side buttons
    const menuButtons = launchpad.querySelectorAll('.grid-item-menu');
    menuButtons.forEach(btn => {
        if (btn.id.startsWith('m')) {
            btn.dataset.page = parseInt(btn.id.substring(1), 10) - 1;
        } else if (btn.id.startsWith('a')) {
            const modeIndex = parseInt(btn.id.substring(1), 10) - 1;
            // Only assign data-mode to official modes (4-7)
            if (modeIndex >= FIRST_MODE_INDEX && modeIndex < FIRST_MODE_INDEX + TOTAL_MODES) {
                btn.dataset.mode = modeIndex;
            } else {
                // Tasti 0-3 (Navigation) - Al momento non hanno una funzione specifica
                btn.classList.add('navigation-button');
            }
        }
    });

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

    console.log("[Interaction] Interaction listeners initialized");
}

/**
 * Updates the lights for the page buttons on the physical Launchpad.
 * @param {number} activeIndex - The index of the currently active page.
 */
function updatePhysicalPageLights(activeIndex) {
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
            console.log(`Page changed: ${index}`);
        }

        if (updateVisuals) {
            const pageButtons = document.querySelectorAll('.grid-item-menu[data-page]');
            if (activePageButton) {
                activePageButton.classList.remove('selected');
            }
            setActivePageButton(pageButtons[index]);
            if (activePageButton) {
                activePageButton.classList.add('selected');
            }

            // Update physical Launchpad lights
            updatePhysicalPageLights(index);
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
export function updatePhysicalModeLights(activeIndex) {
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
        console.log(`Mode changed: ${index}`);
    }

    // Always dispatch event to ensure hardware layout is synced with current state
    // even if the internal mode didn't change (e.g. on MIDI reconnection)
    window.dispatchEvent(new CustomEvent('midi:setHardwareLayout', { 
        detail: { mode: index } 
    }));

    if (updateVisuals) {
        const modeButtons = document.querySelectorAll('.grid-item-menu[data-mode]');
        if (activeModeButton) {
            activeModeButton.classList.remove('selected');
        }
        
        // Find the button with the correct data-mode attribute
        const newButton = Array.from(modeButtons).find(btn => parseInt(btn.dataset.mode, 10) === index);
        setActiveModeButton(newButton);
        
        if (activeModeButton) {
            activeModeButton.classList.add('selected');
        }

        // Update physical Launchpad lights
        updatePhysicalModeLights(index);
    }
}