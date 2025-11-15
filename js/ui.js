import { updateVideoControlsVisibility } from './video.js';

/**
 * Mostra o nasconde la sidebar.
 */
export function toggleSidebar() {
    const layout = document.querySelector('.layout');
    layout.classList.toggle('sidebar-open');
}

/**
 * Apre o chiude un menu a tendina nella sidebar.
 * @param {string} menuId - L'ID dell'elemento del menu da aprire/chiudere.
 */
export function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    menu.classList.toggle('open');

    const menuItem = menu.closest('.menu-item');
    if (menuItem) {
        const toggleButton = menuItem.querySelector('.menu-toggle');
        if (toggleButton) {
            if (menu.classList.contains('open')) {
                toggleButton.classList.add('active');
            } else {
                toggleButton.classList.remove('active');
            }
        }
    }

    if (menuId === 'background-menu') {
        updateVideoControlsVisibility();
    }
}

/**
 * Imposta un'immagine di sfondo per il Launchpad.
 * @param {string|null} imageFile - Il nome del file immagine, o `null` per rimuoverlo.
 */
export function setLaunchpadBackground(imageFile) {
    const launchpad = document.getElementById('Launchpad');
    const menu = document.getElementById('personalize-launchpad-menu');
    if (menu) {
        const buttons = menu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
        const selector = imageFile ? `.menu-option[data-skin="${imageFile}"]` : '.menu-option[data-skin="none"]';
        const active = menu.querySelector(selector);
        if (active) active.classList.add('selected');
    }
    if (imageFile) {
        launchpad.style.backgroundImage = `url('/assets/images/launchpad covers/${imageFile}?t=${new Date().getTime()}')`;
    } else {
        launchpad.style.backgroundImage = 'none';
    }
}

/**
 * Mostra o nasconde gli "adesivi" sui pad.
 * @param {boolean} isActive - `true` per mostrare gli adesivi, `false` per nasconderli.
 */
export function toggleLaunchpadStickers(isActive) {
    const launchpad = document.getElementById('Launchpad');
    if (isActive) {
        launchpad.classList.add('has-stickers');
    } else {
        launchpad.classList.remove('has-stickers');
    }
}

/**
 * Popola dinamicamente il menu per la personalizzazione dello sfondo del Launchpad.
 * @param {string[]} imageFiles - Un array di nomi di file immagine (skin).
 */
export function initializePersonalizeLaunchpadMenu(imageFiles) {
    const menu = document.getElementById('personalize-launchpad-menu');
    
    imageFiles.forEach(imageFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-skin', imageFile);
        button.textContent = imageFile.split('.')[0].replace(/_/g, ' ');
        button.onclick = () => setLaunchpadBackground(imageFile);
        menu.appendChild(button);
    });
}

// Esposizione globale per l'uso nell'HTML
window.toggleSidebar = toggleSidebar;
window.toggleMenu = toggleMenu;
window.setLaunchpadBackground = setLaunchpadBackground;
window.toggleLaunchpadStickers = toggleLaunchpadStickers;