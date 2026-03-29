/**
 * VISIBILITY MANAGER (visibilityManager.js)
 *
 * Centralized management of page visibility state.
 * Provides a single source of truth for visibility changes
 * and allows multiple subsystems to subscribe to visibility events.
 */

let isVisible = document.visibilityState === 'visible';
let listeners = new Map();
let visibilityListenerAdded = false;

const unsubscribeFunctions = new Map();

function handleVisibilityChange() {
    isVisible = document.visibilityState === 'visible';

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
    console.log('[VisibilityManager] Initialized');
}

export function onVisibilityChange(callback) {
    if (typeof callback !== 'function') return;

    const subscriber = Symbol('subscriber');
    listeners.set(subscriber, callback);

    const unsubscribe = () => {
        listeners.delete(subscriber);
    };

    unsubscribeFunctions.set(subscriber, unsubscribe);
    return unsubscribe;
}

export function getVisibilityState() {
    return isVisible;
}

export function unsubscribeAll() {
    listeners.clear();
    unsubscribeFunctions.clear();
}