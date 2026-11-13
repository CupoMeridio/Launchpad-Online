/**
 * INTERNATIONALIZATION (i18n.js)
 *
 * Loads locale files, applies translations to static markup (`data-i18n*`
 * attributes) and resolves translation keys for runtime messages.
 * Leaf module: depends only on settings, so any module can import it without
 * pulling in the rest of the UI.
 */

import { DEFAULT_LANGUAGE, getLanguageSetting, setLanguageSetting } from './settings.js';
import { logger } from './logger.js';

/** Languages with a locale file in locales/ (and an entry in the language menu). */
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'it', 'es', 'de', 'fr']);

let translations = {};

async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error(`Could not load translations for ${lang}`);
        translations = await response.json();
        document.documentElement.lang = lang;
        applyTranslations();
    } catch (error) {
        logger.error("Translation error:", error);
        // Fall back to the default language (English) unless it is the one failing.
        if (lang !== DEFAULT_LANGUAGE) {
            await loadTranslations(DEFAULT_LANGUAGE);
        }
    }
}

// Attributes that can be localized from static HTML via `data-i18n-<attribute>`
// (e.g. data-i18n-aria-label="a11y.resizeSidebar").
const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'title'];

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = translations[key];
        if (typeof text === 'string') {
            el.textContent = text;
        }
    });

    TRANSLATABLE_ATTRIBUTES.forEach(attr => {
        const dataAttribute = `data-i18n-${attr}`;
        document.querySelectorAll(`[${dataAttribute}]`).forEach(el => {
            const text = translations[el.getAttribute(dataAttribute)];
            if (typeof text === 'string') {
                el.setAttribute(attr, text);
            }
        });
    });
}

export function getTranslation(key) {
    return translations[key] || key;
}

/**
 * The first of the browser's preferred languages the app supports, matched on
 * the primary subtag ('it-CH' -> 'it'), or the default language.
 * @param {readonly string[]} [preferred] - Defaults to the browser's preferences.
 * @returns {string}
 */
export function detectBrowserLanguage(preferred = browserLanguages()) {
    for (const tag of preferred) {
        const code = typeof tag === 'string' ? tag.toLowerCase().split('-')[0] : '';
        if (SUPPORTED_LANGUAGES.includes(code)) return code;
    }
    return DEFAULT_LANGUAGE;
}

function browserLanguages() {
    const nav = globalThis.navigator;
    if (nav?.languages?.length) return nav.languages;
    return nav?.language ? [nav.language] : [];
}

/**
 * Loads the user's language: the one they picked (remembered), otherwise the
 * browser's (not saved, so it follows browser changes until the user picks).
 */
export async function initializeLanguageControls() {
    const select = document.getElementById('language-select');
    const initialLang = getLanguageSetting(null) || detectBrowserLanguage();

    if (select) {
        select.value = initialLang;
        select.addEventListener('change', async function () {
            const newLang = this.value;
            setLanguageSetting(newLang);
            await loadTranslations(newLang);
        });
    }

    await loadTranslations(initialLang);
}

/**
 * Resolves a translation key and fills `{name}` placeholders.
 * @param {string} key - Translation key.
 * @param {Record<string, string|number>} [values] - Placeholder values.
 * @returns {string}
 */
export function translate(key, values = {}) {
    return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        getTranslation(key)
    );
}
