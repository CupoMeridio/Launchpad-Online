import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SETTINGS_KEYS,
    DEFAULT_UI_ACCENT,
    getStorageItem,
    getLanguageSetting,
    setLanguageSetting,
    getAccentColorSetting,
    setAccentColorSetting,
    getRotationSetting,
    setRotationSetting,
    getScaleSetting,
    setScaleSetting,
    getModelPreferenceSetting,
    setModelPreferenceSetting,
    getPanelWidthSetting,
    setPanelWidthSetting,
    isDebugSettingEnabled
} from '../js/settings.js';

function createMockLocalStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
}

test('settings: storage access with mock storage', async (t) => {
    const originalStorage = globalThis.localStorage;
    const mock = createMockLocalStorage();
    globalThis.localStorage = mock;

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getStorageItem('test.key', 'defaultVal'), 'defaultVal');
    mock.setItem('test.key', 'savedVal');
    assert.equal(getStorageItem('test.key', 'defaultVal'), 'savedVal');
    mock.removeItem('test.key');
    assert.equal(getStorageItem('test.key', 'defaultVal'), 'defaultVal');
});

test('settings: gracefully handles throwing localStorage (private mode / quota)', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
        getItem() { throw new Error('SecurityError: Access denied'); },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() { throw new Error('SecurityError'); }
    };

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getStorageItem('any.key', 'fallback'), 'fallback');
    assert.equal(setLanguageSetting('en'), false);
    assert.equal(setRotationSetting(null), false);
});

test('settings: language getters and setters', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = createMockLocalStorage();

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getLanguageSetting(), 'it');
    assert.equal(setLanguageSetting('en'), true);
    assert.equal(getLanguageSetting(), 'en');
    // Rejects invalid strings
    assert.equal(setLanguageSetting(''), false);
    assert.equal(setLanguageSetting(123), false);
    assert.equal(getLanguageSetting(), 'en');
});

test('settings: accent color getters, setters, and validation', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = createMockLocalStorage();

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getAccentColorSetting(), DEFAULT_UI_ACCENT);
    assert.equal(setAccentColorSetting('#ff0055'), true);
    assert.equal(getAccentColorSetting(), '#ff0055');

    // Rejects non-hex or invalid hex
    assert.equal(setAccentColorSetting('red'), false);
    assert.equal(setAccentColorSetting('#123'), false);
    assert.equal(getAccentColorSetting(), '#ff0055');

    // Reset accent color
    assert.equal(setAccentColorSetting(null), true);
    assert.equal(getAccentColorSetting(), DEFAULT_UI_ACCENT);
});

test('settings: rotation bounds clamping and resetting', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = createMockLocalStorage();

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getRotationSetting(), 0);
    assert.equal(setRotationSetting(90), true);
    assert.equal(getRotationSetting(), 90);

    // Clamps to [0, 360]
    setRotationSetting(450);
    assert.equal(getRotationSetting(), 360);
    setRotationSetting(-45);
    assert.equal(getRotationSetting(), 0);

    // Null removes stored setting and reverts to default
    setRotationSetting(null);
    assert.equal(getRotationSetting(), 0);
});

test('settings: scale bounds clamping and resetting', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = createMockLocalStorage();

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getScaleSetting(), 1);
    assert.equal(setScaleSetting(1.2), true);
    assert.equal(getScaleSetting(), 1.2);

    // Clamps to [0.5, 1.4] (LAUNCHPAD_SIZE_MIN/100 to LAUNCHPAD_SIZE_MAX/100)
    setScaleSetting(2.5);
    assert.equal(getScaleSetting(), 1.4);
    setScaleSetting(0.2);
    assert.equal(getScaleSetting(), 0.5);

    // Null removes stored setting
    setScaleSetting(null);
    assert.equal(getScaleSetting(), 1);
});

test('settings: model preference validation against allowed list', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = createMockLocalStorage();

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getModelPreferenceSetting(), 'auto');
    setModelPreferenceSetting('mk3');
    assert.equal(getModelPreferenceSetting(), 'mk3');

    // Arbitrary model not in allowed list falls back to auto
    setModelPreferenceSetting('non-existent-model');
    assert.equal(getModelPreferenceSetting(), 'auto');
});

test('settings: panel width clamp and bounds checking', async (t) => {
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = createMockLocalStorage();

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(getPanelWidthSetting(SETTINGS_KEYS.SIDEBAR_WIDTH, 260, 200, 520), 260);
    setPanelWidthSetting(SETTINGS_KEYS.SIDEBAR_WIDTH, 350);
    assert.equal(getPanelWidthSetting(SETTINGS_KEYS.SIDEBAR_WIDTH, 260, 200, 520), 350);

    // Outside bounds returns default
    setPanelWidthSetting(SETTINGS_KEYS.SIDEBAR_WIDTH, 100); // Below min
    assert.equal(getPanelWidthSetting(SETTINGS_KEYS.SIDEBAR_WIDTH, 260, 200, 520), 260);
});

test('settings: debug flag getter and query parameter parsing', async (t) => {
    const originalStorage = globalThis.localStorage;
    const mock = createMockLocalStorage();
    globalThis.localStorage = mock;

    t.after(() => {
        globalThis.localStorage = originalStorage;
    });

    assert.equal(isDebugSettingEnabled(), false);
    mock.setItem(SETTINGS_KEYS.DEBUG, '1');
    assert.equal(isDebugSettingEnabled(), true);
    mock.setItem(SETTINGS_KEYS.DEBUG, '0');
    assert.equal(isDebugSettingEnabled(), false);
});
