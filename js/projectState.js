/**
 * PROJECT STATE (projectState.js)
 *
 * Single owner of the performance runtime state:
 * - the active project, held as ONE normalized object (see `normalizeProjectData`)
 *   and replaced atomically by `commitProject`, so readers can never observe
 *   sounds from one project and lights from another;
 * - the current sound page;
 * - the current Launchpad mode.
 *
 * Leaf module (no imports): engine and UI modules read it without depending on
 * the application entry point.
 */

/** @typedef {import('./projectModel.js').RuntimeProject} RuntimeProject */

/** @type {RuntimeProject|null} */
let activeProject = null;

/** @type {number|null} Null until the first page selection, so the first change is logged. */
let currentPage = null;

/** @type {number|null} Null until the first mode selection, so the first change is logged. */
let currentMode = null;

/**
 * @returns {RuntimeProject|null} The active project, or null before the first successful load.
 */
export function getActiveProject() {
    return activeProject;
}

/**
 * Makes a fully loaded project the active one. Must be called only once all of
 * its assets are ready, so a failed load leaves the previous project intact.
 * @param {RuntimeProject} runtimeProject
 */
export function commitProject(runtimeProject) {
    activeProject = runtimeProject;
}

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
 * Clears all state. Intended for tests.
 */
export function resetProjectState() {
    activeProject = null;
    currentPage = null;
    currentMode = null;
}
