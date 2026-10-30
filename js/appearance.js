/**
 * PROJECT APPEARANCE MODULE (appearance.js)
 *
 * Applies the canonical appearance produced by appearanceModel.js to the UI
 * (background, skin, icon, visualizer, layout). Normalization itself is pure and
 * lives in appearanceModel.js, so this module is the only one touching the DOM.
 */

import {
    setLaunchpadBackground,
    setTopRightIconFile,
    resetTopRightIcon,
    setLaunchpadRotation,
    setLaunchpadSize,
    restoreLaunchpadLayout
} from './ui.js';
import { setBackgroundMedia } from './background.js';
import { setColors, setGradientDirection } from './visualizerManager.js';
import { normalizeVisualizer } from './appearanceModel.js';

/** @param {File|Blob|string|null} reference */
export function applyBackground(reference) {
    return setBackgroundMedia(reference || null);
}

/** @param {File|Blob|string|null} reference */
export function applySkin(reference) {
    return setLaunchpadBackground(reference || null);
}

/** @param {File|Blob|string|null} reference */
export function applyIcon(reference) {
    return reference ? setTopRightIconFile(reference) : resetTopRightIcon();
}

/**
 * Applies the visualizer colors, gradient and mode.
 * @param {object} [visualizer] - Output of `normalizeVisualizer`.
 */
export function applyVisualizer(visualizer) {
    const cfg = visualizer || normalizeVisualizer({});
    setColors(cfg.color1, cfg.gradient ? cfg.color2 : cfg.color1);
    setGradientDirection(cfg.gradientDirection);
    window.dispatchEvent(new CustomEvent('visualizer:setMode', { detail: { mode: cfg.mode } }));
}

/**
 * Applies rotation and size. Values coming from a project/draft are transient
 * overrides (never saved as the user's preference); the aspects left
 * unspecified fall back to the user's personal setting.
 * @param {number|null} rotation
 * @param {number|null} size
 */
export function applyLayout(rotation, size) {
    if (typeof rotation === 'number') setLaunchpadRotation(rotation, false);
    else restoreLaunchpadLayout({ rotation: true, size: false });
    if (typeof size === 'number') setLaunchpadSize(size, false);
    else restoreLaunchpadLayout({ rotation: false, size: true });
}

/**
 * Applies a full normalized appearance to the UI.
 * @param {object} appearance - Output of `normalizeAppearance`.
 * @returns {Promise<void>}
 */
export async function applyAppearance(appearance) {
    await Promise.all([
        applySkin(appearance.skin),
        applyIcon(appearance.icon),
        applyBackground(appearance.background)
    ]);
    applyVisualizer(appearance.visualizer);
    applyLayout(appearance.rotation, appearance.size);
}
