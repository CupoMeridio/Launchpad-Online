import { updateVideoControlsVisibility } from './video.js';
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
    const saved = localStorage.getItem('ui.language');
    const initialLang = saved || 'it';

    if (select) {
        select.value = initialLang;
        select.addEventListener('change', async function () {
            const newLang = this.value;
            localStorage.setItem('ui.language', newLang);
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
        // If the imageFile path contains a slash, assume it's a full path,
        // otherwise assume it's a file in the default assets/images/launchpad covers/ directory.
        const imageSrc = imageFile.includes('/') ? imageFile : `assets/images/launchpad covers/${imageFile}`;
        launchpad.style.backgroundImage = `url('${imageSrc}?t=${new Date().getTime()}')`;
    } else {
        launchpad.style.backgroundImage = 'none';
    }
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
 * Helper to synchronize a slider (range input) with a number input.
 * @param {string} sliderId - The ID of the slider element.
 * @param {string} inputId - The ID of the number input element.
 * @param {Function} callback - Function to call when the value changes.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @param {boolean} isFloat - Whether the value is a float.
 */
export function syncInputSlider(sliderId, inputId, callback, min, max, isFloat = false) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);

    if (!slider || !input) return;

    const updateValue = (val, source) => {
        let value = isFloat ? parseFloat(val) : parseInt(val, 10);

        if (isNaN(value)) return;

        // Only clamp if it's not a partial manual input
        const clampedValue = Math.max(min, Math.min(max, value));

        if (source === 'slider') {
            input.value = String(clampedValue);
            callback(clampedValue);
        } else if (source === 'input') {
            // For manual input, we only update the slider and callback if the value is within range
            // This allows the user to type "1" then "10" then "100" without jumping to "50"
            if (value >= min && value <= max) {
                slider.value = String(value);
                callback(value);
            }
        }
    };

    slider.addEventListener('input', function () {
        updateValue(this.value, 'slider');
    });

    input.addEventListener('input', function () {
        updateValue(this.value, 'input');
    });

    // Final clamp and sync on blur (when user finishes typing)
    input.addEventListener('blur', function () {
        let value = isFloat ? parseFloat(this.value) : parseInt(this.value, 10);
        if (isNaN(value)) value = min;
        const clampedValue = Math.max(min, Math.min(max, value));
        this.value = String(clampedValue);
        slider.value = String(clampedValue);
        callback(clampedValue);
    });
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
    const savedRotation = localStorage.getItem('launchpad.rotation');

    if (savedRotation !== null) {
        currentRotation = parseInt(savedRotation, 10);
        if (rotationSlider) rotationSlider.value = savedRotation;
        if (rotationInput) rotationInput.value = savedRotation;
    } else if (rotationSlider) {
        currentRotation = parseInt(rotationSlider.value, 10);
    }
    applyLaunchpadTransform();
    syncInputSlider('rotation-slider', 'rotation-input', setLaunchpadRotation, 0, 360);

    // Size synchronization
    const sizeSlider = document.getElementById('size-slider');
    const sizeInput = document.getElementById('size-input');
    const savedSize = localStorage.getItem('launchpad.size');

    if (savedSize !== null) {
        currentScale = parseInt(savedSize, 10) / 100;
        if (sizeSlider) sizeSlider.value = savedSize;
        if (sizeInput) sizeInput.value = savedSize;
    } else if (sizeSlider) {
        currentScale = parseInt(sizeSlider.value, 10) / 100;
    }
    applyLaunchpadTransform();
    syncInputSlider('size-slider', 'size-input', setLaunchpadSize, 50, 140);

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

let currentRotation = 0;
let currentScale = 1;

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
            import('./video.js').then(m => m.clearBackground());
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
        launchpad.style.transform = `rotate(${currentRotation}deg) scale(${currentScale})`;
    }
}

export function setLaunchpadRotation(angle) {
    currentRotation = angle;
    localStorage.setItem('launchpad.rotation', angle);
    applyLaunchpadTransform();
}

export function setLaunchpadSize(size) {
    currentScale = size / 100;
    localStorage.setItem('launchpad.size', size);
    applyLaunchpadTransform();
}

let currentIconUrl = null;
export function setTopRightIconFile(file) {
    const container = document.getElementById('image-container');
    if (!container || !file) return;
    if (currentIconUrl) {
        URL.revokeObjectURL(currentIconUrl);
        currentIconUrl = null;
    }
    const url = URL.createObjectURL(file);
    currentIconUrl = url;
    let el;
    if (file.type.startsWith('video/')) {
        el = document.createElement('video');
        el.autoplay = true;
        el.loop = true;
        el.muted = true;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.alt = 'immagine';
    }
    el.src = url;
    el.className = 'square-image';
    container.innerHTML = '';
    container.appendChild(el);
}

export function resetTopRightIcon() {
    const container = document.getElementById('image-container');
    if (!container) return;
    if (currentIconUrl) {
        URL.revokeObjectURL(currentIconUrl);
        currentIconUrl = null;
    }
    const input = document.getElementById('logo-file-input');
    if (input) input.value = '';
    const img = document.createElement('img');
    img.src = 'assets/icons/Logo.png';
    img.alt = 'immagine';
    img.className = 'square-image';
    container.innerHTML = '';
    container.appendChild(img);
}