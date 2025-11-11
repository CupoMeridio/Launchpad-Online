import { audioEngine } from './audio.js';
import { currentPage, currentProject, activePageButton, setCurrentPage, setActivePageButton } from './app.js';

/**
 * Chiamata quando un pad della griglia 8x8 viene premuto.
 * @param {Event} event - L'oggetto evento del click.
 * @param {number} index - L'indice del pad (0-63) premuto.
 */
export function playSound(event, index) {
    const pad = event.target;
    const soundIndex = currentPage * 64 + index;
    audioEngine.playPadSound(soundIndex);

    pad.classList.add('active');
    setTimeout(() => pad.classList.remove('active'), 100);
}

/**
 * Attiva un pad programmaticamente (es. tramite input MIDI).
 * @param {number} index - L'indice del pad da attivare (0-63).
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
 * Cambia la pagina di suoni corrente.
 * @param {number} index - L'indice della pagina da caricare (0-7).
 */
export function changeSoundSet(index) {
    if (currentProject && index < currentProject.pages.length) {
        setCurrentPage(index);
        console.log(`Cambiata pagina: ${index}`);

        const pageButtons = document.querySelectorAll('.grid-item-menu[onclick^="changeSoundSet"]');
        if (activePageButton) {
            activePageButton.classList.remove('selected');
        }
        setActivePageButton(pageButtons[index]);
        if (activePageButton) {
            activePageButton.classList.add('selected');
        }
    } else {
        console.warn(`Tentativo di accesso a pagina non esistente: ${index}`);
        const launchpadElement = document.getElementById('Launchpad');
        if (launchpadElement) {
            launchpadElement.classList.add('error-shake');
            setTimeout(() => {
                launchpadElement.classList.remove('error-shake');
            }, 500);
        }
    }
}

// Le funzioni sono esposte globalmente per essere usate nell'HTML
window.playSound = playSound;
window.triggerPad = triggerPad;
window.changeSoundSet = changeSoundSet;