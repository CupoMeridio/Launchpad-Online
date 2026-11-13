/**
 * DOM HELPERS (creator/dom.js)
 */

import { registerListener } from '../eventCleanup.js';

export function listen(targetOrId, eventName, listener, options = false) {
    const target = typeof targetOrId === 'string' ? document.getElementById(targetOrId) : targetOrId;
    if (target) {
        registerListener(target, eventName, listener, options);
    }
    return target;
}
