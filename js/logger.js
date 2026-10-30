/**
 * LOGGER (logger.js)
 *
 * Lightweight logger with a global debug flag.
 * `debug()` is silenced unless debug mode is enabled at load time, via the
 * `?debug` URL parameter or the `launchpad.debug` localStorage key.
 * Warnings and errors keep using console.warn / console.error directly.
 */

let debugEnabled = false;

if (typeof window !== 'undefined') {
    try {
        debugEnabled =
            new URLSearchParams(window.location.search).has('debug') ||
            window.localStorage.getItem('launchpad.debug') === '1';
    } catch {
        debugEnabled = false;
    }
}

/**
 * Emits a debug log only when debug mode is enabled.
 * @param {...*} args - Values forwarded to console.log
 */
export function debug(...args) {
    if (debugEnabled) {
        console.log(...args);
    }
}
