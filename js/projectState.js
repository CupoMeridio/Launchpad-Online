/**
 * PROJECT STATE (projectState.js)
 *
 * Single owner of the performance runtime state:
 * - the active project, held as ONE normalized object (see `normalizeProjectData`)
 *   and replaced atomically by `commitProject`, so readers can never observe
 *   sounds from one project and lights from another;
 * - whether it can be played right now (loading status);
 * - the current sound page and Launchpad mode.
 *
 * Loading status:
 *
 *   IDLE ──begin──> LOADING ──commit──> READY
 *                      │
 *                      └──error──> READY  if a previous project is still active
 *                                  ERROR  otherwise
 *
 * Serializing loads and timing them out is the job of the loader (project.js);
 * this module records the outcome and lets callers wait for it.
 */

import { debug, logger } from './logger.js';

/** @typedef {import('./projectModel.js').RuntimeProject} RuntimeProject */

const LOADING_STATES = Object.freeze({
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    ERROR: 'ERROR'
});

/** @type {RuntimeProject|null} */
let activeProject = null;

let loadingState = LOADING_STATES.IDLE;

/** @type {number|null} Null until the first page selection, so the first change is logged. */
let currentPage = null;

/** @type {number|null} Null until the first mode selection, so the first change is logged. */
let currentMode = null;

/** Pending waitForProjectReady() calls, settled on the next outcome. */
const waiters = new Set();

function settleWaiters(isReady) {
    waiters.forEach(settle => settle(isReady));
    waiters.clear();
}

// ----------------------------------------------------------------------------
// Active project
// ----------------------------------------------------------------------------

/**
 * @returns {RuntimeProject|null} The active project, or null before the first successful load.
 */
export function getActiveProject() {
    return activeProject;
}

/**
 * Makes a fully loaded project the active one and marks it ready to play.
 * Must be called only once all of its assets are ready, so a failed load
 * leaves the previous project intact.
 * @param {RuntimeProject} runtimeProject
 */
export function commitProject(runtimeProject) {
    activeProject = runtimeProject;
    loadingState = LOADING_STATES.READY;
    debug('[ProjectState] Project ready');
    settleWaiters(true);
}

// ----------------------------------------------------------------------------
// Loading status
// ----------------------------------------------------------------------------

/**
 * @returns {boolean} True if the active project can be played with its lights.
 */
export function isProjectReady() {
    return loadingState === LOADING_STATES.READY;
}

/**
 * Marks the start of a project load.
 */
export function beginLoadingProject() {
    debug('[ProjectState] Project loading started');
    loadingState = LOADING_STATES.LOADING;
}

/**
 * Marks a project load as failed. Loads commit atomically, so a failure never
 * replaces the active project: if there is one, it is playable again (READY);
 * otherwise the app has no project (ERROR).
 * @param {Error} error
 */
export function markProjectLoadError(error) {
    const isReady = activeProject !== null;
    loadingState = isReady ? LOADING_STATES.READY : LOADING_STATES.ERROR;
    logger.error('[ProjectState] Project loading failed:', error);
    settleWaiters(isReady);
}

/**
 * Resolves once a project is ready, or with false if loading fails or
 * `timeout` elapses first. Resolves immediately when already decided.
 * @param {number} [timeout=30000] - Maximum wait in ms.
 * @returns {Promise<boolean>} True if a project is ready.
 */
export function waitForProjectReady(timeout = 30000) {
    if (loadingState === LOADING_STATES.READY) return Promise.resolve(true);
    if (loadingState === LOADING_STATES.ERROR) return Promise.resolve(false);

    return new Promise(resolve => {
        const settle = (isReady) => {
            clearTimeout(timer);
            waiters.delete(settle);
            resolve(isReady);
        };
        const timer = setTimeout(() => {
            logger.warn(`[ProjectState] Timeout waiting for project after ${timeout}ms`);
            settle(false);
        }, timeout);
        waiters.add(settle);
    });
}

// ----------------------------------------------------------------------------
// Page and mode
// ----------------------------------------------------------------------------

/** @returns {number|null} */
export function getCurrentPage() {
    return currentPage;
}

/** @param {number} pageIndex */
export function setCurrentPage(pageIndex) {
    currentPage = pageIndex;
}

/** @returns {number|null} */
export function getCurrentMode() {
    return currentMode;
}

/** @param {number} modeIndex */
export function setCurrentMode(modeIndex) {
    currentMode = modeIndex;
}

/**
 * Clears all state and cancels pending waits. Intended for tests.
 */
export function resetProjectState() {
    activeProject = null;
    loadingState = LOADING_STATES.IDLE;
    currentPage = null;
    currentMode = null;
    settleWaiters(false);
}
