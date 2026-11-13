/**
 * THEME EDITOR (creator/themeEditor.js)
 *
 * The draft's appearance: background, skin, icon, visualizer and layout, with
 * live preview on the Launchpad.
 */

import {
    applyAppearance,
    applyBackground,
    applyIcon,
    applyLayout,
    applySkin,
    applyVisualizer
} from '../appearance.js';
import { createDefaultAppearance, isFileAsset } from '../appearanceModel.js';
import {
    CATALOG_SKINS_PATH,
    CATALOG_VIDEOS_PATH,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_SIZE_MAX,
    LAUNCHPAD_SIZE_MIN
} from '../constants.js';
import { syncInputSlider } from '../formControls.js';
import { creatorSession } from '../projectCreatorState.js';
import { getStaticCatalog } from '../staticCatalog.js';
import { getLaunchpadRotation, getLaunchpadSize } from '../ui.js';
import { listen } from './dom.js';

function ensureThemeSelectOptions() {
    const bgSelect = document.getElementById('creator-bg-select');
    const skinSelect = document.getElementById('creator-skin-select');
    if (!bgSelect || !skinSelect) return;

    if (bgSelect.options.length <= 1) {
        const data = getStaticCatalog();
        if (Array.isArray(data.videos)) {
            data.videos.forEach(video => {
                const opt = document.createElement('option');
                // Canonical path: works in the player and survives export/import.
                opt.value = `${CATALOG_VIDEOS_PATH}${video}`;
                opt.textContent = video.replace(/\.(mp4|webm)$/i, '');
                bgSelect.appendChild(opt);
            });
        }
        if (Array.isArray(data.skins)) {
            data.skins.forEach(skin => {
                const opt = document.createElement('option');
                opt.value = `${CATALOG_SKINS_PATH}${skin}`;
                opt.textContent = skin.replace(/\.(png|jpg)$/i, '').replace(/_/g, ' ');
                skinSelect.appendChild(opt);
            });
        }
    }
}

/**
 * Canonical appearance of the current draft. `rotation`/`size` stay `null` when
 * the draft does not override them, so the user's personal preference is kept.
 * @returns {object}
 */
function getDraftAppearance() {
    return creatorSession.getDraft()?.appearance || createDefaultAppearance();
}

function previewDraftBackground() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    applyBackground(getDraftAppearance().background);
}

function previewDraftSkin() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    applySkin(getDraftAppearance().skin);
}

function previewDraftIcon() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    applyIcon(getDraftAppearance().icon);
}

function previewDraftVisualizer() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    applyVisualizer(getDraftAppearance().visualizer);
}

function previewDraftLayout() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    const { rotation, size } = getDraftAppearance();
    applyLayout(rotation, size);
}

/**
 * Applies the whole draft appearance and is used when opening or importing a
 * draft. Live input handlers use the per-aspect helpers above so that changing
 * rotation or a colour does not rebuild the background media element.
 */
export function previewDraftAppearance() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    applyAppearance(getDraftAppearance());
}

/**
 * Shows an appearance asset in its catalog <select>: an uploaded file gets a
 * dedicated "File: <name>" option, a catalog path selects its own option.
 * @param {HTMLSelectElement|null} select
 * @param {File|Blob|string|null} asset
 */
function renderAssetSelect(select, asset) {
    if (!select) return;
    if (isFileAsset(asset)) {
        let customOpt = select.querySelector('option[data-custom]');
        if (!customOpt) {
            customOpt = document.createElement('option');
            customOpt.setAttribute('data-custom', 'true');
            select.appendChild(customOpt);
        }
        customOpt.value = 'custom';
        customOpt.textContent = `File: ${asset.name}`;
        select.value = 'custom';
    } else {
        select.value = asset || '';
    }
}

/**
 * Shows the name of an appearance asset (file name or path), hidden when unset.
 * @param {HTMLElement|null} label
 * @param {File|Blob|string|null} asset
 * @param {{showPaths?: boolean}} [options] - Also show catalog paths, not only uploaded files.
 */
function renderAssetName(label, asset, { showPaths = false } = {}) {
    if (!label) return;
    const name = isFileAsset(asset) ? asset.name : (showPaths && asset ? asset : null);
    label.hidden = !name;
    if (name) label.textContent = name;
}

export function renderThemeView() {
    ensureThemeSelectOptions();
    const draft = creatorSession.getDraft();
    if (!draft) return;
    const { appearance } = draft;

    renderAssetSelect(document.getElementById('creator-bg-select'), appearance.background);
    renderAssetName(document.getElementById('creator-bg-custom-name'), appearance.background);
    renderAssetSelect(document.getElementById('creator-skin-select'), appearance.skin);
    renderAssetName(document.getElementById('creator-skin-custom-name'), appearance.skin);
    renderAssetName(document.getElementById('creator-icon-custom-name'), appearance.icon, { showPaths: true });

    const vizMode = document.getElementById('creator-viz-mode');
    const vizColors = document.getElementById('creator-viz-colors');
    const vizColor1 = document.getElementById('creator-viz-color1');
    const vizGradient = document.getElementById('creator-viz-gradient');
    const vizGradientSettings = document.getElementById('creator-viz-gradient-settings');
    const vizColor2 = document.getElementById('creator-viz-color2');
    const vizDirection = document.getElementById('creator-viz-direction');

    const viz = appearance.visualizer;
    if (vizMode) vizMode.value = viz.mode;
    if (vizColors) vizColors.hidden = viz.mode === 'off';
    if (vizColor1) vizColor1.value = viz.color1;
    if (vizGradient) vizGradient.checked = viz.gradient;
    if (vizGradientSettings) vizGradientSettings.hidden = !viz.gradient;
    if (vizColor2) vizColor2.value = viz.color2;
    if (vizDirection) vizDirection.value = viz.gradientDirection;

    const rotSlider = document.getElementById('creator-rotation-slider');
    const rotInput = document.getElementById('creator-rotation-input');
    const rotVal = typeof appearance.rotation === 'number' ? appearance.rotation : getLaunchpadRotation();
    if (rotSlider) rotSlider.value = rotVal;
    if (rotInput) rotInput.value = rotVal;

    const sizeSlider = document.getElementById('creator-size-slider');
    const sizeInput = document.getElementById('creator-size-input');
    const sizeVal = typeof appearance.size === 'number' ? appearance.size : getLaunchpadSize();
    if (sizeSlider) sizeSlider.value = sizeVal;
    if (sizeInput) sizeInput.value = sizeVal;
}

export const THEME_PREVIEWS = {
    background: previewDraftBackground,
    skin: previewDraftSkin,
    icon: previewDraftIcon,
    visualizer: previewDraftVisualizer,
    layout: previewDraftLayout
};

/**
 * Whether a theme change must re-render the theme form. Continuous inputs
 * (rotation/size, colours, gradient direction) are their own source of truth:
 * writing their value back while the user drags or types would fight them.
 * @param {import('./projectCreatorState.js').SessionChange} change
 */
export function themeFormNeedsRender(change) {
    if (change.aspect === 'layout') return false;
    if (change.aspect === 'visualizer') {
        return change.keys.includes('mode') || change.keys.includes('gradient');
    }
    return true;
}

export function initThemeEditorListeners() {
    const bindThemeAsset = ({ selectId = null, triggerId, fileId, assetKey }) => {
        const select = selectId ? document.getElementById(selectId) : null;
        if (select) {
            listen(select, 'change', (e) => {
                // 'custom' is the placeholder option showing an uploaded file.
                if (e.target.value === 'custom') return;
                creatorSession.setAppearanceAsset(assetKey, e.target.value || null);
            });
        }

        const fileInput = document.getElementById(fileId);
        listen(triggerId, 'click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
        listen(fileInput, 'change', (e) => {
            const file = e.target.files?.[0];
            if (file) creatorSession.setAppearanceAsset(assetKey, file);
        });
    };

    bindThemeAsset({ selectId: 'creator-bg-select', triggerId: 'creator-upload-bg-trigger', fileId: 'creator-bg-file', assetKey: 'background' });
    bindThemeAsset({ selectId: 'creator-skin-select', triggerId: 'creator-upload-skin-trigger', fileId: 'creator-skin-file', assetKey: 'skin' });
    bindThemeAsset({ triggerId: 'creator-upload-icon-trigger', fileId: 'creator-icon-file', assetKey: 'icon' });

    listen('creator-reset-icon-trigger', 'click', () => {
        creatorSession.setAppearanceAsset('icon', null);
    });

    const bindVisualizerInput = (id, eventName, key, read = (target) => target.value) => {
        listen(id, eventName, (e) => {
            creatorSession.updateVisualizer({ [key]: read(e.target) });
        });
    };
    bindVisualizerInput('creator-viz-mode', 'change', 'mode');
    bindVisualizerInput('creator-viz-color1', 'input', 'color1');
    bindVisualizerInput('creator-viz-gradient', 'change', 'gradient', (target) => target.checked);
    bindVisualizerInput('creator-viz-color2', 'input', 'color2');
    bindVisualizerInput('creator-viz-direction', 'change', 'gradientDirection');

    syncInputSlider({
        sliderId: 'creator-rotation-slider',
        inputId: 'creator-rotation-input',
        min: LAUNCHPAD_ROTATION_MIN,
        max: LAUNCHPAD_ROTATION_MAX,
        onChange: (rotation) => creatorSession.setLayout({ rotation })
    });
    syncInputSlider({
        sliderId: 'creator-size-slider',
        inputId: 'creator-size-input',
        min: LAUNCHPAD_SIZE_MIN,
        max: LAUNCHPAD_SIZE_MAX,
        onChange: (size) => creatorSession.setLayout({ size })
    });
}
