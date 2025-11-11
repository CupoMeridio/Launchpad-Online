import { audioEngine } from './audio.js';
import { currentPage, currentProject, activePageButton, setCurrentPage, setActivePageButton } from './app.js';

/**
 * Called when an 8x8 grid pad is pressed.
 * @param {Event} event - The click event object.
 * @param {number} index - The index of the pressed pad (0-63).
 */
export function playSound(event, index) {
    const pad = event.target;
    const soundIndex = currentPage * 64 + index;
    audioEngine.playPadSound(soundIndex);

    pad.classList.add('active');
    setTimeout(() => pad.classList.remove('active'), 100);
}

/**
 * Activates a pad programmatically (e.g., via MIDI input).
 * @param {number} index - The index of the pad to activate (0-63).
 */
export function triggerPad(index) {
    const pads = document.querySelectorAll('.grid-item');
    if (index >= 0 && index < pads.length) {
        const pad = pads[index];
        const soundIndex = currentPage * 64 + index;
        audioEngine.playPadSound(soundIndex);
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    }
}

/**
 * Changes the current sound page.
 * @param {number} index - The index of the page to load (0-7).
 */
export function changeSoundSet(index) {
    if (currentProject && index < currentProject.pages.length) {
        setCurrentPage(index);
        console.log(`Page changed: ${index}`);

        const pageButtons = document.querySelectorAll('.grid-item-menu[onclick^="changeSoundSet"]');
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
window.changeSoundSet = changeSoundSet;