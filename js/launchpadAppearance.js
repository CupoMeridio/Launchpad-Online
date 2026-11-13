/**
 * LAUNCHPAD APPEARANCE (launchpadAppearance.js)
 *
 * How the virtual Launchpad looks: skin (cover image), stickers, the top-right
 * icon, and its rotation/size. Rotation/size live in two layers:
 * - what is currently applied, which may be a project or Studio draft override;
 * - the user's own saved preference, which overrides must never overwrite.
 *
 * Also builds the "Personalize Launchpad" menu. appearance.js applies a
 * project's appearance through this module.
 */

import { syncInputSlider } from './formControls.js';
import {
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX,
    CATALOG_SKINS_PATH,
    toCatalogName
} from './constants.js';
import {
    SETTINGS_KEYS,
    getStorageItem,
    getRotationSetting,
    setRotationSetting,
    getScaleSetting,
    setScaleSetting
} from './settings.js';
import { logger } from './logger.js';

let currentSkinUrl = null;

const isInlineUrl = url => url.startsWith('blob:') || url.startsWith('data:');

/**
 * Marks the skin's entry in the "Personalize Launchpad" menu as selected
 * (the "none" entry when there is no skin or it is not a catalog skin name).
 * @param {File|Blob|string|null} imageFile
 */
function highlightSkinMenuOption(imageFile) {
    const menu = document.getElementById('personalize-launchpad-menu');
    if (!menu) return;
    menu.querySelectorAll('.menu-option').forEach(b => b.classList.remove('selected'));
    const selector = typeof imageFile === 'string' && imageFile
        ? `.menu-option[data-skin="${CSS.escape(toCatalogName(imageFile, CATALOG_SKINS_PATH))}"]`
        : '.menu-option[data-skin="none"]';
    menu.querySelector(selector)?.classList.add('selected');
}

/**
 * URL to load for a skin: a blob URL for an uploaded file, the bundled covers
 * folder for a bare catalog name, otherwise the path/URL itself.
 * @param {File|Blob|string} imageFile
 * @returns {string}
 */
function resolveSkinUrl(imageFile) {
    if (typeof imageFile === 'object') return URL.createObjectURL(imageFile);
    return imageFile.includes('/') || isInlineUrl(imageFile) ? imageFile : `${CATALOG_SKINS_PATH}${imageFile}`;
}

/**
 * Records the skin URL in use, releasing the previous blob URL if it changed.
 * @param {string|null} url
 */
function replaceCurrentSkinUrl(url) {
    const previous = currentSkinUrl;
    currentSkinUrl = url;
    if (previous && previous.startsWith('blob:') && previous !== url) {
        URL.revokeObjectURL(previous);
    }
}

/**
 * Shows the skin once its image has loaded; on error the Launchpad is cleared.
 * Always resolves, so a broken skin never blocks project loading.
 * @param {HTMLElement|null} launchpad
 * @param {string} url
 * @returns {Promise<void>}
 */
function loadSkinImage(launchpad, url) {
    const fullUrl = isInlineUrl(url) ? url : `${url}?t=${Date.now()}`;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (launchpad) launchpad.style.backgroundImage = `url('${fullUrl}')`;
            resolve();
        };
        img.onerror = () => {
            logger.error(`Error loading skin: ${fullUrl}`);
            if (launchpad) launchpad.style.backgroundImage = 'none';
            resolve();
        };
        img.src = fullUrl;
    });
}

/**
 * Sets the Launchpad skin background from a File, path, or URL.
 * @param {File|Blob|string|null} imageFile - The image file, path, or `null` to remove it.
 * @returns {Promise<void>} A promise that resolves when the background is loaded.
 */
export function setLaunchpadBackground(imageFile) {
    const launchpad = document.getElementById('Launchpad');
    highlightSkinMenuOption(imageFile);

    if (!imageFile) {
        replaceCurrentSkinUrl(null);
        if (launchpad) launchpad.style.backgroundImage = 'none';
        return Promise.resolve();
    }

    const url = resolveSkinUrl(imageFile);
    replaceCurrentSkinUrl(url);
    return loadSkinImage(launchpad, url);
}

/**
 * Shows or hides the pad "stickers".
 * @param {boolean} isActive - `true` to show stickers, `false` to hide them.
 */
function toggleLaunchpadStickers(isActive) {
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

    // Rotation/scale controls start from the saved preference, seeding it from
    // the controls' own defaults on first run.
    const rotationSlider = document.getElementById('rotation-slider');
    if (rotationSlider && getStorageItem(SETTINGS_KEYS.ROTATION, null) === null) {
        setSettingValue('rotation', parseInt(rotationSlider.value, 10));
    }
    const sizeSlider = document.getElementById('size-slider');
    if (sizeSlider && getStorageItem(SETTINGS_KEYS.SCALE, null) === null) {
        setSettingValue('scale', parseInt(sizeSlider.value, 10) / 100);
    }
    restoreLaunchpadLayout();
    syncInputSlider({
        sliderId: 'rotation-slider',
        inputId: 'rotation-input',
        min: LAUNCHPAD_ROTATION_MIN,
        max: LAUNCHPAD_ROTATION_MAX,
        onChange: setLaunchpadRotation
    });
    syncInputSlider({
        sliderId: 'size-slider',
        inputId: 'size-input',
        min: LAUNCHPAD_SIZE_MIN,
        max: LAUNCHPAD_SIZE_MAX,
        onChange: setLaunchpadSize
    });

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
 * Launchpad UI settings, in two layers:
 * - `launchpadSettings` is what is currently applied to the Launchpad and may
 *   come from a project or Studio draft override.
 * - `launchpadPreference` is the user's own saved rotation/size, which overrides
 *   must never touch. It is mirrored in storage but kept in memory too, so it
 *   survives even when storage is unavailable.
 */
let launchpadSettings = {
    rotation: 0,
    scale: 1
};

let launchpadPreference = {
    rotation: 0,
    scale: 1
};

let launchpadPreferenceLoaded = false;

/**
 * Gets the currently applied value of a launchpad setting.
 * @param {string} key - Setting key (e.g., 'rotation', 'scale')
 * @param {*} defaultValue - Default if not set
 * @returns {*} The setting value
 */
function getSettingValue(key, defaultValue = null) {
    return launchpadSettings[key] !== undefined ? launchpadSettings[key] : defaultValue;
}

/**
 * Loads the user's saved layout preference from storage on first use.
 */
function ensureLaunchpadPreference() {
    if (launchpadPreferenceLoaded) return;
    launchpadPreferenceLoaded = true;
    launchpadPreference.rotation = getRotationSetting(0);
    launchpadPreference.scale = getScaleSetting(1);
}

/**
 * Applies a launchpad setting. Project and draft overrides pass `persist = false`
 * so they are never written as the user's personal preference.
 * @param {string} key - Setting key (e.g., 'rotation', 'scale')
 * @param {*} value - Value to set
 * @param {boolean} persist - Whether to save the value as the user preference
 */
function setSettingValue(key, value, persist = true) {
    launchpadSettings[key] = value;
    if (persist) {
        ensureLaunchpadPreference();
        launchpadPreference[key] = value;
        if (key === 'rotation') {
            setRotationSetting(value);
        } else if (key === 'scale') {
            setScaleSetting(value);
        }
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

/**
 * Applies a rotation to the Launchpad.
 * @param {number} angle - Rotation in degrees.
 * @param {boolean} persist - False for project/draft overrides, which must not
 *   become the user's saved preference.
 */
export function setLaunchpadRotation(angle, persist = true) {
    setSettingValue('rotation', angle, persist);
    applyLaunchpadTransform();
    const slider = document.getElementById('rotation-slider');
    const input = document.getElementById('rotation-input');
    if (slider) slider.value = angle;
    if (input) input.value = angle;
}

/**
 * Applies a size to the Launchpad.
 * @param {number} size - Size as a percentage.
 * @param {boolean} persist - False for project/draft overrides, which must not
 *   become the user's saved preference.
 */
export function setLaunchpadSize(size, persist = true) {
    setSettingValue('scale', size / 100, persist);
    applyLaunchpadTransform();
    const slider = document.getElementById('size-slider');
    const input = document.getElementById('size-input');
    if (slider) slider.value = size;
    if (input) input.value = size;
}

/**
 * Returns the rotation the user personally saved, independent of any project or
 * draft override currently applied.
 * @returns {number} Rotation in degrees.
 */
export function getLaunchpadRotation() {
    ensureLaunchpadPreference();
    return launchpadPreference.rotation;
}

/**
 * Returns the size the user personally saved, independent of any project or
 * draft override currently applied.
 * @returns {number} Size as a percentage.
 */
export function getLaunchpadSize() {
    ensureLaunchpadPreference();
    return Math.round(launchpadPreference.scale * 100);
}

/**
 * Re-applies the rotation/size the user personally saved. Used when a project or
 * draft leaves an aspect unspecified, so an override is never mistaken for a
 * preference and the user's own value comes back.
 * @param {{rotation?: boolean, size?: boolean}} [aspects]
 */
export function restoreLaunchpadLayout({ rotation = true, size = true } = {}) {
    if (rotation) setLaunchpadRotation(getLaunchpadRotation(), false);
    if (size) setLaunchpadSize(getLaunchpadSize(), false);
}

let currentIconUrl = null;
let currentIconIsVideo = false;

/**
 * Returns the currently active top-right icon URL, if any.
 * @returns {string|null}
 */
export function getCurrentIconUrl() {
    return currentIconUrl;
}

/**
 * Sets the top-right icon from a File object or a URL string.
 * @param {File|string} fileOrUrl - The file object or URL to set as the icon.
 * @param {boolean|null} [isExplicitVideo=null] - Optional override if known to be a video.
 * @returns {Promise<void>}
 */
export function setTopRightIconFile(fileOrUrl, isExplicitVideo = null) {
    if (!fileOrUrl) return Promise.resolve();

    let url;
    let isVideo = isExplicitVideo !== null ? isExplicitVideo : false;

    if (typeof fileOrUrl === 'string') {
        url = fileOrUrl;
        if (isExplicitVideo === null) {
            // Check extension for video
            const ext = url.split('.').pop().toLowerCase();
            if (['mp4', 'webm', 'ogg'].includes(ext)) {
                isVideo = true;
            }
        }
    } else {
        url = URL.createObjectURL(fileOrUrl);
        if (fileOrUrl.type.startsWith('video/')) {
            isVideo = true;
        }
    }

    const previousIconUrl = currentIconUrl;
    currentIconUrl = url;
    currentIconIsVideo = isVideo;

    // Release the previous blob URL only when it is actually replaced,
    // so re-applying the same icon (e.g. after a view re-render) keeps working.
    if (previousIconUrl && previousIconUrl.startsWith('blob:') && previousIconUrl !== url) {
        URL.revokeObjectURL(previousIconUrl);
    }

    const container = document.getElementById('image-container');
    if (!container) return Promise.resolve();

    return new Promise((resolve) => {
        let el;
        if (isVideo) {
            el = document.createElement('video');
            el.autoplay = true;
            el.loop = true;
            el.muted = true;
            el.playsInline = true;
            el.oncanplay = () => resolve();
            el.onerror = () => {
                logger.error(`Error loading icon video: ${url}`);
                resolve();
            };
        } else {
            el = document.createElement('img');
            el.alt = 'immagine';
            el.onload = () => resolve();
            el.onerror = () => {
                logger.error(`Error loading icon image: ${url}`);
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
    if (currentIconUrl && currentIconUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentIconUrl);
    }
    currentIconUrl = null;
    currentIconIsVideo = false;
    const input = document.getElementById('logo-file-input');
    if (input) input.value = '';

    const container = document.getElementById('image-container');
    if (!container) return Promise.resolve();

    return new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = 'assets/icons/Logo.png';
        img.alt = 'immagine';
        img.className = 'square-image';
        img.onload = () => resolve();
        img.onerror = () => {
            logger.error('Error loading default logo');
            resolve();
        };
        container.innerHTML = '';
        container.appendChild(img);
    });
}

/**
 * Binds the static Launchpad appearance controls (stickers, default skin,
 * icon reset) and keeps a custom icon across Launchpad model switches.
 */
export function bindLaunchpadAppearanceControls() {
    window.addEventListener('launchpad-view-changed', () => {
        if (currentIconUrl) {
            setTopRightIconFile(currentIconUrl, currentIconIsVideo);
        }
    });

    const stickersCheckbox = document.getElementById('toggle-stickers');
    if (stickersCheckbox) {
        stickersCheckbox.addEventListener('change', function () {
            toggleLaunchpadStickers(this.checked);
        });
    }

    const resetIconBtn = document.querySelector('[data-action="resetTopRightIcon"]');
    if (resetIconBtn) {
        resetIconBtn.addEventListener('click', resetTopRightIcon);
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
