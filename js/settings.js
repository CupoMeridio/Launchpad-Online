/**
 * APPLICATION SETTINGS & PERSISTENCE (settings.js)
 * 
 * Centralized, safe access to user settings and localStorage.
 * Handles storage unavailability (private browsing, quotas, disabled cookies, headless tests)
 * with robust defaults and value validation.
 */

import {
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX
} from './constants.js';

export const SETTINGS_KEYS = {
    LANGUAGE: 'ui.language',
    ACCENT_COLOR: 'ui.accentColor',
    ROTATION: 'launchpad.rotation',
    SCALE: 'launchpad.scale',
    MODEL_PREFERENCE: 'launchpad_model_preference',
    SIDEBAR_WIDTH: 'ui.sidebarWidth',
    INSPECTOR_WIDTH: 'ui.inspectorWidth',
    DEBUG: 'launchpad.debug'
};

export const DEFAULT_UI_ACCENT = '#00aaff';

/**
 * Language used until the user picks one (then their choice is remembered),
 * and the fallback when a locale file cannot be loaded.
 */
export const DEFAULT_LANGUAGE = 'en';

const SETTINGS_DEFAULTS = {
    [SETTINGS_KEYS.LANGUAGE]: DEFAULT_LANGUAGE,
    [SETTINGS_KEYS.ACCENT_COLOR]: DEFAULT_UI_ACCENT,
    [SETTINGS_KEYS.ROTATION]: 0,
    [SETTINGS_KEYS.SCALE]: 1,
    [SETTINGS_KEYS.MODEL_PREFERENCE]: 'auto',
    [SETTINGS_KEYS.SIDEBAR_WIDTH]: 260,
    [SETTINGS_KEYS.INSPECTOR_WIDTH]: 310,
    [SETTINGS_KEYS.DEBUG]: '0'
};

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Safely retrieve a raw string from localStorage.
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
export function getStorageItem(key, defaultValue = null) {
    try {
        if (typeof localStorage === 'undefined' || !localStorage) return defaultValue;
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch {
        return defaultValue;
    }
}

/**
 * Safely store a value in localStorage.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} True if successfully stored.
 */
function setStorageItem(key, value) {
    try {
        if (typeof localStorage === 'undefined' || !localStorage) return false;
        localStorage.setItem(key, String(value));
        return true;
    } catch {
        return false;
    }
}

/**
 * Safely remove an item from localStorage.
 * @param {string} key
 * @returns {boolean} True if successfully removed.
 */
function removeStorageItem(key) {
    try {
        if (typeof localStorage === 'undefined' || !localStorage) return false;
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// TYPED GETTERS & SETTERS
// ============================================================================

export function getLanguageSetting(defaultValue = SETTINGS_DEFAULTS[SETTINGS_KEYS.LANGUAGE]) {
    const val = getStorageItem(SETTINGS_KEYS.LANGUAGE, defaultValue);
    return (typeof val === 'string' && val.length >= 2) ? val : defaultValue;
}

export function setLanguageSetting(lang) {
    if (typeof lang === 'string' && lang.length >= 2) {
        return setStorageItem(SETTINGS_KEYS.LANGUAGE, lang);
    }
    return false;
}

export function getAccentColorSetting(defaultValue = DEFAULT_UI_ACCENT) {
    const val = getStorageItem(SETTINGS_KEYS.ACCENT_COLOR, defaultValue);
    return (typeof val === 'string' && HEX_COLOR_REGEX.test(val.trim())) ? val.trim() : defaultValue;
}

export function setAccentColorSetting(hex) {
    if (hex === null || hex === DEFAULT_UI_ACCENT) {
        return removeStorageItem(SETTINGS_KEYS.ACCENT_COLOR);
    }
    if (typeof hex === 'string' && HEX_COLOR_REGEX.test(hex.trim())) {
        return setStorageItem(SETTINGS_KEYS.ACCENT_COLOR, hex.trim());
    }
    return false;
}

export function getRotationSetting(defaultValue = SETTINGS_DEFAULTS[SETTINGS_KEYS.ROTATION]) {
    const raw = getStorageItem(SETTINGS_KEYS.ROTATION, null);
    if (raw === null || raw === '') return defaultValue;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed)
        ? Math.max(LAUNCHPAD_ROTATION_MIN, Math.min(LAUNCHPAD_ROTATION_MAX, parsed))
        : defaultValue;
}

export function setRotationSetting(angle) {
    if (angle === null) return removeStorageItem(SETTINGS_KEYS.ROTATION);
    const parsed = Number.parseFloat(angle);
    if (Number.isFinite(parsed)) {
        const clamped = Math.max(LAUNCHPAD_ROTATION_MIN, Math.min(LAUNCHPAD_ROTATION_MAX, parsed));
        return setStorageItem(SETTINGS_KEYS.ROTATION, clamped);
    }
    return false;
}

export function getScaleSetting(defaultValue = SETTINGS_DEFAULTS[SETTINGS_KEYS.SCALE]) {
    const raw = getStorageItem(SETTINGS_KEYS.SCALE, null);
    if (raw === null || raw === '') return defaultValue;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return defaultValue;
    const minRatio = LAUNCHPAD_SIZE_MIN / 100;
    const maxRatio = LAUNCHPAD_SIZE_MAX / 100;
    return Math.max(minRatio, Math.min(maxRatio, parsed));
}

export function setScaleSetting(scaleRatio) {
    if (scaleRatio === null) return removeStorageItem(SETTINGS_KEYS.SCALE);
    const parsed = Number.parseFloat(scaleRatio);
    if (Number.isFinite(parsed)) {
        const minRatio = LAUNCHPAD_SIZE_MIN / 100;
        const maxRatio = LAUNCHPAD_SIZE_MAX / 100;
        const clamped = Math.max(minRatio, Math.min(maxRatio, parsed));
        return setStorageItem(SETTINGS_KEYS.SCALE, clamped);
    }
    return false;
}

export function getModelPreferenceSetting(allowedModels = ['auto', 'classic', 'mk3', 'pro', 'pro-mk3']) {
    const raw = getStorageItem(SETTINGS_KEYS.MODEL_PREFERENCE, 'auto');
    return allowedModels.includes(raw) ? raw : 'auto';
}

export function setModelPreferenceSetting(model) {
    return setStorageItem(SETTINGS_KEYS.MODEL_PREFERENCE, model);
}

export function getPanelWidthSetting(storageKey, defaultWidth, minWidth = 150, maxWidth = 800) {
    const raw = getStorageItem(storageKey, null);
    if (raw === null || raw === '') return defaultWidth;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return defaultWidth;
    return (parsed >= minWidth && parsed <= maxWidth) ? parsed : defaultWidth;
}

export function setPanelWidthSetting(storageKey, width) {
    const parsed = Number.parseInt(width, 10);
    if (Number.isFinite(parsed)) {
        return setStorageItem(storageKey, parsed);
    }
    return false;
}

export function isDebugSettingEnabled() {
    try {
        if (typeof window !== 'undefined') {
            const search = window.location?.search || '';
            if (new URLSearchParams(search).has('debug')) return true;
        }
        return getStorageItem(SETTINGS_KEYS.DEBUG, '0') === '1';
    } catch {
        return false;
    }
}
