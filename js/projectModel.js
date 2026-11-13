/**
 * PROJECT DATA MODEL (projectModel.js)
 * 
 * Pure functions for project path resolution and data normalization.
 * Agnostic to DOM, Web Audio, and network.
 */

import { normalizeAppearance } from './appearanceModel.js';
import { LAUNCHPAD_PADS, DEFAULT_LIGHT_DURATION_SEC } from './constants.js';

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
        if (path.startsWith('http') || path.startsWith('/') || path.startsWith('assets/')) return path;
        return baseUrl ? baseUrl + path : path;
    };
}

/**
 * Normalizes project schema into runtime audio, light, timing, and appearance structures.
 * Pure function: does not access the network, DOM, or AudioContext.
 * @param {object} project - Validated project object.
 * @param {string} [configPath=''] - Path of the project config JSON, used to resolve relative URLs.
 * @returns {{
 *   project: object,
 *   sounds: string[][],
 *   lights: string[][],
 *   lightSyncToSound: boolean[][],
 *   lightDurations: number[][],
 *   appearance: object
 * }}
 */
export function normalizeProjectData(project, configPath = '') {
    const resolvePath = createPathResolver(configPath);
    const sounds = [];
    const lights = [];
    const lightSyncToSound = [];
    const lightDurations = [];

    if (Array.isArray(project?.pages)) {
        project.pages.forEach(page => {
            const pageSounds = (page.sounds || []).map(stepEntry =>
                Array.isArray(stepEntry)
                    ? stepEntry.map(s => resolvePath(s))
                    : (stepEntry ? [resolvePath(stepEntry)] : [])
            );
            while (pageSounds.length < LAUNCHPAD_PADS) pageSounds.push([]);
            sounds.push(...pageSounds);

            const pageLights = (page.lights || []).map(stepEntry =>
                Array.isArray(stepEntry) ? stepEntry : (stepEntry ? [stepEntry] : [])
            );
            while (pageLights.length < LAUNCHPAD_PADS) pageLights.push([]);
            lights.push(...pageLights);

            const pageSync = (page.lightSyncToSound || []).map(stepEntry =>
                Array.isArray(stepEntry) ? stepEntry : [stepEntry ?? true]
            );
            while (pageSync.length < LAUNCHPAD_PADS) pageSync.push([true]);
            lightSyncToSound.push(...pageSync);

            const pageDurs = (page.lightDurations || []).map(stepEntry =>
                Array.isArray(stepEntry) ? stepEntry : [stepEntry ?? DEFAULT_LIGHT_DURATION_SEC]
            );
            while (pageDurs.length < LAUNCHPAD_PADS) pageDurs.push([DEFAULT_LIGHT_DURATION_SEC]);
            lightDurations.push(...pageDurs);
        });
    }

    const appearance = normalizeAppearance(project, resolvePath);

    return {
        project,
        sounds,
        lights,
        lightSyncToSound,
        lightDurations,
        appearance
    };
}
