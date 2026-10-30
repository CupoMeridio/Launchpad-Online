/**
 * VISIBILITY MANAGER (visibilityManager.js)
 *
 * Centralized management of page visibility state.
 * Provides a single source of truth for visibility changes
 * and allows multiple subsystems to subscribe to visibility events.
 */

import { debug } from './logger.js';

let listeners = new Map();
let visibilityListenerAdded = false;

function handleVisibilityChange() {
    const isVisible = document.visibilityState === 'visible';

    for (const [subscriber, callback] of listeners) {
        try {
            callback(isVisible);
        } catch (e) {
            console.error('[VisibilityManager] Listener error:', e);
        }
    }
}

export function initVisibilityManager() {
    if (visibilityListenerAdded) return;
    visibilityListenerAdded = true;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    debug('[VisibilityManager] Initialized');
}

export function onVisibilityChange(callback) {
    if (typeof callback !== 'function') return;

    const subscriber = Symbol('subscriber');
    listeners.set(subscriber, callback);

    const unsubscribe = () => {
        listeners.delete(subscriber);
    };

    return unsubscribe;
}
