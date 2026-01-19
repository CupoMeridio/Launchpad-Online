import { audioEngine } from './audio.js';
import { currentPage, currentProject, projectLights, activePageButton, setCurrentPage, setActivePageButton } from './app.js';
import { triggerAnimation, releaseAnimation } from './lights.js';

let cachedPads = null;

/**
 * Ensures the pad cache is populated.
 */
function ensurePadCache() {
    if (!cachedPads || cachedPads.length === 0) {
        cachedPads = document.querySelectorAll('.grid-item');
    }
}

/**
 * Called when an 8x8 grid pad is pressed.
 * @param {Event} event - The interaction event object.
 * @param {number} index - The index of the pressed pad (0-63).
 */
export function playSound(event, index) {
    // Prevent default behavior for touch events
    if (event.type === 'touchstart') {
        event.preventDefault();
    }

    triggerPad(index);
    
    // For click (legacy), we still keep a short timeout if no release event is used
    if (event.type === 'click') {
        ensurePadCache();
        setTimeout(() => {
            if (cachedPads[index]) cachedPads[index].classList.remove('active');
        }, 100);
    }
}

/**
 * Called when an 8x8 grid pad is released.
 * @param {Event} event - The interaction event object.
 * @param {number} index - The index of the released pad (0-63).
 */
export function stopSound(event, index) {
    releasePad(index);
}

/**
 * Activates a pad programmatically (e.g., via MIDI input).
 * @param {number} index - The index of the pad to activate (0-63).
 */
export function triggerPad(index) {
    ensurePadCache();
    if (index >= 0 && index < cachedPads.length) {
        const pad = cachedPads[index];
        const soundIndex = currentPage * 64 + index;

        // Play audio
        audioEngine.playPadSound(soundIndex);

        // Trigger light animation if it exists
        if (projectLights && projectLights[soundIndex]) {
            const animationName = projectLights[soundIndex];
            const x = index % 8;
            const y = Math.floor(index / 8);
            triggerAnimation(animationName, x, y);
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
    ensurePadCache();
    if (index >= 0 && index < cachedPads.length) {
        const pad = cachedPads[index];
        const soundIndex = currentPage * 64 + index;

        // Stop light animation if it exists
        if (projectLights && projectLights[soundIndex]) {
            const animationName = projectLights[soundIndex];
            const x = index % 8;
            const y = Math.floor(index / 8);
            releaseAnimation(animationName, x, y);
        }

        pad.classList.remove('active');
    }
}

/**
 * Initializes interaction listeners for the grid pads using event delegation.
 */
export function initInteraction() {
    const launchpad = document.getElementById('Launchpad');
    if (!launchpad) return;

    // Initialize pads: remove old onclick and set data-index for delegation
    const pads = launchpad.querySelectorAll('.grid-item');
    pads.forEach((pad, index) => {
        pad.removeAttribute('onclick');
        pad.dataset.index = index;
    });

    // Initialize menu buttons: remove old onclick and set data-page for side buttons
    const menuButtons = launchpad.querySelectorAll('.grid-item-menu');
    menuButtons.forEach(btn => {
        btn.removeAttribute('onclick');
        if (btn.id.startsWith('m')) {
            btn.dataset.page = parseInt(btn.id.substring(1), 10) - 1;
        }
    });

    // Handle Press (mousedown and touchstart)
    const handlePress = (e) => {
        const target = e.target.closest('.grid-item, .grid-item-menu');
        if (!target) return;

        if (target.dataset.index !== undefined) {
            playSound(e, parseInt(target.dataset.index, 10));
        } else if (target.dataset.page !== undefined) {
            changeSoundSet(parseInt(target.dataset.page, 10));
        }
    };

    // Handle Release (mouseup, touchend, touchcancel)
    const handleRelease = (e) => {
        const target = e.target.closest('.grid-item');
        if (target && target.dataset.index !== undefined) {
            stopSound(e, parseInt(target.dataset.index, 10));
        }
    };

    // Mouseout is used to stop sound when moving the cursor out of a pad while pressed
    const handleMouseOut = (e) => {
        const pad = e.target.closest('.grid-item');
        if (pad && !pad.contains(e.relatedTarget) && pad.dataset.index !== undefined) {
            stopSound(e, parseInt(pad.dataset.index, 10));
        }
    };

    // Add delegated listeners to the Launchpad container
    launchpad.addEventListener('mousedown', handlePress);
    launchpad.addEventListener('touchstart', handlePress, { passive: false });
    
    launchpad.addEventListener('mouseup', handleRelease);
    launchpad.addEventListener('touchend', handleRelease);
    launchpad.addEventListener('touchcancel', handleRelease);
    
    launchpad.addEventListener('mouseout', handleMouseOut);
}

/**
 * Changes the current sound page.
 * @param {number} index - The index of the page to load (0-7).
 */
export function changeSoundSet(index) {
    if (currentProject && index < currentProject.pages.length) {
        setCurrentPage(index);
        console.log(`Page changed: ${index}`);

        const pageButtons = document.querySelectorAll('.grid-item-menu[data-page]');
        if (activePageButton) {
            activePageButton.classList.remove('selected');
        }
        setActivePageButton(pageButtons[index]);
        if (activePageButton) {
            activePageButton.classList.add('selected');
        }
    } else {
        console.warn(`Attempt to access non-existent page: ${index}`);
        const launchpadElement = document.getElementById('Launchpad');
        if (launchpadElement) {
            launchpadElement.classList.add('error-shake');
            setTimeout(() => {
                launchpadElement.classList.remove('error-shake');
            }, 500);
        }
    }
}

// Functions are exposed globally to be used in HTML
window.playSound = playSound;
window.triggerPad = triggerPad;
window.releasePad = releasePad;
window.changeSoundSet = changeSoundSet;