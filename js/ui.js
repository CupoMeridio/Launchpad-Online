import { updateVideoControlsVisibility } from './video.js';
import { syncInputSlider } from './formControls.js';
import { LAUNCHPAD_ROTATION_MIN, LAUNCHPAD_ROTATION_MAX, LAUNCHPAD_SIZE_MIN, LAUNCHPAD_SIZE_MAX } from './constants.js';

export { syncInputSlider };

// ============================================================================
// LOCALSTORAGE HELPERS - Safe wrappers to handle private browsing & disabled storage
// ============================================================================

/**
 * Safely retrieve a value from localStorage.
 * @param {string} key - The storage key to retrieve
 * @param {*} defaultValue - Value to return if key not found or storage unavailable
 * @returns {*} The stored value or defaultValue
 */
function safeLocalStorageGetItem(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch (error) {
        // Fails in private browsing, disabled storage, or quota exceeded
        console.warn(`[UI] localStorage.getItem('${key}') failed:`, error.message);
        return defaultValue;
    }
}

/**
 * Safely store a value in localStorage.
 * @param {string} key - The storage key to set
 * @param {*} value - The value to store
 * @returns {boolean} True if successful, false if storage unavailable
 */
function safeLocalStorageSetItem(key, value) {
    try {
        localStorage.setItem(key, String(value));
        return true;
    } catch (error) {
        // Fails in private browsing, disabled storage, or quota exceeded
        console.warn(`[UI] localStorage.setItem('${key}') failed:`, error.message);
        return false;
    }
}

let translations = {};
let currentLanguage = 'it';

async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error(`Could not load translations for ${lang}`);
        translations = await response.json();
        currentLanguage = lang;
        applyTranslations();
    } catch (error) {
        console.error("Translation error:", error);
        // Fallback to Italian if not already Italian
        if (lang !== 'it') {
            await loadTranslations('it');
        }
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = translations[key];
        if (typeof text === 'string') {
            el.textContent = text;
        }
    });
}

export function getTranslation(key) {
    return translations[key] || key;
}

export async function initializeLanguageControls() {
    const select = document.getElementById('language-select');
    const saved = safeLocalStorageGetItem('ui.language', 'it');
    const initialLang = saved || 'it';

    if (select) {
        select.value = initialLang;
        select.addEventListener('change', async function () {
            const newLang = this.value;
            safeLocalStorageSetItem('ui.language', newLang);
            await loadTranslations(newLang);
        });
    }

    await loadTranslations(initialLang);
}

/**
 * Shows or hides the sidebar.
 */
export function toggleSidebar() {
    const layout = document.querySelector('.layout');
    layout.classList.toggle('sidebar-open');
}

/**
 * Opens or closes a dropdown menu in the sidebar.
 * @param {string} menuId - The ID of the menu element to toggle.
 */
export function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    const willOpen = !menu.classList.contains('open');
    if (willOpen) {
        document.querySelectorAll('.menu-dropdown.open').forEach(other => {
            if (other !== menu) {
                other.classList.remove('open');
                const otherItem = other.closest('.menu-item');
                const otherToggle = otherItem ? otherItem.querySelector('.menu-toggle') : null;
                if (otherToggle) otherToggle.classList.remove('active');
            }
        });
    }
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

    updateVideoControlsVisibility();
}

/**
 * Sets a background image for the Launchpad.
 * @param {string|null} imageFile - The image file name, or `null` to remove it.
 * @returns {Promise<void>} A promise that resolves when the background is loaded.
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

    if (!imageFile) {
        launchpad.style.backgroundImage = 'none';
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        // If the imageFile path contains a slash, assume it's a full path,
        // otherwise assume it's a file in the default assets/images/launchpad covers/ directory.
        const imageSrc = imageFile.includes('/') ? imageFile : `assets/images/launchpad covers/${imageFile}`;
        const fullUrl = `${imageSrc}?t=${new Date().getTime()}`;

        // Create a temporary image to track loading
        const img = new Image();
        img.onload = () => {
            launchpad.style.backgroundImage = `url('${fullUrl}')`;
            resolve();
        };
        img.onerror = () => {
            console.error(`Error loading skin: ${fullUrl}`);
            launchpad.style.backgroundImage = 'none';
            resolve(); // Still resolve to not block loading indefinitely
        };
        img.src = fullUrl;
    });
}

/**
 * Shows or hides the pad "stickers".
 * @param {boolean} isActive - `true` to show stickers, `false` to hide them.
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
 * Dynamically populates the menu for customizing the Launchpad background.
 * @param {string[]} imageFiles - An array of image file names (skins).
 */
export function initializePersonalizeLaunchpadMenu(imageFiles) {
    const menu = document.getElementById('personalize-launchpad-menu');

    imageFiles.forEach(imageFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-skin', imageFile);
        button.textContent = imageFile.split('.')[0].replace(/_/g, ' ');
        button.onclick = () => {
            if (button.classList.contains('selected')) return;
            setLaunchpadBackground(imageFile);
        };
        menu.appendChild(button);
    });

    // Rotation synchronization
    const rotationSlider = document.getElementById('rotation-slider');
    const rotationInput = document.getElementById('rotation-input');
    const savedRotation = safeLocalStorageGetItem('launchpad.rotation', null);

    if (savedRotation !== null) {
        const rotationValue = parseInt(savedRotation, 10);
        setSettingValue('rotation', rotationValue);
        if (rotationSlider) rotationSlider.value = savedRotation;
        if (rotationInput) rotationInput.value = savedRotation;
    } else if (rotationSlider) {
        const defaultRotation = parseInt(rotationSlider.value, 10);
        setSettingValue('rotation', defaultRotation);
    }
    applyLaunchpadTransform();
    syncInputSlider('rotation-slider', 'rotation-input', setLaunchpadRotation, LAUNCHPAD_ROTATION_MIN, LAUNCHPAD_ROTATION_MAX);

    // Size synchronization
    const sizeSlider = document.getElementById('size-slider');
    const sizeInput = document.getElementById('size-input');
    const savedSize = safeLocalStorageGetItem('launchpad.size', null);

    if (savedSize !== null) {
        const sizeValue = parseInt(savedSize, 10);
        setSettingValue('scale', sizeValue / 100);
        if (sizeSlider) sizeSlider.value = savedSize;
        if (sizeInput) sizeInput.value = savedSize;
    } else if (sizeSlider) {
        const defaultSize = parseInt(sizeSlider.value, 10);
        setSettingValue('scale', defaultSize / 100);
    }
    applyLaunchpadTransform();
    syncInputSlider('size-slider', 'size-input', setLaunchpadSize, LAUNCHPAD_SIZE_MIN, LAUNCHPAD_SIZE_MAX);

    const logoInput = document.getElementById('logo-file-input');
    const logoTrigger = document.getElementById('logo-file-trigger');
    if (logoTrigger && logoInput) {
        logoTrigger.addEventListener('click', function () {
            logoInput.value = '';
            logoInput.click();
        });
        logoInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            setTopRightIconFile(file);
        });
    }
}

/**
 * Shows a temporary notification on the screen.
 * @param {string} message - The message to display.
 * @param {string} type - The type of notification ('success', 'error', 'info').
 * @param {number} duration - Duration in milliseconds before it disappears.
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove notification after duration
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => notification.remove());
    }, duration);
}

/**
 * Launchpad UI Settings - Grouped state management
 * Centralizes all launchpad customization settings (rotation, scale, etc.)
 * Benefits: Easy to extend with new settings, consistent persistence pattern
 */
let launchpadSettings = {
    rotation: 0,
    scale: 1
};

/**
 * Gets a launchpad setting value
 * @param {string} key - Setting key (e.g., 'rotation', 'scale')
 * @param {*} defaultValue - Default if not set
 * @returns {*} The setting value
 */
function getSettingValue(key, defaultValue = null) {
    return launchpadSettings[key] !== undefined ? launchpadSettings[key] : defaultValue;
}

/**
 * Sets a launchpad setting value and persists to storage
 * @param {string} key - Setting key (e.g., 'rotation', 'scale')
 * @param {*} value - Value to set
 */
function setSettingValue(key, value) {
    launchpadSettings[key] = value;
    // Persist to storage with 'launchpad.' prefix
    safeLocalStorageSetItem(`launchpad.${key}`, value);
}

/**
 * Binds all static UI event listeners that previously relied on inline
 * onclick/onchange attributes in HTML or window.* globals.
 * Called once from app.js after DOMContentLoaded.
 */
export function bindStaticUIEvents() {
    // Sidebar open/close
    const openSidebarBtn = document.getElementById('openSidebar');
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', toggleSidebar);
    }

    // Menu toggle buttons — each carries data-menu="<menuId>" set in index.html
    document.querySelectorAll('.menu-toggle[data-menu]').forEach(btn => {
        btn.addEventListener('click', () => toggleMenu(btn.dataset.menu));
    });

    // "Show Stickers" checkbox
    const stickersCheckbox = document.getElementById('toggle-stickers');
    if (stickersCheckbox) {
        stickersCheckbox.addEventListener('change', function () {
            toggleLaunchpadStickers(this.checked);
        });
    }

    // "Reset top-right icon" button
    const resetIconBtn = document.querySelector('[data-action="resetTopRightIcon"]');
    if (resetIconBtn) {
        resetIconBtn.addEventListener('click', resetTopRightIcon);
    }

    // "Clear background" button (data-video="none")
    const clearBgBtn = document.querySelector('.menu-option[data-video="none"]');
    if (clearBgBtn) {
        clearBgBtn.addEventListener('click', () => {
            if (clearBgBtn.classList.contains('selected')) return;
            import('./video.js').then(m => m.setBackgroundVideo(null));
        });
    }

    // "Default skin" button (data-skin="none")
    const defaultSkinBtn = document.querySelector('.menu-option[data-skin="none"]');
    if (defaultSkinBtn) {
        defaultSkinBtn.addEventListener('click', () => {
            if (defaultSkinBtn.classList.contains('selected')) return;
            setLaunchpadBackground(null);
        });
    }
}

/**
 * Applies both rotation and scale to the Launchpad element.
 */
function applyLaunchpadTransform() {
    const launchpad = document.getElementById('Launchpad');
    if (launchpad) {
        const rotation = getSettingValue('rotation', 0);
        const scale = getSettingValue('scale', 1);
        launchpad.style.transform = `rotate(${rotation}deg) scale(${scale})`;
    }
}

export function setLaunchpadRotation(angle) {
    setSettingValue('rotation', angle);
    applyLaunchpadTransform();
}

export function setLaunchpadSize(size) {
    setSettingValue('scale', size / 100);
    applyLaunchpadTransform();
}

/**
 * Initializes the menu for selecting the Launchpad mode.
 * Only the 4 official modes (4-7) are displayed.
 */
export function initializeModeMenu() {
    const menu = document.getElementById('mode-menu');
    if (!menu) return;

    const modes = [
        { index: 4, name: 'Session', i18n: 'launchpad.mode.session' },
        { index: 5, name: 'User 1', i18n: 'launchpad.mode.user1' },
        { index: 6, name: 'User 2', i18n: 'launchpad.mode.user2' },
        { index: 7, name: 'Mixer', i18n: 'launchpad.mode.mixer' }
    ];

    modes.forEach(mode => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-mode', mode.index);
        button.setAttribute('data-i18n', mode.i18n);
        button.textContent = mode.name;
        button.onclick = () => {
            if (button.classList.contains('selected')) return;
            import('./interaction.js').then(m => m.changeMode(mode.index));
        };
        menu.appendChild(button);
    });
}

let currentIconUrl = null;

/**
 * Sets the top-right icon from a File object or a URL string.
 * @param {File|string} fileOrUrl - The file object or URL to set as the icon.
 * @returns {Promise<void>}
 */
export function setTopRightIconFile(fileOrUrl) {
    const container = document.getElementById('image-container');
    if (!container || !fileOrUrl) return Promise.resolve();

    if (currentIconUrl && currentIconUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentIconUrl);
    }

    return new Promise((resolve) => {
        let url;
        let isVideo = false;

        if (typeof fileOrUrl === 'string') {
            url = fileOrUrl;
            // Check extension for video
            const ext = url.split('.').pop().toLowerCase();
            if (['mp4', 'webm', 'ogg'].includes(ext)) {
                isVideo = true;
            }
        } else {
            url = URL.createObjectURL(fileOrUrl);
            currentIconUrl = url;
            if (fileOrUrl.type.startsWith('video/')) {
                isVideo = true;
            }
        }

        let el;
        if (isVideo) {
            el = document.createElement('video');
            el.autoplay = true;
            el.loop = true;
            el.muted = true;
            el.playsInline = true;
            el.oncanplay = () => resolve();
            el.onerror = () => {
                console.error(`Error loading icon video: ${url}`);
                resolve();
            };
        } else {
            el = document.createElement('img');
            el.alt = 'immagine';
            el.onload = () => resolve();
            el.onerror = () => {
                console.error(`Error loading icon image: ${url}`);
                resolve();
            };
        }
        el.src = url;
        el.className = 'square-image';
        container.innerHTML = '';
        container.appendChild(el);
    });
}

/**
 * Resets the top-right icon to the default logo.
 * @returns {Promise<void>}
 */
export function resetTopRightIcon() {
    const container = document.getElementById('image-container');
    if (!container) return Promise.resolve();
    if (currentIconUrl && currentIconUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentIconUrl);
    }
    currentIconUrl = null;
    const input = document.getElementById('logo-file-input');
    if (input) input.value = '';

    return new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = 'assets/icons/Logo.png';
        img.alt = 'immagine';
        img.className = 'square-image';
        img.onload = () => resolve();
        img.onerror = () => {
            console.error('Error loading default logo');
            resolve();
        };
        container.innerHTML = '';
        container.appendChild(img);
    });
}