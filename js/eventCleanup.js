/**
 * EVENT CLEANUP MANAGER (eventCleanup.js)
 * 
 * Centralized management of event listeners to prevent memory leaks and duplicates.
 * Tracks all registered listeners and provides listener management functions.
 * 
 * Usage:
 * - Use registerListener() to add listeners that should be tracked
 * - Use removeListener() to remove a specific tracked listener
 */

import { debug } from './logger.js';

/**
 * Stores registered listener info for tracking and cleanup.
 * Structure: Map<target, Map<eventType, Set<{listener, options}>>>
 */
const registeredListeners = new WeakMap();

/**
 * Helper to get listener registry for a target, creating if needed
 */
function getTargetRegistry(target) {
    if (!registeredListeners.has(target)) {
        registeredListeners.set(target, new Map());
    }
    return registeredListeners.get(target);
}

/**
 * Registers and adds an event listener to the tracking system.
 * Prevents duplicate listeners on the same target/event combination.
 * 
 * @param {EventTarget} target - The element/window to attach listener to
 * @param {string} eventType - Event type (e.g., 'click', 'visibilitychange')
 * @param {Function} listener - The callback function
 * @param {Object|boolean} options - addEventListener options
 * @returns {Function} Bound listener function (for manual removal if needed)
 */
export function registerListener(target, eventType, listener, options = false) {
    if (!target) return listener;

    const registry = getTargetRegistry(target);
    
    if (!registry.has(eventType)) {
        registry.set(eventType, new Set());
    }
    
    const eventListeners = registry.get(eventType);
    
    // Check for duplicates before adding
    for (const entry of eventListeners) {
        if (entry.listener === listener && 
            JSON.stringify(entry.options) === JSON.stringify(options)) {
            console.warn(`[EventCleanup] Duplicate listener prevented for ${eventType}`);
            return listener;
        }
    }
    
    // Add the listener
    target.addEventListener(eventType, listener, options);
    eventListeners.add({ listener, options });
    
    debug(`[EventCleanup] Registered listener for ${eventType}`);
    return listener;
}

/**
 * Removes a specific listener registered on a target.
 * 
 * @param {EventTarget} target - The element/window
 * @param {string} eventType - Event type
 * @param {Function} listenerToRemove - The specific listener function to remove
 */
export function removeListener(target, eventType, listenerToRemove) {
    if (!target || !registeredListeners.has(target)) {
        return;
    }

    const registry = getTargetRegistry(target);
    if (registry.has(eventType)) {
        const listeners = registry.get(eventType);
        for (const entry of listeners) {
            if (entry.listener === listenerToRemove) {
                target.removeEventListener(eventType, entry.listener, entry.options);
                listeners.delete(entry);
                break;
            }
        }
        
        // Clean up empty sets
        if (listeners.size === 0) {
            registry.delete(eventType);
        }
    }
}
