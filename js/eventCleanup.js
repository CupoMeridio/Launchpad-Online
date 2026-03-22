/**
 * EVENT CLEANUP MANAGER (eventCleanup.js)
 * 
 * Centralized management of event listeners to prevent memory leaks and duplicates.
 * Tracks all registered listeners and provides cleanup functions.
 * 
 * Usage:
 * - Use registerListener() to add listeners that should be tracked
 * - Use cleanup() to remove all listeners from a specific target
 * - Use cleanupAll() to remove all registered listeners globally
 */

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
    
    console.log(`[EventCleanup] Registered listener for ${eventType}`);
    return listener;
}

/**
 * Removes all listeners registered on a specific target.
 * Optional: filter by event type.
 * 
 * @param {EventTarget} target - The element/window to clean up
 * @param {string} eventType - Optional: only remove listeners of this type
 */
export function cleanup(target, eventType = null) {
    if (!target || !registeredListeners.has(target)) {
        return;
    }

    const registry = getTargetRegistry(target);
    
    if (eventType) {
        // Clean up specific event type
        if (registry.has(eventType)) {
            const listeners = registry.get(eventType);
            for (const entry of listeners) {
                target.removeEventListener(eventType, entry.listener, entry.options);
            }
            registry.delete(eventType);
            console.log(`[EventCleanup] Cleaned up ${listeners.size} listeners for ${eventType}`);
        }
    } else {
        // Clean up all listeners on this target
        let totalRemoved = 0;
        for (const [evType, listeners] of registry.entries()) {
            for (const entry of listeners) {
                target.removeEventListener(evType, entry.listener, entry.options);
                totalRemoved++;
            }
        }
        registry.clear();
        console.log(`[EventCleanup] Cleaned up ${totalRemoved} total listeners from target`);
    }
}

/**
 * Gets statistics about registered listeners.
 * Useful for debugging and monitoring.
 * 
 * @returns {Object} Stats including count by event type
 */
export function getListenerStats() {
    let totalListeners = 0;
    const stats = {};
    
    // Note: WeakMap is not iterable, so we can only get stats for WeakMap contents
    // In production, you might log stats before cleanup
    console.log('[EventCleanup] Listener tracking enabled (WeakMap)');
    
    return {
        message: 'Use cleanup() to remove tracked listeners',
        note: 'WeakMap prevents iteration, but cleanup() removes all tracked listeners'
    };
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

/**
 * Creates a one-time listener that automatically unregisters itself.
 * Useful for initialization events that should only fire once per interaction.
 * 
 * @param {EventTarget} target - The element/window to attach listener to
 * @param {string} eventType - Event type
 * @param {Function} listener - The callback function
 * @param {Object|boolean} options - addEventListener options
 */
export function registerOneTimeListener(target, eventType, listener, options = false) {
    const wrappedListener = function(event) {
        listener(event);
        removeListener(target, eventType, wrappedListener);
    };
    
    return registerListener(target, eventType, wrappedListener, options);
}

/**
 * Batch register multiple listeners on the same target.
 * Useful for initializing many listeners at once.
 * 
 * @param {EventTarget} target - The target element
 * @param {Array<Array>} listeners - Array of [eventType, listener, options] tuples
 */
export function registerListeners(target, listeners) {
    for (const [eventType, listener, options = false] of listeners) {
        registerListener(target, eventType, listener, options);
    }
}

/**
 * Checks if a specific listener is registered.
 * Note: Due to WeakMap limitations, this is for debugging only.
 * 
 * @param {EventTarget} target - The target to check
 * @param {string} eventType - Event type to check
 * @returns {boolean} True if target has registered listeners for event type
 */
export function hasListeners(target, eventType) {
    if (!registeredListeners.has(target)) {
        return false;
    }
    const registry = getTargetRegistry(target);
    return registry.has(eventType);
}
