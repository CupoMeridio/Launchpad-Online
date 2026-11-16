/**
 * APPEARANCE MODEL (appearanceModel.js)
 *
 * Pure normalizers that turn the visual configuration of a project file into
 * the canonical appearance shape, shared by the player and the Studio draft:
 *
 *   { background, skin, icon, visualizer, rotation, size }
 *
 * where each asset is a path/URL string, an uploaded File/Blob, or null.
 * No DOM or storage access lives here; applying it to the UI is appearance.js.
 */

import {
    DEFAULT_VISUALIZER_MODE,
    DEFAULT_VISUALIZER_COLOR,
    DEFAULT_VISUALIZER_GRADIENT,
    DEFAULT_VISUALIZER_GRADIENT_DIRECTION
} from './constants.js';

const identity = path => path;

function firstString(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value) return value;
    }
    return null;
}

function firstBoolean(...values) {
    for (const value of values) {
        if (typeof value === 'boolean') return value;
    }
    return null;
}

/**
 * Resolves a declared asset path through `resolvePath`.
 * @param {*} pathRef - Value of the project field.
 * @param {(path: string) => (string|File|Blob|null)} resolvePath
 * @returns {File|Blob|string|null}
 */
function resolveAsset(pathRef, resolvePath) {
    const path = firstString(pathRef);
    return path ? (resolvePath(path) || null) : null;
}

/**
 * True for an uploaded/packaged asset (File or Blob, or a test double with a
 * `name`) as opposed to a path string.
 * @param {*} asset
 * @returns {boolean}
 */
export function isFileAsset(asset) {
    return Boolean(asset) && typeof asset === 'object';
}

/**
 * Normalizes the visualizer settings from the canonical nested `visualizer`
 * object.
 * @param {object} source
 * @returns {{mode: string, color1: string, color2: string, gradient: boolean, gradientDirection: string}}
 */
export function normalizeVisualizer(source = {}) {
    const nested = (source.visualizer && typeof source.visualizer === 'object') ? source.visualizer : {};
    return {
        mode: firstString(nested.mode) || DEFAULT_VISUALIZER_MODE,
        color1: firstString(nested.color1) || DEFAULT_VISUALIZER_COLOR,
        color2: firstString(nested.color2) || DEFAULT_VISUALIZER_COLOR,
        gradient: firstBoolean(nested.gradient) ?? DEFAULT_VISUALIZER_GRADIENT,
        gradientDirection: firstString(nested.gradientDirection) || DEFAULT_VISUALIZER_GRADIENT_DIRECTION
    };
}

/**
 * Layout overrides declared by a project/draft. `null` means "not specified", so
 * the user's personal rotation/size preference must be kept untouched.
 * @param {object} source
 * @returns {{rotation: number|null, size: number|null}}
 */
export function normalizeLayout(source = {}) {
    return {
        rotation: typeof source.launchpadRotation === 'number' ? source.launchpadRotation : null,
        size: typeof source.launchpadSize === 'number' ? source.launchpadSize : null
    };
}

/**
 * Normalizes the whole appearance declared by a project file.
 * @param {object} source - Project configuration.
 * @param {(path: string) => (string|File|Blob|null)} [resolvePath] - Maps each declared
 *   asset path to what should be applied (a URL, or a packaged File when importing a zip).
 * @returns {{background: *, skin: *, icon: *, visualizer: object, rotation: number|null, size: number|null}}
 */
export function normalizeAppearance(source = {}, resolvePath = identity) {
    const layout = normalizeLayout(source);
    return {
        background: resolveAsset(source.backgroundMedia, resolvePath),
        skin: resolveAsset(source.coverImage, resolvePath),
        icon: resolveAsset(source.iconImage, resolvePath),
        visualizer: normalizeVisualizer(source),
        rotation: layout.rotation,
        size: layout.size
    };
}

/**
 * Appearance used when there is no project to restore: everything cleared but
 * rotation/size left unspecified so the user preference is preserved.
 * @returns {object}
 */
export function createDefaultAppearance() {
    return {
        background: null,
        skin: null,
        icon: null,
        visualizer: normalizeVisualizer({}),
        rotation: null,
        size: null
    };
}
