/**
 * PROJECT DATA MODEL (projectModel.js)
 * 
 * Pure functions for project path resolution and data normalization.
 * Agnostic to DOM, Web Audio, and network.
 */

import { normalizeAppearance } from './appearanceModel.js';
import { LAUNCHPAD_PADS, DEFAULT_LIGHT_DURATION_SEC, isAppAssetPath } from './constants.js';

/**
 * Builds a resolver that turns a project-relative asset path into a usable URL.
 * Absolute URLs, root paths and `assets/` refs are returned unchanged.
 * @param {string} configPath - Path of the project configuration JSON.
 * @returns {(path: string) => string}
 */
export function createPathResolver(configPath) {
    const baseUrl = configPath ? configPath.substring(0, configPath.lastIndexOf('/') + 1) : '';
    return (path) => {
        if (!path) return path;
        if (path.startsWith('http') || path.startsWith('/') || isAppAssetPath(path)) return path;
        return baseUrl ? baseUrl + path : path;
    };
}

/**
 * One playable step of a pad: the single runtime shape shared by the
 * performance player and the Studio Creator.
 * @typedef {object} PadStep
 * @property {string|null} soundUrl - Resolved sample URL (null for draft/empty steps).
 * @property {AudioBuffer|null} buffer - Decoded sample, filled in once loaded.
 * @property {string|null} light - Animation name, or null for no light.
 * @property {boolean} syncToSound - Light lasts as long as the sound.
 * @property {number} duration - Manual light duration in seconds (when not synced).
 */

/**
 * @typedef {object} RuntimeProject
 * @property {object} project - The validated project JSON (with `configPath`).
 * @property {PadStep[][][]} pages - `pages[pageIndex][padIndex]` is the pad's step list.
 * @property {object} appearance - Normalized appearance (see appearanceModel.js).
 */

/**
 * Creates a PadStep, filling defaults for missing fields.
 * @param {Partial<PadStep>} [fields]
 * @returns {PadStep}
 */
export function createPadStep({ soundUrl = null, buffer = null, light = null, syncToSound = true, duration = DEFAULT_LIGHT_DURATION_SEC } = {}) {
    return {
        soundUrl: soundUrl || null,
        buffer: buffer || null,
        light: light || null,
        syncToSound: typeof syncToSound === 'boolean' ? syncToSound : true,
        duration: typeof duration === 'number' ? duration : DEFAULT_LIGHT_DURATION_SEC
    };
}

/**
 * Reads entry `padIndex` of a per-pad project field as a step array
 * (a bare value is treated as a single step).
 */
function stepValues(field, padIndex) {
    const entry = Array.isArray(field) ? field[padIndex] : undefined;
    if (Array.isArray(entry)) return entry;
    return entry === undefined || entry === null ? [] : [entry];
}

// ----------------------------------------------------------------------------
// PROJECT FILE FORMAT <-> PAD STEPS
// On disk a page stores four parallel per-pad arrays (`sounds`, `lights`,
// `lightSyncToSound`, `lightDurations`), each entry being the pad's step list.
// In memory every consumer (player, Studio, import/export) works with PadStep
// lists. These two functions are the only translation between the two shapes.
// ----------------------------------------------------------------------------

/**
 * Builds the step list of one pad from the parallel per-pad fields of a page.
 * The step count is the longest of the sound and light lists.
 */
function buildPadSteps(page, padIndex, resolvePath) {
    const sounds = stepValues(page.sounds, padIndex);
    const lights = stepValues(page.lights, padIndex);
    const sync = stepValues(page.lightSyncToSound, padIndex);
    const durations = stepValues(page.lightDurations, padIndex);
    const stepCount = Math.max(sounds.length, lights.length);

    return Array.from({ length: stepCount }, (_, stepIndex) => createPadStep({
        soundUrl: sounds[stepIndex] ? resolvePath(sounds[stepIndex]) : null,
        light: lights[stepIndex] || null,
        syncToSound: sync[stepIndex] ?? true,
        duration: durations[stepIndex]
    }));
}

/**
 * Reads the 64 pads of a project page as PadStep lists.
 * @param {object} page - Page of the project file.
 * @param {(path: string) => string} [resolvePath] - Maps each sample path to a URL (identity by default).
 * @returns {PadStep[][]} One step list per pad; pads without content have no steps.
 */
export function readPagePads(page, resolvePath = path => path) {
    return Array.from({ length: LAUNCHPAD_PADS }, (_, padIndex) => buildPadSteps(page || {}, padIndex, resolvePath));
}

/**
 * Writes a page's pads back to the file format's parallel per-pad arrays.
 * Pads with neither a sound nor a light are written as empty step lists.
 * @param {PadStep[][]} pads - One step list per pad (64 entries).
 * @param {(step: PadStep, padIndex: number, stepIndex: number, stepCount: number) => string} getSoundPath -
 *   Returns the path to store for a step's sample, or '' when it has none.
 * @returns {{sounds: string[][], lights: string[][], lightSyncToSound: boolean[][], lightDurations: number[][]}}
 */
export function writePagePads(pads, getSoundPath) {
    const page = { sounds: [], lights: [], lightSyncToSound: [], lightDurations: [] };

    pads.forEach((steps, padIndex) => {
        const soundPaths = steps.map((step, stepIndex) => getSoundPath(step, padIndex, stepIndex, steps.length) || '');
        const hasContent = soundPaths.some(Boolean) || steps.some(step => step.light);

        page.sounds.push(hasContent ? soundPaths : []);
        page.lights.push(hasContent ? steps.map(step => step.light || '') : []);
        page.lightSyncToSound.push(hasContent ? steps.map(step => step.syncToSound ?? true) : []);
        page.lightDurations.push(hasContent ? steps.map(step => step.duration ?? DEFAULT_LIGHT_DURATION_SEC) : []);
    });

    return page;
}

/**
 * Normalizes a validated project into the runtime shape.
 * Pure function: does not access the network, DOM, or AudioContext.
 * Step buffers start empty; see `collectSoundUrls` and `assignStepBuffers`.
 * @param {object} project - Validated project object.
 * @param {string} [configPath=''] - Path of the project config JSON, used to resolve relative URLs.
 * @returns {RuntimeProject}
 */
export function normalizeProjectData(project, configPath = '') {
    const resolvePath = createPathResolver(configPath);
    const pages = (Array.isArray(project?.pages) ? project.pages : []).map(page => readPagePads(page, resolvePath));

    return {
        project,
        pages,
        appearance: normalizeAppearance(project, resolvePath)
    };
}

/**
 * Iterates over every step of a runtime project.
 * @param {RuntimeProject} runtimeProject
 * @returns {Generator<PadStep>}
 */
function* allSteps(runtimeProject) {
    for (const page of runtimeProject.pages) {
        for (const pad of page) {
            yield* pad;
        }
    }
}

/**
 * Returns the distinct sample URLs a project needs, so each is fetched and
 * decoded once even when several pads share it.
 * @param {RuntimeProject} runtimeProject
 * @returns {string[]}
 */
export function collectSoundUrls(runtimeProject) {
    const urls = new Set();
    for (const step of allSteps(runtimeProject)) {
        if (step.soundUrl) urls.add(step.soundUrl);
    }
    return [...urls];
}

/**
 * Fills each step's `buffer` from decoded samples. Mutates the project, so it
 * must run before the project is committed as the active one.
 * @param {RuntimeProject} runtimeProject
 * @param {Map<string, AudioBuffer>} buffersByUrl
 */
export function assignStepBuffers(runtimeProject, buffersByUrl) {
    for (const step of allSteps(runtimeProject)) {
        step.buffer = (step.soundUrl && buffersByUrl.get(step.soundUrl)) || null;
    }
}
