import { getTranslation, showNotification, syncInputSlider, getLaunchpadRotation, getLaunchpadSize } from './ui.js';
import { buildAnimationCatalog, createProjectPage, createDraft, isDraftDirty, assignPadSample, removePadSample } from './projectCreatorModel.js';
import { exportProjectToZip, importProjectFromZip } from './projectZip.js';
import { normalizeAppearance } from './appearanceModel.js';
import {
    applyBackground,
    applySkin,
    applyIcon,
    applyVisualizer,
    applyLayout,
    applyAppearance
} from './appearance.js';
import { animations, releaseAnimation, triggerAnimation } from './lights.js';
import { resolveLightDuration } from './animationData.js';
import { webColorMap, getPadElement, updatePageButtonHighlight } from './webInterface.js';
import { audioEngine } from './audio.js';
import { setPadSource, updatePhysicalPageLights, syncPerformancePageButtons, syncPerformanceModeButtons } from './interaction.js';
import { currentPage, currentMode, getStaticData } from './app.js';
import { 
    LAUNCHPAD_COLS, 
    LAUNCHPAD_PADS, 
    MAX_PROJECT_PAGES, 
    MIN_LIGHT_DURATION_SEC, 
    MAX_LIGHT_DURATION_SEC, 
    DEFAULT_LIGHT_DURATION_SEC,
    ANIMATION_COLORS,
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX
} from './constants.js';

const LIGHT_COLOR_SWATCHES = {
    red: webColorMap.red.full,
    orange: webColorMap.orange.full,
    amber: webColorMap.amber.full,
    yellow: webColorMap.yellow.full,
    green: webColorMap.green.full
};

const LIGHT_CATEGORY_KEYS = ['all', 'basic', 'geometric', 'directional', 'multicolor', 'characters', 'special', 'text'];
const DYNAMIC_TEXT_PRESETS = [
    { id: 'text', template: 'text', labelKey: 'creator.light.text' },
    { id: 'scroll', template: 'scroll', labelKey: 'creator.light.scroll' },
    { id: 'scroll_left', template: 'scroll_left', labelKey: 'creator.light.scrollLeft' },
    { id: 'scroll_right', template: 'scroll_right', labelKey: 'creator.light.scrollRight' },
    { id: 'scroll_up', template: 'scroll_up', labelKey: 'creator.light.scrollUp' },
    { id: 'scroll_down', template: 'scroll_down', labelKey: 'creator.light.scrollDown' },
    { id: 'scroll_top', template: 'scroll_top', labelKey: 'creator.light.scrollTop' },
    { id: 'scroll_bottom', template: 'scroll_bottom', labelKey: 'creator.light.scrollBottom' }
];

let initialized = false;
let draft = null;
let activePageIndex = 0;
let activePadIndex = null;
let editorActive = false;
let activeLightCategory = 'all';
let pendingTextAnimation = null;
let allAnimationGroups = null;
let studioSubMode = 'edit';
let activeCreatorView = 'pads';
let activeMomentaryPreview = null;

let lastRenderedCategory = null;
let lastRenderedSearch = null;

const creatorPadSource = {
    getPadConfig: (index) => {
        const page = getCurrentPage();
        if (!page) return null;
        return {
            soundIndex: undefined,
            soundBuffer: page.soundBuffers[index],
            soundKey: `draft:${activePageIndex}:${index}`,
            animationName: page.lights[index] || null,
            syncToSound: page.lightSyncToSound[index] ?? true,
            manualDuration: getManualLightDuration(page, index)
        };
    },
    onPadPress: (index) => {
        if (studioSubMode === 'edit') {
            selectProjectPad(index, false);
        }
    },
    onPageChange: (pageIndex, updateVisuals) => {
        selectProjectPage(pageIndex, updateVisuals);
    }
};

function getAnimationGroups() {
    if (!allAnimationGroups) {
        const animationGroups = buildAnimationCatalog(animations);
        const dynamicTextGroups = DYNAMIC_TEXT_PRESETS.map(preset => ({
            id: preset.id,
            labelKey: preset.labelKey,
            category: 'text',
            dynamicTemplate: preset.template,
            variants: ANIMATION_COLORS.map(color => ({ animation: null, color, supportsDuration: true }))
        }));
        allAnimationGroups = [...animationGroups, ...dynamicTextGroups];
    }
    return allAnimationGroups;
}

function translate(key, values = {}) {
    return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        getTranslation(key)
    );
}

function getCurrentPage() {
    return draft?.pages[activePageIndex] || null;
}

function getManualLightDuration(page, padIndex) {
    return page.lightDurations[padIndex] ?? DEFAULT_LIGHT_DURATION_SEC;
}

function isSwatchSelected(selectedLight, isDynamic, template, color, animationName) {
    if (!selectedLight && !pendingTextAnimation) return false;
    if (isDynamic) {
        const hasDirectionPrefix = DYNAMIC_TEXT_PRESETS
            .filter(preset => preset.template.startsWith('scroll_'))
            .some(preset => selectedLight.startsWith(`${preset.template}_`));
        const matchesDynamicTemplate = template === 'scroll'
            ? selectedLight.startsWith('scroll_') && !hasDirectionPrefix
            : selectedLight.startsWith(`${template}_`);
        const savedDynamicMatch = matchesDynamicTemplate && selectedLight.endsWith(`_${color}`);
        return (pendingTextAnimation?.template === template && pendingTextAnimation.color === color) || savedDynamicMatch;
    }
    return selectedLight === animationName;
}


function stopPreview() {
    audioEngine.stopSound('preview');
    if (activeMomentaryPreview) {
        releaseAnimation(activeMomentaryPreview.animation, activeMomentaryPreview.x, activeMomentaryPreview.y);
        activeMomentaryPreview = null;
    }
}

function renderPageTabs() {
    const tabs = document.getElementById('creator-page-tabs');
    tabs.replaceChildren();

    draft.pages.forEach((page, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'creator-page-tab';
        button.classList.toggle('selected', index === activePageIndex);
        button.textContent = String(index + 1);
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(index === activePageIndex));
        button.setAttribute('aria-label', translate('creator.page', { page: index + 1 }));
        button.addEventListener('click', () => {
            selectProjectPage(index);
        });
        tabs.appendChild(button);
    });

    document.getElementById('creator-add-page').disabled = draft.pages.length >= MAX_PROJECT_PAGES;
    document.getElementById('creator-remove-page').disabled = draft.pages.length <= 1;
}

function renderPadGrid() {
    const page = getCurrentPage();
    if (!page) return;

    for (let index = 0; index < LAUNCHPAD_PADS; index++) {
        const pad = getPadElement(index);
        if (!pad) continue;

        const sample = page.samples[index];
        const led = page.lights[index];
        pad.classList.toggle('creator-pad-assigned', !!sample || !!led);
        pad.classList.toggle('creator-pad-selected', index === activePadIndex);
        pad.setAttribute('aria-pressed', String(index === activePadIndex));
        const labels = [sample
            ? translate('creator.padAssigned', { pad: index + 1, file: sample.name })
            : translate('creator.padEmpty', { pad: index + 1 })];
        if (led) labels.push(translate('creator.padLightAssigned'));
        pad.setAttribute('aria-label', labels.join(', '));

        if (led) {
            pad.dataset.creatorLed = led;
            pad.style.setProperty('--creator-led-color', getAnimationColor(led));
        } else {
            delete pad.dataset.creatorLed;
            pad.style.removeProperty('--creator-led-color');
        }
    }
}

function getAnimationDisplayName(animationName) {
    if (!animationName) return '';
    if (animationName.startsWith('scroll_')) {
        const parts = animationName.split('_');
        return `Scroll "${parts.slice(1, -1).join(' ')}"`;
    }
    if (animationName.startsWith('text_')) {
        const parts = animationName.split('_');
        return `Text "${parts.slice(1, -1).join(' ')}"`;
    }
    for (const group of getAnimationGroups()) {
        const variant = group.variants.find(v => v.animation === animationName || group.id === animationName);
        if (variant) {
            const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
            const colorLabel = variant.color
                ? getTranslation(`creator.led${variant.color[0].toUpperCase()}${variant.color.slice(1)}`)
                : variant.sequence
                    ? getTranslation(`creator.light.sequence.${variant.sequence}`)
                    : '';
            return colorLabel ? `${groupLabel} · ${colorLabel}` : groupLabel;
        }
    }
    return animationName.replace(/_/g, ' ');
}

function stopAllDraftPads() {
    audioEngine.stopSoundsWithPrefix('draft:');
    for (let i = 0; i < LAUNCHPAD_PADS; i++) {
        const pad = getPadElement(i);
        if (pad) pad.classList.remove('active');
    }
}

function renderSelectedPad() {
    const page = getCurrentPage();
    const padInspector = document.getElementById('creator-pad-inspector');
    const sampleCount = page.samples.filter(Boolean).length;
    document.getElementById('project-creator-name').value = draft.name;
    document.getElementById('creator-page-count').textContent = `${activePageIndex + 1} / ${draft.pages.length}`;
    document.getElementById('creator-sample-count').textContent = translate('creator.sampleCount', {
        count: sampleCount
    });

    padInspector.hidden = activePadIndex === null;
    document.getElementById('creator-text-animation').hidden = !pendingTextAnimation;
    if (activePadIndex === null) return;

    const sample = page.samples[activePadIndex];
    const animation = page.lights[activePadIndex];
    const isMomentary = !!(animation && animations[animation]?.type === 'momentary');

    document.getElementById('creator-selected-pad').textContent = translate('creator.pad', {
        pad: activePadIndex + 1
    });
    document.getElementById('creator-sample-name').textContent = sample
        ? translate('creator.sampleAssigned', { file: sample.name })
        : getTranslation('creator.sampleEmpty');

    const previewBtn = document.getElementById('creator-preview-pad');
    previewBtn.disabled = !sample && !animation;
    if (isMomentary) {
        previewBtn.textContent = translate('creator.playPadHold');
        previewBtn.title = translate('creator.playPadHoldHint');
    } else {
        previewBtn.textContent = getTranslation('creator.playPad');
        previewBtn.removeAttribute('title');
    }
    document.getElementById('creator-hold-hint').hidden = !isMomentary;

    document.getElementById('creator-remove-sample').disabled = !sample;

    const assignedCard = document.getElementById('creator-assigned-light');
    const assignedSwatch = document.getElementById('creator-assigned-swatch');
    const assignedName = document.getElementById('creator-assigned-name');
    const removeLightBtn = document.getElementById('creator-remove-light');
    const timingSection = document.getElementById('creator-light-timing');
    const syncCheckbox = document.getElementById('creator-light-sync');

    if (animation) {
        assignedCard.hidden = false;
        assignedName.textContent = getAnimationDisplayName(animation);
        if (animation.includes('red_to_green')) {
            assignedSwatch.style.background = `linear-gradient(135deg, ${LIGHT_COLOR_SWATCHES.red}, ${LIGHT_COLOR_SWATCHES.green})`;
        } else if (animation.includes('green_to_red')) {
            assignedSwatch.style.background = `linear-gradient(135deg, ${LIGHT_COLOR_SWATCHES.green}, ${LIGHT_COLOR_SWATCHES.red})`;
        } else {
            assignedSwatch.style.background = getAnimationColor(animation);
        }
        removeLightBtn.disabled = false;

        if (isMomentary) {
            timingSection.hidden = true;
        } else {
            timingSection.hidden = false;
            const manualDurationInput = document.getElementById('creator-light-duration');
            const manualDurationContainer = document.getElementById('creator-manual-light-duration');

            syncCheckbox.checked = page.lightSyncToSound[activePadIndex];
            syncCheckbox.disabled = !sample;

            manualDurationInput.value = page.lightDurations[activePadIndex];
            manualDurationContainer.hidden = Boolean(sample && syncCheckbox.checked);
        }
    } else {
        assignedCard.hidden = true;
        removeLightBtn.disabled = true;
        timingSection.hidden = true;
    }

    renderLightPresets();
}

let staticCatalog = null;

/**
 * Returns the static catalog (videos/skins) already fetched by app.js, so the
 * Studio does not issue a second request for js/static-data.json.
 * @returns {Promise<{videos: string[], skins: string[]}>}
 */
async function loadStaticCatalog() {
    if (!staticCatalog) {
        staticCatalog = getStaticData();
    }
    return staticCatalog || { videos: [], skins: [] };
}

async function ensureThemeSelectOptions() {
    const bgSelect = document.getElementById('creator-bg-select');
    const skinSelect = document.getElementById('creator-skin-select');
    if (!bgSelect || !skinSelect) return;

    if (bgSelect.options.length <= 1) {
        const data = await loadStaticCatalog();
        if (Array.isArray(data.videos)) {
            data.videos.forEach(video => {
                const opt = document.createElement('option');
                opt.value = video;
                opt.textContent = video.replace(/\.(mp4|webm)$/i, '');
                bgSelect.appendChild(opt);
            });
        }
        if (Array.isArray(data.skins)) {
            data.skins.forEach(skin => {
                const opt = document.createElement('option');
                opt.value = skin;
                opt.textContent = skin.replace(/\.(png|jpg)$/i, '').replace(/_/g, ' ');
                skinSelect.appendChild(opt);
            });
        }
    }
}

function setCreatorView(view) {
    activeCreatorView = view;
    const padsTab = document.getElementById('creator-tab-pads');
    const themeTab = document.getElementById('creator-tab-theme');
    const padsView = document.getElementById('creator-pads-view');
    const themeView = document.getElementById('creator-theme-view');

    if (padsTab && themeTab && padsView && themeView) {
        padsTab.classList.toggle('selected', view === 'pads');
        padsTab.setAttribute('aria-selected', String(view === 'pads'));
        themeTab.classList.toggle('selected', view === 'theme');
        themeTab.setAttribute('aria-selected', String(view === 'theme'));

        padsView.hidden = (view !== 'pads');
        themeView.hidden = (view !== 'theme');
    }
}

/**
 * Canonical appearance of the current draft. `rotation`/`size` stay `null` when
 * the draft does not override them, so the user's personal preference is kept.
 * @returns {object}
 */
function getDraftAppearance() {
    return normalizeAppearance(draft || {});
}

function previewDraftBackground() {
    if (!draft || !editorActive) return;
    applyBackground(getDraftAppearance().background);
}

function previewDraftSkin() {
    if (!draft || !editorActive) return;
    applySkin(getDraftAppearance().skin);
}

function previewDraftIcon() {
    if (!draft || !editorActive) return;
    applyIcon(getDraftAppearance().icon);
}

function previewDraftVisualizer() {
    if (!draft || !editorActive) return;
    applyVisualizer(getDraftAppearance().visualizer);
}

function previewDraftLayout() {
    if (!draft || !editorActive) return;
    const { rotation, size } = getDraftAppearance();
    applyLayout(rotation, size);
}

/**
 * Applies the whole draft appearance and is used when opening or importing a
 * draft. Live input handlers use the per-aspect helpers above so that changing
 * rotation or a colour does not rebuild the background media element.
 */
function previewDraftAppearance() {
    if (!draft || !editorActive) return;
    applyAppearance(getDraftAppearance());
}

async function renderThemeView() {
    await ensureThemeSelectOptions();
    if (!draft) return;

    const bgSelect = document.getElementById('creator-bg-select');
    const bgCustomName = document.getElementById('creator-bg-custom-name');
    if (bgSelect) {
        if (draft.customBackgroundFile) {
            let customOpt = bgSelect.querySelector('option[data-custom]');
            if (!customOpt) {
                customOpt = document.createElement('option');
                customOpt.setAttribute('data-custom', 'true');
                bgSelect.appendChild(customOpt);
            }
            customOpt.value = 'custom';
            customOpt.textContent = `File: ${draft.customBackgroundFile.name}`;
            bgSelect.value = 'custom';
        } else {
            bgSelect.value = draft.backgroundMedia || '';
        }
    }
    if (bgCustomName) {
        if (draft.customBackgroundFile) {
            bgCustomName.hidden = false;
            bgCustomName.textContent = draft.customBackgroundFile.name;
        } else {
            bgCustomName.hidden = true;
        }
    }

    const skinSelect = document.getElementById('creator-skin-select');
    const skinCustomName = document.getElementById('creator-skin-custom-name');
    if (skinSelect) {
        if (draft.customCoverFile) {
            let customOpt = skinSelect.querySelector('option[data-custom]');
            if (!customOpt) {
                customOpt = document.createElement('option');
                customOpt.setAttribute('data-custom', 'true');
                skinSelect.appendChild(customOpt);
            }
            customOpt.value = 'custom';
            customOpt.textContent = `File: ${draft.customCoverFile.name}`;
            skinSelect.value = 'custom';
        } else {
            skinSelect.value = draft.coverImage || '';
        }
    }
    if (skinCustomName) {
        if (draft.customCoverFile) {
            skinCustomName.hidden = false;
            skinCustomName.textContent = draft.customCoverFile.name;
        } else {
            skinCustomName.hidden = true;
        }
    }

    const iconCustomName = document.getElementById('creator-icon-custom-name');
    if (iconCustomName) {
        if (draft.customIconFile) {
            iconCustomName.hidden = false;
            iconCustomName.textContent = draft.customIconFile.name;
        } else if (draft.iconImage) {
            iconCustomName.hidden = false;
            iconCustomName.textContent = draft.iconImage;
        } else {
            iconCustomName.hidden = true;
        }
    }

    const vizMode = document.getElementById('creator-viz-mode');
    const vizColors = document.getElementById('creator-viz-colors');
    const vizColor1 = document.getElementById('creator-viz-color1');
    const vizGradient = document.getElementById('creator-viz-gradient');
    const vizGradientSettings = document.getElementById('creator-viz-gradient-settings');
    const vizColor2 = document.getElementById('creator-viz-color2');
    const vizDirection = document.getElementById('creator-viz-direction');

    if (vizMode) vizMode.value = draft.visualizerMode || 'off';
    if (vizColors) vizColors.hidden = !(draft.visualizerMode && draft.visualizerMode !== 'off');
    if (vizColor1) vizColor1.value = draft.visualizerColor1 || '#00aaff';
    if (vizGradient) vizGradient.checked = !!draft.visualizerGradient;
    if (vizGradientSettings) vizGradientSettings.hidden = !draft.visualizerGradient;
    if (vizColor2) vizColor2.value = draft.visualizerColor2 || '#00aaff';
    if (vizDirection) vizDirection.value = draft.visualizerGradientDirection || 'vertical';

    const rotSlider = document.getElementById('creator-rotation-slider');
    const rotInput = document.getElementById('creator-rotation-input');
    const rotVal = typeof draft.launchpadRotation === 'number' ? draft.launchpadRotation : getLaunchpadRotation();
    if (rotSlider) rotSlider.value = rotVal;
    if (rotInput) rotInput.value = rotVal;

    const sizeSlider = document.getElementById('creator-size-slider');
    const sizeInput = document.getElementById('creator-size-input');
    const sizeVal = typeof draft.launchpadSize === 'number' ? draft.launchpadSize : getLaunchpadSize();
    if (sizeSlider) sizeSlider.value = sizeVal;
    if (sizeInput) sizeInput.value = sizeVal;
}

function renderEditor() {
    renderPageTabs();
    renderPadGrid();
    renderSelectedPad();
    renderThemeView();
}

function requestCloseCreator() {
    if (!editorActive) return;
    if (!isDraftDirty(draft)) {
        forceCloseCreator();
        return;
    }
    const dialog = document.getElementById('creator-unsaved-dialog');
    if (dialog) {
        if (dialog.open) return;
        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    } else {
        if (window.confirm(getTranslation('creator.unsavedMessage'))) {
            forceCloseCreator();
        }
    }
}

function closeUnsavedDialog() {
    const dialog = document.getElementById('creator-unsaved-dialog');
    if (dialog) {
        if (typeof dialog.close === 'function') {
            dialog.close();
        } else {
            dialog.removeAttribute('open');
        }
    }
}

function forceCloseCreator() {
    closeUnsavedDialog();
    activeImportId++;
    editorActive = false;
    stopPreview();
    stopAllDraftPads();
    setPadSource(null);
    studioSubMode = 'edit';

    // MEMORY PURGE: Release draft, AudioBuffers, and File objects immediately!
    draft = null;
    activePadIndex = null;
    pendingTextAnimation = null;

    const layout = document.querySelector('.layout');
    if (layout) {
        delete layout.dataset.studio;
    }

    // Clean up Launchpad pads visual classes
    for (let index = 0; index < LAUNCHPAD_PADS; index++) {
        const pad = getPadElement(index);
        if (pad) {
            pad.classList.remove('creator-pad-assigned', 'creator-pad-selected', 'active');
            delete pad.dataset.creatorLed;
            pad.style.removeProperty('--creator-led-color');
            pad.removeAttribute('aria-pressed');
            pad.removeAttribute('aria-label');
        }
    }

    // Restore performance page visuals, physical lights and original appearance
    syncPerformancePageButtons(currentPage);
    syncPerformanceModeButtons(currentMode);
    setCreatorView('pads');

    const bgFileInput = document.getElementById('creator-bg-file');
    if (bgFileInput) bgFileInput.value = '';
    const skinFileInput = document.getElementById('creator-skin-file');
    if (skinFileInput) skinFileInput.value = '';
    const iconFileInput = document.getElementById('creator-icon-file');
    if (iconFileInput) iconFileInput.value = '';

    import('./project.js').then(m => m.restoreProjectAppearance());
}

function markDraftModified() {
    if (!draft) return;
    draft.changeCount++;
}

function closeCreator() {
    requestCloseCreator();
}

export function openCreator() {
    if (editorActive) return;

    // Stop all audio playback from the performance session
    audioEngine.stopAllSounds();

    // Fresh new draft every session
    draft = createDraft();

    editorActive = true;
    activePageIndex = 0;
    activePadIndex = 0;
    pendingTextAnimation = null;

    setPadSource(creatorPadSource);

    const layout = document.querySelector('.layout');
    if (layout) {
        layout.classList.remove('sidebar-open');
    }

    setCreatorView('pads');
    setStudioSubMode('edit');
    renderEditor();
    previewDraftAppearance();
    updatePhysicalPageLights(activePageIndex);
}

function updateLiveToolbar() {
    const toolbar = document.getElementById('studio-live-toolbar');
    if (!toolbar) return;
    const isLive = (studioSubMode === 'live' && editorActive);
    toolbar.hidden = !isLive;
    if (isLive) {
        const titleEl = document.getElementById('studio-live-project-name');
        const pageEl = document.getElementById('studio-live-page-indicator');
        if (titleEl) {
            titleEl.textContent = draft?.name?.trim() || getTranslation('creator.untitledProject');
        }
        if (pageEl) {
            pageEl.textContent = `${activePageIndex + 1} / ${draft?.pages?.length || 1}`;
        }
    }
}

function setStudioSubMode(mode) {
    if (mode !== 'edit' && mode !== 'live') return;
    studioSubMode = mode;
    stopPreview();
    stopAllDraftPads();

    const editBtn = document.getElementById('studio-mode-edit');
    const liveBtn = document.getElementById('studio-mode-live');
    const banner = document.getElementById('studio-live-banner');
    const layout = document.querySelector('.layout');

    if (editBtn) {
        editBtn.classList.toggle('selected', mode === 'edit');
        editBtn.setAttribute('aria-selected', String(mode === 'edit'));
    }
    if (liveBtn) {
        liveBtn.classList.toggle('selected', mode === 'live');
        liveBtn.setAttribute('aria-selected', String(mode === 'live'));
    }
    if (banner) {
        banner.hidden = mode !== 'live';
    }
    if (layout) {
        layout.dataset.studio = mode;
    }

    updateLiveToolbar();

    if (mode === 'edit') {
        if (activePadIndex === null) {
            selectProjectPad(0, false);
        } else {
            renderPadGrid();
            renderSelectedPad();
        }
    } else {
        for (let i = 0; i < LAUNCHPAD_PADS; i++) {
            const pad = getPadElement(i);
            if (pad) pad.classList.remove('creator-pad-selected');
        }
    }
}

function selectProjectPad(index, preview = false) {
    if (!editorActive || !Number.isInteger(index) || index < 0 || index >= LAUNCHPAD_PADS) return false;
    if (activeCreatorView !== 'pads') {
        setCreatorView('pads');
    }
    if (activePadIndex === index && preview) {
        previewPad(index);
        return true;
    }

    activePadIndex = index;
    pendingTextAnimation = null;
    renderPadGrid();
    renderSelectedPad();
    if (preview) {
        previewPad(index);
    }
    return true;
}

function renderLightPresets() {
    const categoryContainer = document.getElementById('creator-light-categories');
    const presetContainer = document.getElementById('creator-light-presets');
    const search = document.getElementById('creator-light-search').value.trim().toLowerCase();
    const selectedLight = activePadIndex === null ? '' : getCurrentPage().lights[activePadIndex];

    // Check if category tabs need rebuilding
    if (categoryContainer.children.length === 0) {
        const categories = document.createDocumentFragment();
        LIGHT_CATEGORY_KEYS.forEach(category => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'creator-light-category';
            button.dataset.category = category;
            button.classList.toggle('selected', activeLightCategory === category);
            button.textContent = getTranslation(`creator.animationCategory.${category}`);
            button.addEventListener('click', () => {
                activeLightCategory = category;
                renderLightPresets();
            });
            categories.appendChild(button);
        });
        categoryContainer.replaceChildren(categories);
    } else {
        categoryContainer.querySelectorAll('.creator-light-category').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.category === activeLightCategory);
        });
    }

    // Optimization: if category and search have not changed and items are already rendered,
    // only update the .selected state on swatches instead of recreating ~1,700 DOM nodes!
    if (activeLightCategory === lastRenderedCategory && search === lastRenderedSearch && presetContainer.children.length > 0) {
        presetContainer.querySelectorAll('.creator-animation-swatch').forEach(button => {
            const isDynamic = button.dataset.isDynamic === 'true';
            const template = button.dataset.template;
            const color = button.dataset.color;
            const animationName = button.dataset.animation;
            const isSelected = isSwatchSelected(selectedLight, isDynamic, template, color, animationName);
            button.classList.toggle('selected', isSelected);
        });
        return;
    }

    lastRenderedCategory = activeLightCategory;
    lastRenderedSearch = search;

    const groups = getAnimationGroups().filter(group => {
        const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
        const matchesCategory = activeLightCategory === 'all' || group.category === activeLightCategory;
        const matchesSearch = !search || `${groupLabel} ${group.id} ${group.variants.map(variant => `${variant.color || ''} ${variant.sequence || ''}`).join(' ')}`
            .toLowerCase().includes(search);
        return matchesCategory && matchesSearch;
    });

    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
        const card = document.createElement('section');
        card.className = 'creator-animation-group';
        const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
        const heading = document.createElement('h4');
        heading.textContent = groupLabel;
        card.appendChild(heading);

        const variants = document.createElement('div');
        variants.className = 'creator-animation-variants';
        group.variants.forEach(variant => {
            const animationName = variant.animation || group.id;
            const isDynamic = !!group.dynamicTemplate;
            const isSelected = isSwatchSelected(
                selectedLight,
                isDynamic,
                group.dynamicTemplate,
                variant.color,
                animationName
            );

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'creator-animation-swatch';
            button.classList.toggle('selected', isSelected);
            button.dataset.isDynamic = String(isDynamic);
            if (isDynamic) {
                button.dataset.template = group.dynamicTemplate;
                button.dataset.color = variant.color;
            }
            button.dataset.animation = animationName;

            const colorLabel = variant.color
                ? getTranslation(`creator.led${variant.color[0].toUpperCase()}${variant.color.slice(1)}`)
                : variant.sequence
                    ? getTranslation(`creator.light.sequence.${variant.sequence}`)
                    : groupLabel;
            button.setAttribute('aria-label', `${groupLabel} ${colorLabel}`);
            button.title = `${groupLabel} · ${colorLabel}`;

            const swatch = document.createElement('span');
            swatch.className = 'creator-light-swatch';
            if (variant.sequence) {
                const sequenceColors = variant.sequence === 'red_to_green' ? ['red', 'green'] : ['green', 'red'];
                swatch.style.background = `linear-gradient(135deg, ${LIGHT_COLOR_SWATCHES[sequenceColors[0]]}, ${LIGHT_COLOR_SWATCHES[sequenceColors[1]]})`;
                swatch.style.setProperty('--preset-color', LIGHT_COLOR_SWATCHES[sequenceColors[0]]);
            } else {
                swatch.style.setProperty('--preset-color', variant.color ? LIGHT_COLOR_SWATCHES[variant.color] : '#59bfe8');
            }
            button.appendChild(swatch);
            button.addEventListener('click', () => {
                if (isDynamic) {
                    pendingTextAnimation = { template: group.dynamicTemplate, color: variant.color };
                    document.getElementById('creator-text-animation').hidden = false;
                    document.getElementById('creator-animation-text').focus();
                    renderLightPresets();
                    return;
                }
                assignLightAnimation(animationName);
            });
            variants.appendChild(button);
        });

        card.appendChild(variants);
        fragment.appendChild(card);
    });


    if (!groups.length) {
        const empty = document.createElement('p');
        empty.className = 'creator-animation-empty';
        empty.textContent = getTranslation('creator.noAnimations');
        fragment.appendChild(empty);
    }
    presetContainer.replaceChildren(fragment);
}

function assignTextAnimation() {
    if (activePadIndex === null || !pendingTextAnimation) return;
    const text = document.getElementById('creator-animation-text').value
        .replace(/[^a-z0-9 ]/gi, '')
        .trim()
        .replace(/\s+/g, ' ');
    if (!text) {
        showNotification(getTranslation('creator.errorAnimationText'), 'warning');
        return;
    }

    const animationName = pendingTextAnimation.template === 'text'
        ? `text_${text}_${pendingTextAnimation.color}`
        : `${pendingTextAnimation.template}_${text}_${pendingTextAnimation.color}`;
    pendingTextAnimation = null;
    document.getElementById('creator-animation-text').value = '';
    document.getElementById('creator-text-animation').hidden = true;
    assignLightAnimation(animationName);
}

function selectProjectPage(index, updateVisuals = true) {
    if (!editorActive || !Number.isInteger(index) || index < 0 || index >= draft.pages.length) return false;
    stopPreview();
    stopAllDraftPads();
    pendingTextAnimation = null;
    activePageIndex = index;
    if (studioSubMode === 'edit') {
        if (activePadIndex === null) {
            activePadIndex = 0;
        }
        renderEditor();
    } else {
        renderPadGrid();
        updateLiveToolbar();
    }
    if (updateVisuals) {
        updatePageButtonHighlight(activePageIndex);
        updatePhysicalPageLights(activePageIndex);
    }
    return true;
}

async function assignSample(file) {
    const targetIndex = activePadIndex;
    const targetPage = getCurrentPage();
    if (!file || targetIndex === null || !targetPage) return;

    stopPreview();
    const result = await assignPadSample(targetPage, targetIndex, file, (f) => audioEngine.decodeAudioFile(f));
    if (result === 'failed') {
        showNotification(getTranslation('creator.errorDecode'), 'error');
        renderPadGrid();
        renderSelectedPad();
        return;
    }
    if (result === 'superseded') {
        return;
    }

    markDraftModified();
    renderPadGrid();
    renderSelectedPad();
}

function chooseSample() {
    document.getElementById('creator-sample-file').click();
}

function startHoldPreview(index = activePadIndex) {
    if (index === null || !getCurrentPage()) return;
    stopPreview();
    const page = getCurrentPage();
    const buffer = page.soundBuffers[index];
    const animation = page.lights[index];
    const x = index % LAUNCHPAD_COLS;
    const y = Math.floor(index / LAUNCHPAD_COLS);

    if (buffer) {
        audioEngine.playBuffer(buffer, 'preview');
    }
    if (animation) {
        activeMomentaryPreview = { animation, x, y };
        triggerAnimation(animation, x, y);
    }
}

function previewPad(index = activePadIndex) {
    if (index === null || !getCurrentPage()) return;
    stopPreview();
    const page = getCurrentPage();
    const buffer = page.soundBuffers[index];
    const animation = page.lights[index];
    const x = index % LAUNCHPAD_COLS;
    const y = Math.floor(index / LAUNCHPAD_COLS);
    const manualDuration = getManualLightDuration(page, index);

    let duration = 0;
    if (buffer) {
        duration = audioEngine.playBuffer(buffer, 'preview');
    }

    if (animation) {
        const syncToSound = page.lightSyncToSound[index] ?? true;
        const animDuration = resolveLightDuration(
            syncToSound,
            duration,
            manualDuration
        );
        triggerAnimation(animation, x, y, animDuration);
    }
}

async function exportProject() {
    const exportButton = document.getElementById('creator-export');
    if (!draft) return false;
    if (exportButton) exportButton.disabled = true;

    try {
        const nameInput = document.getElementById('project-creator-name');
        if (nameInput) {
            draft.name = nameInput.value;
        }
        if (!draft.name || !draft.name.trim()) {
            showNotification(getTranslation('creator.errorName'), 'warning');
            return false;
        }

        const { blob, filename } = await exportProjectToZip(draft);

        // Download the self-contained .zip project file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        draft.savedChangeCount = draft.changeCount;
        showNotification(getTranslation('creator.exportSuccess'), 'success', 5000);
        return true;
    } catch (error) {
        console.error('[Creator] Export error:', error);
        showNotification(translate('creator.errorExport', { error: error.message }), 'error', 6000);
        return false;
    } finally {
        if (exportButton) exportButton.disabled = false;
    }
}

let activeImportId = 0;

async function handleProjectZipFile(file) {
    if (!file) return;

    if (isDraftDirty(draft)) {
        const confirmMsg = getTranslation('creator.confirmOverwriteDraft');
        if (!window.confirm(confirmMsg)) return;
    }

    showNotification(getTranslation('creator.importing'), 'info', 3000);
    const currentImportId = ++activeImportId;

    try {
        const { draft: importedDraft, missingAssets = [] } = await importProjectFromZip(file);

        if (currentImportId !== activeImportId || !editorActive) return;

        // Decode audio buffers for all imported samples using assignPadSample
        for (let pageIdx = 0; pageIdx < importedDraft.pages.length; pageIdx++) {
            const page = importedDraft.pages[pageIdx];
            for (let padIdx = 0; padIdx < LAUNCHPAD_PADS; padIdx++) {
                const sampleFile = page.samples[padIdx];
                if (sampleFile) {
                    await assignPadSample(page, padIdx, sampleFile, (f) => audioEngine.decodeAudioFile(f));
                    if (currentImportId !== activeImportId || !editorActive) return;
                }
            }
        }

        if (currentImportId !== activeImportId || !editorActive) return;

        stopPreview();
        stopAllDraftPads();

        draft = importedDraft;
        activePageIndex = 0;
        activePadIndex = 0;
        pendingTextAnimation = null;

        setStudioSubMode('edit');
        renderEditor();
        previewDraftAppearance();
        updatePhysicalPageLights(activePageIndex);
        showNotification(translate('creator.importSuccess', { name: draft.name }), 'success', 5000);
        if (missingAssets.length > 0) {
            showNotification(
                translate('creator.missingAssets', { count: missingAssets.length, files: missingAssets.join(', ') }),
                'warning',
                8000
            );
        }
    } catch (error) {
        if (currentImportId !== activeImportId || !editorActive) return;
        console.error('[Creator] Import error:', error);
        showNotification(translate('creator.errorImport', { error: error.message }), 'error', 6000);
    }
}

export function initializeProjectCreator() {
    if (initialized) return;
    initialized = true;

    if (!document.getElementById('project-inspector')) return;

    // Unsaved changes dialog actions
    document.getElementById('creator-unsaved-save')?.addEventListener('click', async () => {
        const ok = await exportProject();
        if (ok) {
            forceCloseCreator();
        }
    });

    document.getElementById('creator-unsaved-discard')?.addEventListener('click', () => {
        forceCloseCreator();
    });

    document.getElementById('creator-unsaved-cancel')?.addEventListener('click', () => {
        closeUnsavedDialog();
    });

    // Import project button and file input
    const importBtn = document.getElementById('creator-import-project');
    const zipInput = document.getElementById('creator-project-zip-input');

    importBtn?.addEventListener('click', () => {
        zipInput?.click();
    });

    zipInput?.addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (file) {
            handleProjectZipFile(file);
        }
        event.target.value = '';
    });

    // Drag and Drop project .zip files onto the inspector
    const inspectorEl = document.getElementById('project-inspector');
    if (inspectorEl) {
        ['dragenter', 'dragover'].forEach(eventName => {
            inspectorEl.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        inspectorEl.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer?.files?.[0];
            if (file && (file.name.endsWith('.zip') || file.type.includes('zip'))) {
                handleProjectZipFile(file);
            }
        });
    }

    // Studio sub-mode buttons
    document.getElementById('studio-mode-edit')?.addEventListener('click', () => {
        setStudioSubMode('edit');
    });
    document.getElementById('studio-mode-live')?.addEventListener('click', () => {
        setStudioSubMode('live');
    });

    document.getElementById('studio-exit-live')?.addEventListener('click', () => {
        setStudioSubMode('edit');
    });

    document.getElementById('creator-close').addEventListener('click', closeCreator);
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && editorActive) {
            if (studioSubMode === 'live') {
                setStudioSubMode('edit');
            } else {
                closeCreator();
            }
        }
    });

    document.getElementById('project-creator-name').addEventListener('input', event => {
        if (draft) {
            draft.name = event.target.value;
            markDraftModified();
            updateLiveToolbar();
        }
    });

    document.getElementById('creator-add-page').addEventListener('click', () => {
        if (!draft || draft.pages.length >= MAX_PROJECT_PAGES) return;
        draft.pages.push(createProjectPage(draft.pages.length + 1));
        markDraftModified();
        selectProjectPage(draft.pages.length - 1);
    });

    document.getElementById('creator-remove-page').addEventListener('click', () => {
        if (!draft || draft.pages.length <= 1) return;
        draft.pages.splice(activePageIndex, 1);
        markDraftModified();
        activePageIndex = Math.max(0, activePageIndex - 1);
        selectProjectPage(activePageIndex);
    });

    document.getElementById('creator-import-sound').addEventListener('click', chooseSample);
    document.getElementById('creator-sample-file').addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        assignSample(file);
        event.target.value = '';
    });

    const previewBtn = document.getElementById('creator-preview-pad');
    previewBtn.addEventListener('pointerdown', (e) => {
        if (previewBtn.disabled || e.button !== 0) return;
        const page = getCurrentPage();
        const animation = page?.lights[activePadIndex];
        if (animation && animations[animation]?.type === 'momentary') {
            e.preventDefault();
            startHoldPreview(activePadIndex);
        }
    });

    const handleHoldRelease = () => {
        if (activeMomentaryPreview) {
            stopPreview();
        }
    };

    previewBtn.addEventListener('pointerup', handleHoldRelease);
    previewBtn.addEventListener('pointerleave', handleHoldRelease);
    previewBtn.addEventListener('pointercancel', handleHoldRelease);

    previewBtn.addEventListener('click', () => {
        const page = getCurrentPage();
        const animation = page?.lights[activePadIndex];
        if (animation && animations[animation]?.type === 'momentary') {
            return;
        }
        previewPad(activePadIndex);
    });

    previewBtn.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            const page = getCurrentPage();
            const animation = page?.lights[activePadIndex];
            if (animation && animations[animation]?.type === 'momentary') {
                e.preventDefault();
                startHoldPreview(activePadIndex);
            }
        }
    });

    previewBtn.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            handleHoldRelease();
        }
    });

    document.getElementById('creator-remove-sample').addEventListener('click', () => {
        if (activePadIndex === null || !getCurrentPage()) return;
        stopPreview();
        removePadSample(getCurrentPage(), activePadIndex);
        markDraftModified();
        renderPadGrid();
        renderSelectedPad();
    });

    document.getElementById('creator-remove-light').addEventListener('click', () => {
        if (activePadIndex === null) return;
        stopPreview();
        getCurrentPage().lights[activePadIndex] = '';
        markDraftModified();
        renderPadGrid();
        renderSelectedPad();
    });

    document.getElementById('creator-light-sync').addEventListener('change', event => {
        if (activePadIndex === null) return;
        const page = getCurrentPage();
        if (page) {
            page.lightSyncToSound[activePadIndex] = event.target.checked;
            markDraftModified();
        }
        renderSelectedPad();
    });

    const durationInput = document.getElementById('creator-light-duration');
    durationInput.addEventListener('input', event => {
        if (activePadIndex === null) return;
        const page = getCurrentPage();
        if (!page) return;
        const value = Number.parseFloat(event.target.value);
        if (Number.isFinite(value) && value >= MIN_LIGHT_DURATION_SEC && value <= MAX_LIGHT_DURATION_SEC) {
            page.lightDurations[activePadIndex] = Math.round(value * 10) / 10;
            markDraftModified();
        }
    });
    durationInput.addEventListener('change', () => {
        if (activePadIndex === null) return;
        const page = getCurrentPage();
        if (!page) return;
        const value = Number.parseFloat(durationInput.value);
        if (Number.isFinite(value) && value >= MIN_LIGHT_DURATION_SEC && value <= MAX_LIGHT_DURATION_SEC) {
            page.lightDurations[activePadIndex] = Math.round(value * 10) / 10;
            markDraftModified();
        } else {
            durationInput.value = String(getManualLightDuration(page, activePadIndex));
        }
    });

    document.getElementById('creator-light-search').addEventListener('input', renderLightPresets);
    document.getElementById('creator-assign-text-animation').addEventListener('click', assignTextAnimation);

    document.getElementById('creator-export').addEventListener('click', exportProject);

    // Editor section tabs (Pads vs Theme)
    document.getElementById('creator-tab-pads')?.addEventListener('click', () => {
        setCreatorView('pads');
    });
    document.getElementById('creator-tab-theme')?.addEventListener('click', () => {
        setCreatorView('theme');
    });

    // Theme assets (background, skin, icon) share the same wiring: an optional
    // <select> of bundled options plus a custom file upload. Each change updates
    // only the aspect it belongs to before re-rendering the theme view.
    const commitThemeChange = (preview) => {
        markDraftModified();
        preview();
        renderThemeView();
    };

    const bindThemeAsset = ({ selectId = null, triggerId, fileId, pathKey, fileKey, preview }) => {
        const select = selectId ? document.getElementById(selectId) : null;
        if (select) {
            select.addEventListener('change', (e) => {
                if (!draft || e.target.value === 'custom') return;
                draft[fileKey] = null;
                draft[pathKey] = e.target.value;
                commitThemeChange(preview);
            });
        }

        const fileInput = document.getElementById(fileId);
        document.getElementById(triggerId)?.addEventListener('click', () => {
            if (fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file || !draft) return;
            draft[fileKey] = file;
            draft[pathKey] = file.name;
            commitThemeChange(preview);
        });
    };

    bindThemeAsset({
        selectId: 'creator-bg-select',
        triggerId: 'creator-upload-bg-trigger',
        fileId: 'creator-bg-file',
        pathKey: 'backgroundMedia',
        fileKey: 'customBackgroundFile',
        preview: previewDraftBackground
    });

    bindThemeAsset({
        selectId: 'creator-skin-select',
        triggerId: 'creator-upload-skin-trigger',
        fileId: 'creator-skin-file',
        pathKey: 'coverImage',
        fileKey: 'customCoverFile',
        preview: previewDraftSkin
    });

    bindThemeAsset({
        triggerId: 'creator-upload-icon-trigger',
        fileId: 'creator-icon-file',
        pathKey: 'iconImage',
        fileKey: 'customIconFile',
        preview: previewDraftIcon
    });

    document.getElementById('creator-reset-icon-trigger')?.addEventListener('click', () => {
        if (!draft) return;
        draft.customIconFile = null;
        draft.iconImage = '';
        commitThemeChange(previewDraftIcon);
    });

    // Theme: Visualizer
    const vizMode = document.getElementById('creator-viz-mode');
    if (vizMode) {
        vizMode.addEventListener('change', (e) => {
            if (!draft) return;
            draft.visualizerMode = e.target.value;
            markDraftModified();
            previewDraftVisualizer();
            renderThemeView();
        });
    }

    const vizColor1 = document.getElementById('creator-viz-color1');
    if (vizColor1) {
        vizColor1.addEventListener('input', (e) => {
            if (!draft) return;
            draft.visualizerColor1 = e.target.value;
            markDraftModified();
            previewDraftVisualizer();
        });
    }

    const vizGradient = document.getElementById('creator-viz-gradient');
    if (vizGradient) {
        vizGradient.addEventListener('change', (e) => {
            if (!draft) return;
            draft.visualizerGradient = e.target.checked;
            markDraftModified();
            previewDraftVisualizer();
            renderThemeView();
        });
    }

    const vizColor2 = document.getElementById('creator-viz-color2');
    if (vizColor2) {
        vizColor2.addEventListener('input', (e) => {
            if (!draft) return;
            draft.visualizerColor2 = e.target.value;
            markDraftModified();
            previewDraftVisualizer();
        });
    }

    const vizDirection = document.getElementById('creator-viz-direction');
    if (vizDirection) {
        vizDirection.addEventListener('change', (e) => {
            if (!draft) return;
            draft.visualizerGradientDirection = e.target.value;
            markDraftModified();
            previewDraftVisualizer();
        });
    }

    syncInputSlider('creator-rotation-slider', 'creator-rotation-input', (angle) => {
        if (!draft) return;
        draft.launchpadRotation = angle;
        markDraftModified();
        previewDraftLayout();
    }, LAUNCHPAD_ROTATION_MIN, LAUNCHPAD_ROTATION_MAX);

    syncInputSlider('creator-size-slider', 'creator-size-input', (size) => {
        if (!draft) return;
        draft.launchpadSize = size;
        markDraftModified();
        previewDraftLayout();
    }, LAUNCHPAD_SIZE_MIN, LAUNCHPAD_SIZE_MAX);

    window.addEventListener('launchpad-view-changed', () => {
        if (editorActive && draft) {
            renderEditor();
            updatePhysicalPageLights(activePageIndex);
        }
    });
}

function getAnimationColor(animationName) {
    const color = ANIMATION_COLORS.find(name => animationName.endsWith(`_${name}`));
    return color ? LIGHT_COLOR_SWATCHES[color] : '#59bfe8';
}

function previewAnimation(animationName, index) {
    const page = getCurrentPage();
    const duration = page ? getManualLightDuration(page, index) : DEFAULT_LIGHT_DURATION_SEC;
    const x = index % LAUNCHPAD_COLS;
    const y = Math.floor(index / LAUNCHPAD_COLS);
    triggerAnimation(animationName, x, y, duration);
    if (animations[animationName]?.type === 'momentary') {
        window.setTimeout(() => releaseAnimation(animationName, x, y), 900);
    }
}

function assignLightAnimation(animationName) {
    if (activePadIndex === null) return;
    pendingTextAnimation = null;
    document.getElementById('creator-text-animation').hidden = true;
    getCurrentPage().lights[activePadIndex] = animationName;
    markDraftModified();
    renderPadGrid();
    renderSelectedPad();
    if (animationName) previewAnimation(animationName, activePadIndex);
}