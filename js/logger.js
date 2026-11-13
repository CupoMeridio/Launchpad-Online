/**
 * LOGGER (logger.js)
 *
 * Lightweight logger with a global debug flag.
 * `debug()` is silenced unless debug mode is enabled at load time, via the
 * `?debug` URL parameter or the `launchpad.debug` localStorage key.
 * Warnings and errors keep using console.warn / console.error directly.
 */

import { isDebugSettingEnabled } from './settings.js';

let debugEnabled = false;

if (typeof window !== 'undefined') {
    debugEnabled = isDebugSettingEnabled();
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
