/**
 * APPEARANCE MODEL (appearanceModel.js)
 *
 * Pure normalizers that turn the visual configuration of a project or Studio
 * draft into a canonical shape. No DOM or storage access lives here, so this
 * module can be imported by pure models and tests. The functions that actually
 * apply the result to the UI live in appearance.js.
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
 * Resolves an asset reference. An explicitly uploaded File/Blob always wins over
 * a path string, which is resolved through `resolvePath` when provided.
 * @param {File|Blob|null} customFile
 * @param {string|undefined} pathRef
 * @param {Function} resolvePath
 * @returns {File|Blob|string|null}
 */
function resolveAsset(customFile, pathRef, resolvePath) {
    if (customFile) return customFile;
    return typeof pathRef === 'string' && pathRef ? resolvePath(pathRef) : null;
}

/**
 * Background media declared by a project/draft, taking uploaded files into
 * account. Handles the legacy `backgroundVideo`/`backgroundImage` aliases and
 * `backgroundMedia`.
 * @param {object} source
 * @param {(path: string) => (string|File|Blob)} [resolvePath]
 * @returns {File|Blob|string|null}
 */
export function getBackgroundMedia(source = {}, resolvePath = identity) {
    if (source.customBackgroundFile) return source.customBackgroundFile;
    const pathRef = firstString(source.backgroundMedia, source.backgroundVideo, source.backgroundImage);
    return pathRef ? resolvePath(pathRef) : null;
}

/**
 * Normalizes the visualizer settings, accepting both the flat legacy fields and
 * the nested `visualizer` object.
 * @param {object} source
 * @returns {{mode: string, color1: string, color2: string, gradient: boolean, gradientDirection: string}}
 */
export function normalizeVisualizer(source = {}) {
    const nested = (source.visualizer && typeof source.visualizer === 'object') ? source.visualizer : {};
    return {
        mode: firstString(nested.mode, source.visualizerMode) || DEFAULT_VISUALIZER_MODE,
        color1: firstString(nested.color1, source.visualizerColor1) || DEFAULT_VISUALIZER_COLOR,
        color2: firstString(nested.color2, source.visualizerColor2) || DEFAULT_VISUALIZER_COLOR,
        gradient: firstBoolean(nested.gradient, source.visualizerGradient) ?? DEFAULT_VISUALIZER_GRADIENT,
        gradientDirection: firstString(nested.gradientDirection, source.visualizerGradientDirection)
            || DEFAULT_VISUALIZER_GRADIENT_DIRECTION
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
 * Normalizes the whole appearance of a project or Studio draft.
 * @param {object} source - Project configuration or draft.
 * @param {(path: string) => (string|File|Blob)} [resolvePath] - Path resolver for relative refs.
 * @returns {{background: *, skin: *, icon: *, visualizer: object, rotation: number|null, size: number|null}}
 */
export function normalizeAppearance(source = {}, resolvePath = identity) {
    const layout = normalizeLayout(source);
    return {
        background: getBackgroundMedia(source, resolvePath),
        skin: resolveAsset(source.customCoverFile, source.coverImage, resolvePath),
        icon: resolveAsset(source.customIconFile, source.iconImage, resolvePath),
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
