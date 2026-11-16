/**
 * Lifecycle of on-screen notifications (js/notifications.js).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs } from './helpers/browserStubs.js';

const { elements } = installBrowserStubs();
const { showNotification } = await import('../js/notifications.js');
const container = () => elements.get('notification-container');

test.beforeEach(() => {
    container()?.replaceChildren();
});

test('a notification fades in, then is removed when its fade-out ends', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    showNotification('Saved', 'success', 3000);
    const toast = container().children[0];
    assert.equal(toast.textContent, 'Saved');
    assert.equal(toast.classList.contains('success'), true);

    t.mock.timers.tick(10);
    assert.equal(toast.classList.contains('show'), true);

    t.mock.timers.tick(2990);
    assert.equal(toast.classList.contains('show'), false, 'fade-out starts after the duration');
    toast.dispatch('transitionend');
    assert.equal(container().children.length, 0);
});

test('a notification is removed even if transitionend never fires', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    showNotification('Background tab', 'warning', 1000);
    t.mock.timers.tick(1000);
    assert.equal(container().children.length, 1, 'still fading out');
    t.mock.timers.tick(600);
    assert.equal(container().children.length, 0, 'removed by the fallback timer');
});

test('unknown types fall back to the info style', () => {
    showNotification('Typo', 'warn');
    const toast = container().children[0];
    assert.equal(toast.classList.contains('info'), true);
    assert.equal(toast.classList.contains('warn'), false);
});
