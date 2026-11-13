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

const { setLogSink } = await import('../js/logger.js');
const logSink = createRecordingSink();
setLogSink(logSink);
const { initializeLanguageControls, getTranslation, translate } = await import('../js/i18n.js');
const { SETTINGS_KEYS } = await import('../js/settings.js');

const select = elements.get('language-select') || createElement('select', { id: 'language-select' });
elements.set('language-select', select);

const settle = () => new Promise(resolve => setImmediate(resolve));

test('the saved language is loaded and applied to text and attributes', async () => {
    storage.set(SETTINGS_KEYS.LANGUAGE, 'en');
    await initializeLanguageControls();

    assert.equal(select.value, 'en');
    assert.equal(title.textContent, 'Hello');
    assert.equal(resizer.getAttribute('aria-label'), 'Resize');
    assert.equal(resizer.getAttribute('title'), 'Drag');
    assert.equal(untranslated.textContent, 'original', 'elements without a translation keep their text');
});

test('choosing another language saves it and re-translates the page', async () => {
    select.value = 'it';
    select.dispatch('change');
    await settle();

    assert.equal(storage.get(SETTINGS_KEYS.LANGUAGE), 'it');
    assert.equal(title.textContent, 'Ciao');
    assert.equal(resizer.getAttribute('aria-label'), 'Ridimensiona');
});

test('a language without a locale file falls back to Italian', async () => {
    requested.length = 0;
    logSink.entries.length = 0;
    select.value = 'xx';
    select.dispatch('change');
    await settle();
    await settle();

    assert.deepEqual(requested, ['locales/xx.json', 'locales/it.json']);
    assert.equal(title.textContent, 'Ciao');
    assert.ok(logSink.entries.some(([level]) => level === 'error'), 'the failure is logged');
});

test('if Italian itself fails there is no retry loop', async () => {
    const original = LOCALES.it;
    delete LOCALES.it;
    try {
        requested.length = 0;
        select.value = 'it';
        select.dispatch('change');
        await settle();
        assert.deepEqual(requested, ['locales/it.json']);
    } finally {
        LOCALES.it = original;
    }
});

test('runtime lookups: missing keys fall back to the key, placeholders are filled', () => {
    assert.equal(getTranslation('nope.missing'), 'nope.missing');
    assert.equal(translate('greeting', { name: 'Vittorio', count: 64 }), 'Ciao Vittorio, hai 64 pad');
    assert.equal(translate('greeting'), 'Ciao {name}, hai {count} pad', 'unfilled placeholders are left visible');
});
