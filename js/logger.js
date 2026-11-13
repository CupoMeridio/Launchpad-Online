/**
 * LOGGER (logger.js)
 *
 * Single entry point for diagnostics:
 * - `debug()` is silenced unless debug mode is enabled at load time, via the
 *   `?debug` URL parameter or the `launchpad.debug` localStorage key;
 * - `logger.warn()` / `logger.error()` are always emitted.
 *
 * Routing everything through here keeps one place to add prefixes, filtering
 * or remote reporting, and lets tests capture or silence the output.
 */

import { isDebugSettingEnabled } from './settings.js';

let debugEnabled = false;

if (typeof window !== 'undefined') {
    debugEnabled = isDebugSettingEnabled();
}

/** @type {Pick<Console, 'log'|'warn'|'error'>} */
let sink = console;

/**
 * Emits a debug log only when debug mode is enabled.
 * @param {...*} args - Values forwarded to the sink's `log`
 */
export function debug(...args) {
    if (debugEnabled) {
        sink.log(...args);
    }
}

export const logger = Object.freeze({
    debug,
    /** @param {...*} args */
    warn(...args) {
        sink.warn(...args);
    },
    /** @param {...*} args */
    error(...args) {
        sink.error(...args);
    }
});

/**
 * Redirects all output (e.g. to capture or silence it in tests).
 * Pass null to restore the console.
 * @param {Pick<Console, 'log'|'warn'|'error'>|null} newSink
 */
export function setLogSink(newSink) {
    sink = newSink || console;
}
