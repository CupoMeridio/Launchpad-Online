/**
 * Behaviour of the Launchpad skin (launchpadAppearance.setLaunchpadBackground):
 * how references resolve to URLs, when blob URLs are revoked, and what the
 * Launchpad shows after loading or failing.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs, createRecordingSink } from './helpers/browserStubs.js';

const { elements } = installBrowserStubs();
const launchpad = elements.get('Launchpad');

// Images "load" unless their URL contains "broken".
globalThis.Image = class {
    set src(value) {
        this._src = value;
        queueMicrotask(() => (value.includes('broken') ? this.onerror?.() : this.onload?.()));
    }
    get src() { return this._src; }
};

const revoked = [];
let blobCounter = 0;
globalThis.URL.createObjectURL = () => `blob:skin-${++blobCounter}`;
globalThis.URL.revokeObjectURL = (url) => revoked.push(url);

const { setLogSink } = await import('../js/logger.js');
const logSink = createRecordingSink();
setLogSink(logSink);
const { setLaunchpadBackground } = await import('../js/launchpadAppearance.js');

const backgroundUrl = () => launchpad.style.backgroundImage?.match(/^url\('([^?']+)/)?.[1] ?? launchpad.style.backgroundImage;

test('a catalog skin name resolves to the bundled covers folder', async () => {
    await setLaunchpadBackground('black_bg_blue_squares_tl.png');
    assert.equal(backgroundUrl(), 'assets/images/launchpad covers/black_bg_blue_squares_tl.png');
});

test('paths are used as they are, with a cache-busting query', async () => {
    await setLaunchpadBackground('projects/demo/cover.png');
    assert.equal(backgroundUrl(), 'projects/demo/cover.png');
    assert.match(launchpad.style.backgroundImage, /\?t=\d+/);
});

test('uploaded files use a blob URL that is revoked when replaced or removed', async () => {
    revoked.length = 0;
    await setLaunchpadBackground({ name: 'mine.png' });
    const firstBlob = backgroundUrl();
    assert.match(firstBlob, /^blob:/);
    assert.doesNotMatch(launchpad.style.backgroundImage, /\?t=/, 'blob URLs are not cache-busted');

    await setLaunchpadBackground({ name: 'other.png' });
    assert.deepEqual(revoked, [firstBlob], 'the replaced blob is released');

    const secondBlob = backgroundUrl();
    await setLaunchpadBackground(null);
    assert.equal(launchpad.style.backgroundImage, 'none');
    assert.deepEqual(revoked, [firstBlob, secondBlob], 'removing the skin releases its blob');
});

test('a skin that fails to load clears the Launchpad and is reported', async () => {
    logSink.entries.length = 0;
    await setLaunchpadBackground('projects/demo/broken.png');
    assert.equal(launchpad.style.backgroundImage, 'none');
    assert.ok(logSink.entries.some(([level, message]) => level === 'error' && /Error loading skin/.test(message)));
});
