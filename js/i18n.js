/**
 * INTERNATIONALIZATION (i18n.js)
 *
 * Loads locale files, applies translations to static markup (`data-i18n*`
 * attributes) and resolves translation keys for runtime messages.
 * Leaf module: depends only on settings, so any module can import it without
 * pulling in the rest of the UI.
 */

import { getLanguageSetting, setLanguageSetting } from './settings.js';
import { logger } from './logger.js';

const FALLBACK_LANGUAGE = 'it';

let translations = {};

async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error(`Could not load translations for ${lang}`);
        translations = await response.json();
        applyTranslations();
    } catch (error) {
        logger.error("Translation error:", error);
        // Fallback to Italian if not already Italian
        if (lang !== FALLBACK_LANGUAGE) {
            await loadTranslations(FALLBACK_LANGUAGE);
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

export async function initializeLanguageControls() {
    const select = document.getElementById('language-select');
    const saved = getLanguageSetting();
    const initialLang = saved || FALLBACK_LANGUAGE;

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
