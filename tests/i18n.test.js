/**
 * Tests for js/i18n.js: locale loading with fallback, static markup
 * translation (text and attributes), language switching and placeholders.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createElement, createRecordingSink } from './helpers/browserStubs.js';

const { elements } = installBrowserStubs();

// ---- Storage and markup -------------------------------------------------------
const storage = new Map();
globalThis.localStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
};

const title = createElement('h1', { id: 'title' });
title.setAttribute('data-i18n', 'app.title');
const resizer = createElement('div', { id: 'resizer' });
resizer.setAttribute('data-i18n-aria-label', 'a11y.resize');
resizer.setAttribute('data-i18n-title', 'a11y.resizeHint');
const untranslated = createElement('span', { id: 'untranslated' });
untranslated.setAttribute('data-i18n', 'missing.key');
untranslated.textContent = 'original';
const markup = [title, resizer, untranslated];

globalThis.document.querySelectorAll = (selector) => {
    const attribute = selector.match(/^\[([\w-]+)\]$/)?.[1];
    return attribute ? markup.filter(el => el.getAttribute(attribute) !== null) : [];
};

// ---- Locale files -----------------------------------------------------------------
const LOCALES = {
    it: { 'app.title': 'Ciao', 'a11y.resize': 'Ridimensiona', 'a11y.resizeHint': 'Trascina', greeting: 'Ciao {name}, hai {count} pad' },
    en: { 'app.title': 'Hello', 'a11y.resize': 'Resize', 'a11y.resizeHint': 'Drag', greeting: 'Hi {name}, {count} pads' }
};
const requested = [];
globalThis.fetch = async (url) => {
    requested.push(url);
    const lang = url.match(/locales\/(\w+)\.json/)?.[1];
    return LOCALES[lang]
        ? { ok: true, json: async () => LOCALES[lang] }
        : { ok: false, status: 404, json: async () => ({}) };
};

// Browser preferences: an unsupported language first, then Italian.
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: 'ja-JP', languages: ['ja-JP', 'it-IT', 'en-US'] }
});

const { setLogSink } = await import('../js/logger.js');
const logSink = createRecordingSink();
setLogSink(logSink);
const { initializeLanguageControls, getTranslation, translate, detectBrowserLanguage } = await import('../js/i18n.js');
const { SETTINGS_KEYS, getLanguageSetting } = await import('../js/settings.js');

const select = elements.get('language-select') || createElement('select', { id: 'language-select' });
elements.set('language-select', select);

const settle = () => new Promise(resolve => setImmediate(resolve));

test('browser language detection picks the first supported preference', () => {
    assert.equal(detectBrowserLanguage(['ja-JP', 'it-IT', 'en-US']), 'it');
    assert.equal(detectBrowserLanguage(['de-AT']), 'de', 'regional variants match their language');
    assert.equal(detectBrowserLanguage(['FR-ca']), 'fr', 'case does not matter');
    assert.equal(detectBrowserLanguage(['ja-JP', 'pt-BR']), 'en', 'English when nothing is supported');
    assert.equal(detectBrowserLanguage([]), 'en');
});

test('on first run the app uses the browser language, without saving it', async () => {
    storage.clear();
    await initializeLanguageControls();

    assert.equal(select.value, 'it');
    assert.equal(globalThis.document.documentElement.lang, 'it');
    assert.equal(title.textContent, 'Ciao');
    assert.equal(resizer.getAttribute('aria-label'), 'Ridimensiona');
    assert.equal(resizer.getAttribute('title'), 'Trascina');
    assert.equal(untranslated.textContent, 'original', 'elements without a translation keep their text');
    assert.equal(storage.has(SETTINGS_KEYS.LANGUAGE), false, 'a detected language is not a user choice');
});

test('the language the user picks is applied and remembered', async () => {
    select.value = 'en';
    select.dispatch('change');
    await settle();

    assert.equal(title.textContent, 'Hello');
    assert.equal(resizer.getAttribute('aria-label'), 'Resize');
    assert.equal(globalThis.document.documentElement.lang, 'en');
    assert.equal(storage.get(SETTINGS_KEYS.LANGUAGE), 'en');
    assert.equal(getLanguageSetting(), 'en', 'the next start uses the saved language');
});

test('a language without a locale file falls back to English', async () => {
    requested.length = 0;
    logSink.entries.length = 0;
    select.value = 'xx';
    select.dispatch('change');
    await settle();
    await settle();

    assert.deepEqual(requested, ['locales/xx.json', 'locales/en.json']);
    assert.equal(title.textContent, 'Hello');
    assert.equal(globalThis.document.documentElement.lang, 'en');
    assert.ok(logSink.entries.some(([level]) => level === 'error'), 'the failure is logged');
});

test('if English itself fails there is no retry loop', async () => {
    const original = LOCALES.en;
    delete LOCALES.en;
    try {
        requested.length = 0;
        select.value = 'en';
        select.dispatch('change');
        await settle();
        assert.deepEqual(requested, ['locales/en.json']);
    } finally {
        LOCALES.en = original;
    }
});

test('runtime lookups: missing keys fall back to the key, placeholders are filled', () => {
    assert.equal(getTranslation('nope.missing'), 'nope.missing');
    // The last loaded locale is English (the failed reload keeps it).
    assert.equal(translate('greeting', { name: 'Vittorio', count: 64 }), 'Hi Vittorio, 64 pads');
    assert.equal(translate('greeting'), 'Hi {name}, {count} pads', 'unfilled placeholders are left visible');
});
