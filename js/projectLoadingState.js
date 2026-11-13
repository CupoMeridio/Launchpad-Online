/**
 * PROJECT LOADING STATE (projectLoadingState.js)
 *
 * Tracks whether the active project can be played with its lights:
 *
 *   IDLE ──begin──> LOADING ──ready──> READY
 *                      │
 *                      └──error──> ERROR (or READY again when the previously
 *                                  loaded project is still the active one)
 *
 * Serializing loads and timing them out is the job of the loader (project.js);
 * this module only records the outcome and lets callers wait for it.
 */

import { debug, logger } from './logger.js';

const LOADING_STATES = Object.freeze({
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    ERROR: 'ERROR'
});

let currentLoadingState = LOADING_STATES.IDLE;

/** Pending waitForProjectReady() calls, settled on the next outcome. */
const waiters = new Set();

function settleWaiters(isReady) {
    waiters.forEach(settle => settle(isReady));
    waiters.clear();
}

/**
 * @returns {boolean} True if a project is fully loaded and ready.
 */
export function isProjectReady() {
    return currentLoadingState === LOADING_STATES.READY;
}

/**
 * Marks the start of a project load.
 */
export function beginLoadingProject() {
    debug('[ProjectLoading] Project loading started');
    currentLoadingState = LOADING_STATES.LOADING;
}

/**
 * Marks the project as successfully loaded and ready for use.
 */
export function markProjectReady() {
    currentLoadingState = LOADING_STATES.READY;
    debug('[ProjectLoading] Project ready');
    settleWaiters(true);
}

/**
 * Marks project loading as failed.
 *
 * When the previously loaded project is still the active one (loads commit
 * atomically, so a failure never replaces it), pass `previousProjectActive`
 * to return to READY instead of leaving the app blocked in ERROR.
 *
 * @param {Error} error - The error that occurred
 * @param {object} [options]
 * @param {boolean} [options.previousProjectActive=false] - A previous project is still loaded and usable.
 */
export function markProjectLoadError(error, { previousProjectActive = false } = {}) {
    currentLoadingState = previousProjectActive ? LOADING_STATES.READY : LOADING_STATES.ERROR;
    logger.error('[ProjectLoading] Project loading failed:', error);
    settleWaiters(previousProjectActive);
}

/**
 * Resolves once a project is ready, or with false if loading fails or
 * `timeout` elapses first. Resolves immediately when already decided.
 * @param {number} [timeout=30000] - Maximum wait in ms.
 * @returns {Promise<boolean>} True if a project is ready.
 */
export function waitForProjectReady(timeout = 30000) {
    if (currentLoadingState === LOADING_STATES.READY) return Promise.resolve(true);
    if (currentLoadingState === LOADING_STATES.ERROR) return Promise.resolve(false);

    return new Promise(resolve => {
        const settle = (isReady) => {
            clearTimeout(timer);
            waiters.delete(settle);
            resolve(isReady);
        };
        const timer = setTimeout(() => {
            logger.warn(`[ProjectLoading] Timeout waiting for project after ${timeout}ms`);
            settle(false);
        }, timeout);
        waiters.add(settle);
    });
}
