import { setBackgroundMedia, setMediaControlsPanelVisible } from './background.js';
import { syncInputSlider } from './formControls.js';
import {
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX,
    AUDIO_EXTENSIONS,
    IMAGE_EXTENSIONS,
    MEDIA_EXTENSIONS,
    toAcceptAttribute,
    DEFAULT_VISUALIZER_COLOR,
    CATALOG_SKINS_PATH,
    toCatalogName
} from './constants.js';
import { setModelPreference } from './launchpadView.js';
import {
    SETTINGS_KEYS,
    DEFAULT_UI_ACCENT,
    getStorageItem,
    getAccentColorSetting,
    setAccentColorSetting,
    getRotationSetting,
    setRotationSetting,
    getScaleSetting,
    setScaleSetting,
    getPanelWidthSetting,
    setPanelWidthSetting
} from './settings.js';
import { logger } from './logger.js';

/**
 * Shows or hides the sidebar.
 */
function toggleSidebar() {
    const layout = document.querySelector('.layout');
    layout.classList.toggle('sidebar-open');
}

/**
 * Opens or closes a dropdown menu in the sidebar.
 * @param {string} menuId - The ID of the menu element to toggle.
 */
function toggleMenu(menuId) {
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

    syncMediaControlsPanel();
}

let currentSkinUrl = null;

/**
 * Sets the Launchpad skin background from a File, path, or URL.
 * @param {File|Blob|string|null} imageFile - The image file, path, or `null` to remove it.
 * @returns {Promise<void>} A promise that resolves when the background is loaded.
 */
// eslint-disable-next-line complexity -- Known debt (complexity 17): refactor, then remove this waiver.
export function setLaunchpadBackground(imageFile) {
    const launchpad = document.getElementById('Launchpad');
    const menu = document.getElementById('personalize-launchpad-menu');

    if (menu) {
        const buttons = menu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
        const selector = typeof imageFile === 'string' && imageFile
            ? `.menu-option[data-skin="${CSS.escape(toCatalogName(imageFile, CATALOG_SKINS_PATH))}"]`
            : '.menu-option[data-skin="none"]';
        const active = menu.querySelector(selector);
        if (active) active.classList.add('selected');
    }

    if (!imageFile) {
        if (currentSkinUrl && currentSkinUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentSkinUrl);
            currentSkinUrl = null;
        }
        if (launchpad) launchpad.style.backgroundImage = 'none';
        return Promise.resolve();
    }

    let url;
    if (typeof imageFile === 'object' && imageFile !== null) {
        url = URL.createObjectURL(imageFile);
    } else {
        url = (imageFile.includes('/') || imageFile.startsWith('blob:') || imageFile.startsWith('data:'))
            ? imageFile
            : `${CATALOG_SKINS_PATH}${imageFile}`;
    }

    const previousSkinUrl = currentSkinUrl;
    currentSkinUrl = url;

    if (previousSkinUrl && previousSkinUrl.startsWith('blob:') && previousSkinUrl !== url) {
        URL.revokeObjectURL(previousSkinUrl);
    }

    return new Promise((resolve) => {
        const fullUrl = (url.startsWith('blob:') || url.startsWith('data:')) ? url : `${url}?t=${Date.now()}`;

        // Create a temporary image to track loading
        const img = new Image();
        img.onload = () => {
            if (launchpad) launchpad.style.backgroundImage = `url('${fullUrl}')`;
            resolve();
        };
        img.onerror = () => {
            logger.error(`Error loading skin: ${fullUrl}`);
            if (launchpad) launchpad.style.backgroundImage = 'none';
            resolve(); // Still resolve to not block loading indefinitely
        };
        img.src = fullUrl;
    });
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

// Single source of truth for the active Customization tab, kept in sync with the
// `.active` classes toggled by switchCustomizationTab().
let activeCustomizationTab = 'launchpad';

/**
 * Switches the active panel inside the Customization menu.
 * @param {string} tabName - 'launchpad' | 'background' | 'visualizer'
 */
function switchCustomizationTab(tabName) {
    activeCustomizationTab = tabName;

    const tabs = document.querySelectorAll('.customization-tab');
    const panels = {
        launchpad: document.getElementById('customization-panel-launchpad'),
        background: document.getElementById('customization-panel-background'),
        visualizer: document.getElementById('customization-panel-visualizer')
    };

    tabs.forEach(tab => {
        const isTarget = tab.dataset.tab === tabName;
        tab.classList.toggle('selected', isTarget);
        tab.setAttribute('aria-selected', String(isTarget));
    });

    // Visibility is driven purely by the `.active` class (see .customization-tab-panel).
    Object.entries(panels).forEach(([name, panel]) => {
        if (!panel) return;
        panel.classList.toggle('active', name === tabName);
    });

    syncMediaControlsPanel();
}

/**
 * Tells the background module whether its media effect controls are on screen:
 * the Customization menu must be open with the Background tab selected.
 */
function syncMediaControlsPanel() {
    const customizationMenu = document.getElementById('customization-menu');
    const isMenuOpen = !!customizationMenu && customizationMenu.classList.contains('open');
    setMediaControlsPanelVisible(isMenuOpen && activeCustomizationTab === 'background');
}

/**
 * Sets the UI accent color and computes matching hover, dim, and glow variations.
 * @param {string} hex - Hex color e.g. '#00aaff'
 * @param {boolean} [persist=true] - Whether to save to localStorage
 */
function setUIAccentColor(hex, persist = true) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return;

    const cleanHex = hex.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(cleanHex)) return;

    const num = parseInt(cleanHex.slice(1), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    const darken = (c) => Math.max(0, Math.min(255, Math.round(c * 0.85)));
    const toHex = (c) => darken(c).toString(16).padStart(2, '0');
    const hoverHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    const dim = `rgba(${r}, ${g}, ${b}, 0.18)`;
    const glow = `rgba(${r}, ${g}, ${b}, 0.35)`;

    if (globalThis.document?.documentElement?.style) {
        document.documentElement.style.setProperty('--accent-blue', cleanHex);
        document.documentElement.style.setProperty('--accent-blue-hover', hoverHex);
        document.documentElement.style.setProperty('--accent-blue-dim', dim);
        document.documentElement.style.setProperty('--accent-blue-glow', glow);
    }

    const picker = globalThis.document?.getElementById ? document.getElementById('ui-accent-color-picker') : null;
    if (picker && picker.value.toLowerCase() !== cleanHex.toLowerCase()) {
        picker.value = cleanHex;
    }

    if (persist) {
        setAccentColorSetting(cleanHex);
    }
}

/**
 * Restores the saved UI accent color from localStorage or applies default.
 */
function restoreUIAccentColor() {
    const saved = getAccentColorSetting(DEFAULT_UI_ACCENT);
    setUIAccentColor(saved || DEFAULT_UI_ACCENT, false);
}

const SIDEBAR_WIDTH_DEFAULT = 260;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 520;

const INSPECTOR_WIDTH_DEFAULT = 310;
const INSPECTOR_WIDTH_MIN = 260;
const INSPECTOR_WIDTH_MAX = 650;

/**
 * Wires a separator element so that dragging it resizes a panel width, exposed
 * as a CSS custom property on <html>. Also supports arrow-key nudging, a
 * default-width reset (double-click / Enter / Space) and persists the width.
 * @param {object} config
 * @param {HTMLElement|null} config.resizer - The separator element.
 * @param {string} config.cssVar - Custom property holding the panel width.
 * @param {number} config.defaultWidth - Fallback / reset width (px).
 * @param {number} config.minWidth - Lower clamp (px).
 * @param {number} config.maxWidth - Upper clamp (px).
 * @param {string} config.storageKey - localStorage key for the persisted width.
 * @param {boolean} [config.invert=false] - True when dragging left grows the panel.
 * @param {number} config.minContentSpace - Min px to keep free for the main content.
 */
let resizeNotificationRafId = null;

/**
 * Coalesces resize event dispatches across animation frames to avoid thrashing
 * expensive resize listeners (e.g. canvas reallocations) during dragging.
 */
function notifyThrottledResize() {
    if (resizeNotificationRafId !== null) return;
    const requestFrame = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 16);

    resizeNotificationRafId = requestFrame(() => {
        resizeNotificationRafId = null;
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('resize'));
        }
    });
}

function setupPanelResizer({ resizer, cssVar, defaultWidth, minWidth, maxWidth, storageKey, invert = false, minContentSpace }) {
    const layout = document.querySelector('.layout');
    if (!resizer || !layout) return;

    const root = document.documentElement;
    const readWidth = () => {
        const computed = parseInt(getComputedStyle(root).getPropertyValue(cssVar), 10);
        return Number.isFinite(computed) ? computed : defaultWidth;
    };
    const clamp = (width) => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const contentAwareMax = Math.min(maxWidth, viewportWidth - minContentSpace);
        const effectiveMax = Math.max(minWidth, contentAwareMax);
        return Math.max(minWidth, Math.min(effectiveMax, Math.round(width)));
    };
    const applyWidth = (width) => {
        const current = readWidth();
        if (current === width) return;
        root.style.setProperty(cssVar, `${width}px`);
        resizer.setAttribute('aria-valuenow', String(width));
        notifyThrottledResize();
    };
    const rememberWidth = (width) => setPanelWidthSetting(storageKey, width);
    const getPreferredWidth = () => {
        return getPanelWidthSetting(storageKey, defaultWidth, minWidth, maxWidth);
    };

    // Initialize WAI-ARIA separator attributes
    resizer.setAttribute('aria-valuemin', String(minWidth));
    resizer.setAttribute('aria-valuemax', String(maxWidth));

    // Clamp saved width against current viewport space on load without destroying desktop preference
    const initialWidth = clamp(getPreferredWidth());
    root.style.setProperty(cssVar, `${initialWidth}px`);
    resizer.setAttribute('aria-valuenow', String(initialWidth));

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        startWidth = readWidth();
        resizer.setPointerCapture(e.pointerId);
        resizer.classList.add('is-dragging');
        layout.classList.add('is-resizing');
        e.preventDefault();
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const delta = invert ? startX - e.clientX : e.clientX - startX;
        applyWidth(clamp(startWidth + delta));
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        try { resizer.releasePointerCapture(e.pointerId); } catch (_) {}
        resizer.classList.remove('is-dragging');
        layout.classList.remove('is-resizing');
        rememberWidth(readWidth());
        notifyThrottledResize();
    };

    const resetWidth = () => {
        applyWidth(defaultWidth);
        rememberWidth(defaultWidth);
    };

    // Re-adapt active panel width when the viewport changes, preserving minimum content space
    const onWindowResize = () => {
        if (isDragging) return;
        const current = readWidth();
        const clamped = clamp(getPreferredWidth());
        if (current !== clamped) {
            applyWidth(clamped);
        }
    };
    window.addEventListener('resize', onWindowResize);

    // Arrow keys nudge the width; Enter/Space restores the default.
    const growKeys = invert ? ['ArrowLeft', 'ArrowUp'] : ['ArrowRight', 'ArrowUp'];
    const shrinkKeys = invert ? ['ArrowRight', 'ArrowDown'] : ['ArrowLeft', 'ArrowDown'];

    const onKeyDown = (e) => {
        const step = e.shiftKey ? 30 : 10;
        let nextWidth = null;
        if (growKeys.includes(e.key)) {
            nextWidth = clamp(readWidth() + step);
        } else if (shrinkKeys.includes(e.key)) {
            nextWidth = clamp(readWidth() - step);
        } else if (e.key === 'Enter' || e.key === ' ') {
            resetWidth();
            e.preventDefault();
            return;
        } else {
            return;
        }
        applyWidth(nextWidth);
        rememberWidth(nextWidth);
        e.preventDefault();
    };

    resizer.addEventListener('pointerdown', onPointerDown);
    resizer.addEventListener('pointermove', onPointerMove);
    resizer.addEventListener('pointerup', onPointerUp);
    resizer.addEventListener('pointercancel', onPointerUp);
    resizer.addEventListener('dblclick', resetWidth);
    resizer.addEventListener('keydown', onKeyDown);
}

/**
 * Initializes resizable side panels (sidebar on the left, project inspector on the right).
 */
function initializeResizablePanels() {
    setupPanelResizer({
        resizer: document.getElementById('sidebar-resizer'),
        cssVar: '--sidebar-width',
        defaultWidth: SIDEBAR_WIDTH_DEFAULT,
        minWidth: SIDEBAR_WIDTH_MIN,
        maxWidth: SIDEBAR_WIDTH_MAX,
        storageKey: SETTINGS_KEYS.SIDEBAR_WIDTH,
        minContentSpace: 300
    });

    setupPanelResizer({
        resizer: document.getElementById('inspector-resizer'),
        cssVar: '--inspector-width',
        defaultWidth: INSPECTOR_WIDTH_DEFAULT,
        minWidth: INSPECTOR_WIDTH_MIN,
        maxWidth: INSPECTOR_WIDTH_MAX,
        storageKey: SETTINGS_KEYS.INSPECTOR_WIDTH,
        invert: true,
        minContentSpace: 350
    });
}

/**
 * Binds all static UI event listeners that previously relied on inline
 * onclick/onchange attributes in HTML or window.* globals.
 * Called once from app.js after DOMContentLoaded.
 * @param {object} [handlers]
 * @param {function(): void} [handlers.onResetProjectAppearance] - Restores the active project's appearance.
 */
export function bindStaticUIEvents({ onResetProjectAppearance } = {}) {
    // Initialize UI accent color and resizable side panels
    restoreUIAccentColor();
    initializeResizablePanels();

    // UI Accent Color Picker (updates in real-time, persists only on change)
    const accentPicker = document.getElementById('ui-accent-color-picker');
    if (accentPicker) {
        accentPicker.addEventListener('input', (e) => {
            setUIAccentColor(e.target.value, false);
        });
        accentPicker.addEventListener('change', (e) => {
            setUIAccentColor(e.target.value, true);
        });
    }

    // Reset Accent Button
    const resetAccentBtn = document.getElementById('ui-accent-reset-btn');
    if (resetAccentBtn) {
        resetAccentBtn.addEventListener('click', () => {
            setUIAccentColor(DEFAULT_UI_ACCENT, true);
        });
    }

    // Sidebar open/close
    const openSidebarBtn = document.getElementById('openSidebar');
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', toggleSidebar);
    }

    // Menu toggle buttons — each carries data-menu="<menuId>" set in index.html
    document.querySelectorAll('.menu-toggle[data-menu]').forEach(btn => {
        btn.addEventListener('click', () => toggleMenu(btn.dataset.menu));
    });

    // Customization tabs (Launchpad, Sfondo, Visualizzatore)
    document.querySelectorAll('.customization-tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            switchCustomizationTab(tab.dataset.tab);
        });
    });

    // Launchpad Model selection dropdown
    const modelSelect = document.getElementById('launchpad-model-select');
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            setModelPreference(e.target.value);
        });
    }

    // Preserve custom icon when Launchpad model view switches
    window.addEventListener('launchpad-view-changed', () => {
        if (currentIconUrl) {
            setTopRightIconFile(currentIconUrl, currentIconIsVideo);
        }
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

    // "Clear background" button (data-background="none")
    const clearBgBtn = document.querySelector('.menu-option[data-background="none"]');
    if (clearBgBtn) {
        clearBgBtn.addEventListener('click', () => {
            if (clearBgBtn.classList.contains('selected')) return;
            setBackgroundMedia(null);
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

    // "Reset project appearance" button in sidebar. The action itself belongs to
    // the project layer, so it is injected by the composition root (app.js).
    const resetAppearanceBtn = document.getElementById('reset-project-appearance');
    if (resetAppearanceBtn && typeof onResetProjectAppearance === 'function') {
        resetAppearanceBtn.addEventListener('click', onResetProjectAppearance);
    }

    // File pickers' `accept` lists come from the same extension lists used by
    // project import/export, so every accepted file can actually be packaged.
    const acceptByInput = {
        'background-file-input': MEDIA_EXTENSIONS,
        'logo-file-input': MEDIA_EXTENSIONS,
        'creator-bg-file': MEDIA_EXTENSIONS,
        'creator-skin-file': IMAGE_EXTENSIONS,
        'creator-icon-file': MEDIA_EXTENSIONS,
        'creator-sample-file': AUDIO_EXTENSIONS
    };
    Object.entries(acceptByInput).forEach(([id, extensions]) => {
        const input = document.getElementById(id);
        if (input) input.setAttribute('accept', toAcceptAttribute(extensions));
    });

    // Visualizer colour inputs share a single default colour.
    ['color1-picker', 'color2-picker', 'creator-viz-color1', 'creator-viz-color2'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = DEFAULT_VISUALIZER_COLOR;
    });
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

/**
 * Initializes the menu for selecting the Launchpad mode.
 * Only the 4 official modes (4-7) are displayed.
 * @param {function(number): void} onSelectMode - Called with the selected mode index.
 */
export function initializeModeMenu(onSelectMode) {
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
            onSelectMode(mode.index);
        };
        menu.appendChild(button);
    });
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
