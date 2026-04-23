/**
 * PROJECT LOADING STATE MANAGER (projectLoadingState.js)
 * 
 * Manages the lifecycle of project loading to prevent race conditions.
 * Ensures that operations dependent on project state (audio, lights, MIDI sync)
 * don't proceed until all project assets are ready.
 * 
 * States:
 * - IDLE: No project loading
 * - LOADING: Project assets being fetched/processed
 * - READY: Project fully loaded and safe to access
 * - ERROR: Project loading failed
 */

import { PROJECT_LOADING_TIMEOUT_MS } from './constants.js';

const LOADING_STATES = {
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    ERROR: 'ERROR'
};

let currentLoadingState = LOADING_STATES.IDLE;
let loadingPromise = Promise.resolve(); // Track current load operation
let resolveLoadingPromise = null;
let lastError = null;
let loadingTimeoutId = null; // Safety timeout to prevent infinite loading state

/**
 * Returns true if a project is currently loading
 */
export function isProjectLoading() {
    return currentLoadingState === LOADING_STATES.LOADING;
}

/**
 * Returns true if a project is fully loaded and ready
 */
export function isProjectReady() {
    return currentLoadingState === LOADING_STATES.READY;
}

/**
 * Marks project as loading. Returns a promise that resolves when loading complete.
 * This is called at the start of loadProject().
 * 
 * SAFETY: A timeout is automatically started. If the loading operation does not
 * call markProjectReady() or markProjectLoadError() within PROJECT_LOADING_TIMEOUT_MS,
 * the system will automatically transition to ERROR state to prevent deadlocks.
 * 
 * @returns {Promise} Waits for current load to complete before allowing next load
 */
export async function beginLoadingProject() {
    console.log("[ProjectLoading] Project loading started");
    
    // Wait for any previous loading to complete to prevent concurrent loads
    await loadingPromise;
    
    // Clear any existing timeout from previous load
    if (loadingTimeoutId !== null) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
    }
    
    currentLoadingState = LOADING_STATES.LOADING;
    lastError = null;
    
    // Create a new promise for the current loading operation
    loadingPromise = new Promise(resolve => {
        resolveLoadingPromise = resolve;
    });
    
    // SAFETY TIMEOUT: Force ERROR state if loading doesn't complete
    // This prevents the app from getting stuck if project.js crashes mid-load
    loadingTimeoutId = setTimeout(() => {
        if (currentLoadingState === LOADING_STATES.LOADING) {
            console.error("[ProjectLoading] TIMEOUT: Loading did not complete in 60 seconds");
            // Force error state to unblock the queue
            markProjectLoadError(new Error("Project loading timeout - operation took too long"));
        }
        loadingTimeoutId = null;
    }, PROJECT_LOADING_TIMEOUT_MS);
    
    return Promise.resolve();
}

/**
 * Marks project as successfully loaded and ready for use
 * Automatically cancels the safety timeout since load completed normally
 */
export function markProjectReady() {
    // Cancel the safety timeout since loading completed successfully
    if (loadingTimeoutId !== null) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
    }
    
    currentLoadingState = LOADING_STATES.READY;
    lastError = null;
    console.log("[ProjectLoading] Project ready");
    
    if (resolveLoadingPromise) {
        resolveLoadingPromise();
        resolveLoadingPromise = null;
    }
    
    // Dispatch event for other modules to know when project is ready
    window.dispatchEvent(new CustomEvent('project:ready', {
        detail: { timestamp: Date.now() }
    }));
}

/**
 * Marks project loading as failed
 * Automatically cancels the safety timeout since load completed (with error)
 * 
 * @param {Error} error - The error that occurred
 */
export function markProjectLoadError(error) {
    // Cancel the safety timeout since loading completed (even if with error)
    if (loadingTimeoutId !== null) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
    }
    
    currentLoadingState = LOADING_STATES.ERROR;
    lastError = error;
    console.error("[ProjectLoading] Project loading failed:", error);
    
    if (resolveLoadingPromise) {
        resolveLoadingPromise();
        resolveLoadingPromise = null;
    }
    
    // Dispatch event for error handling
    window.dispatchEvent(new CustomEvent('project:error', {
        detail: { error: error.message, timestamp: Date.now() }
    }));
}

/**
 * Wraps a loading operation to ensure proper state management
 * 
 * @param {Promise} operation - The async operation to execute
 * @returns {Promise} Resolves when operation completes
 */
export async function wrapProjectLoading(operation) {
    try {
        await beginLoadingProject();
        const result = await operation;
        markProjectReady();
        return result;
    } catch (error) {
        markProjectLoadError(error);
        throw error;
    }
}

/**
 * Waits until the project is ready before proceeding
 * Useful for operations that depend on project data.
 * 
 * Example:
 *   const ready = await waitForProjectReady(timeout);
 *   if (ready) { proceed with using project data }
 * 
 * @param {number} timeout - Maximum time to wait in ms (default: 30s)
 * @returns {Promise<boolean>} True if ready before timeout, false if timeout
 */
export async function waitForProjectReady(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (isProjectReady()) {
            return true;
        }
        if (currentLoadingState === LOADING_STATES.ERROR) {
            console.warn("[ProjectLoading] Project loading error, giving up");
            return false;
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn(`[ProjectLoading] Timeout waiting for project after ${timeout}ms`);
    return false;
}
