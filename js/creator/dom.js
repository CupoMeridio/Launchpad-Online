/**
 * DOM HELPERS (creator/dom.js)
 */

import { registerListener } from '../eventCleanup.js';

/**
 * @param {string|EventTarget|null} targetOrId - An element id or the target itself.
 * @returns {*} The target, or null if the id is not in the document.
 */
function resolveTarget(targetOrId) {
    return typeof targetOrId === 'string' ? document.getElementById(targetOrId) : targetOrId;
}

/**
 * Registers a tracked listener on an element (by id) or target, if present.
 * @returns {*} The target, or null.
 */
export function listen(targetOrId, eventName, listener, options = false) {
    const target = resolveTarget(targetOrId);
    if (target) {
        registerListener(target, eventName, listener, options);
    }
    return target;
}

/**
 * Assigns properties to an element (by id) if it is present, e.g.
 * `setProps('creator-remove-step', { disabled: steps.length <= 1 })`.
 * Editor markup is optional in tests and partial layouts, so a missing
 * element is simply skipped.
 * @param {string|HTMLElement|null} targetOrId
 * @param {object} props - Properties such as value, hidden, textContent, disabled, checked.
 * @returns {HTMLElement|null} The element, or null.
 */
export function setProps(targetOrId, props) {
    const target = resolveTarget(targetOrId);
    if (target) {
        Object.assign(target, props);
    }
    return target;
}
