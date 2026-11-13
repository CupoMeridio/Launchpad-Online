import { getLaunchpadRotation, getLaunchpadSize } from './ui.js';
import { getTranslation, translate } from './i18n.js';
import { showNotification } from './notifications.js';
import { syncInputSlider } from './formControls.js';
import {
    buildAnimationCatalog,
    filterCatalogByDevice,
    resolveLightColors,
    getPadSteps,
    draftStepToPadStep,
    assignSampleGuarded,
    assignPadStepSample
} from './projectCreatorModel.js';
import { creatorSession } from './projectCreatorState.js';
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
import {
    setPadSource,
    getPadStepCursor,
    resetPadStepCounters,
    updatePhysicalPageLights,
    syncPerformancePageButtons,
    syncPerformanceModeButtons
} from './interaction.js';
import { getStaticCatalog } from './staticCatalog.js';
import { restoreProjectAppearance } from './project.js';
import { checkProjectDeviceConsistency } from './projectValidator.js';
import { getActiveDeviceProfile } from './physicalInterface.js';
import { registerListener } from './eventCleanup.js';
import { 
    LAUNCHPAD_COLS, 
    LAUNCHPAD_PADS, 
    MAX_PROJECT_PAGES, 
    MAX_PAD_STEPS,
    MIN_LIGHT_DURATION_SEC, 
    MAX_LIGHT_DURATION_SEC, 
    DEFAULT_LIGHT_DURATION_SEC,
    ANIMATION_COLORS,
    ANIMATION_COLOR_TIERS,
    DEFAULT_ANIMATION_SWATCH_COLOR,
    DEFAULT_TARGET_DEVICE,
    getColorFromAnimationName,
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX
} from './constants.js';

// Swatch previews derive from the shared palette so the two can never drift apart.
const LIGHT_COLOR_SWATCHES = Object.fromEntries(
    ANIMATION_COLORS.map(color => [color, webColorMap[color].baseColor])
);

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
let allAnimationGroups = null;

// Swatch rendering caches to avoid recreating ~2900 DOM nodes on non-structural updates
let lastRenderedCategory = null;
let lastRenderedSearch = null;
let lastRenderedTargetDevice = null;

const creatorPadSource = {
    getPadPlayback: (index) => creatorSession.getPadPlayback(index, getPadStepCursor),
    onPadPress: (index) => {
        if (creatorSession.getStudioSubMode() === 'edit') {
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
            variants: ANIMATION_COLORS.map(color => ({ animation: null, color, tier: ANIMATION_COLOR_TIERS[color], supportsDuration: true }))
        }));
        allAnimationGroups = [...animationGroups, ...dynamicTextGroups];
    }
    return allAnimationGroups;
}

function getCurrentPage() {
    return creatorSession.getCurrentPage();
}

function getManualLightDuration(page, padIndex, stepIndex) {
    const steps = getPadSteps(page, padIndex);
    const step = steps[stepIndex] || steps[0];
    return step?.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC;
}

function isSwatchSelected(selectedLight, isDynamic, template, color, animationName) {
    const pendingTextAnimation = creatorSession.getPendingTextAnimation();
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
    const momentary = creatorSession.getActiveMomentaryPreview();
    if (momentary) {
        releaseAnimation(momentary.animation, momentary.x, momentary.y);
        creatorSession.setActiveMomentaryPreview(null);
    }
}

function renderPageTabs() {
    const draft = creatorSession.getDraft();
    if (!draft) return;
    const tabs = document.getElementById('creator-page-tabs');
    if (!tabs) return;
    tabs.replaceChildren();

    const activePageIndex = creatorSession.getActivePageIndex();
    draft.pages.forEach((_page, index) => {
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

    const addBtn = document.getElementById('creator-add-page');
    if (addBtn) addBtn.disabled = draft.pages.length >= MAX_PROJECT_PAGES;
    const removeBtn = document.getElementById('creator-remove-page');
    if (removeBtn) removeBtn.disabled = draft.pages.length <= 1;
}

function renderPadGrid() {
    const page = getCurrentPage();
    if (!page) return;

    const activePadIndex = creatorSession.getActivePadIndex();
    for (let index = 0; index < LAUNCHPAD_PADS; index++) {
        const pad = getPadElement(index);
        if (!pad) continue;

        const steps = getPadSteps(page, index);
        const hasContent = steps.some(st => st.sample || st.light);
        const step0 = steps[0] || {};
        const sample = step0.sample;
        const led = step0.light || '';

        pad.classList.toggle('creator-pad-assigned', hasContent);
        pad.classList.toggle('creator-pad-selected', index === activePadIndex);
        pad.setAttribute('aria-pressed', String(index === activePadIndex));

        if (steps.length > 1) {
            pad.dataset.steps = String(steps.length);
        } else {
            delete pad.dataset.steps;
        }

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

function updateTargetDeviceWarnings() {
    const warningEl = document.getElementById('creator-target-warning');
    const draft = creatorSession.getDraft();
    if (!warningEl || !draft) return;
    const messages = [];
    const { rgbLightCount } = checkProjectDeviceConsistency(draft);
    if (rgbLightCount > 0) {
        messages.push(translate('creator.warning.legacyWithRgb', { count: rgbLightCount }));
    }
    const connectedProfile = getActiveDeviceProfile();
    if (connectedProfile) {
        const connectedType = connectedProfile.type;
        const target = draft.targetDevice || DEFAULT_TARGET_DEVICE;
        if (target === 'legacy' && connectedType === 'rgb') {
            messages.push(translate('creator.warning.hardwareMismatch', { connected: 'RGB', target: 'Legacy' }));
        } else if (target === 'rgb' && connectedType === 'legacy') {
            messages.push(translate('creator.warning.hardwareMismatch', { connected: 'Legacy', target: 'RGB' }));
        }
    }
    if (messages.length > 0) {
        warningEl.hidden = false;
        warningEl.textContent = messages.join(' ');
    } else {
        warningEl.hidden = true;
        warningEl.textContent = '';
    }
}

function updateInspectorProjectHeader(draft, page) {
    let sampleCount = 0;
    if (page) {
        for (let i = 0; i < LAUNCHPAD_PADS; i++) {
            const padSteps = getPadSteps(page, i);
            if (padSteps.some(st => st.sample)) {
                sampleCount++;
            }
        }
    }
    const nameInput = document.getElementById('project-creator-name');
    if (nameInput) nameInput.value = draft.name;
    const targetDeviceEl = document.getElementById('creator-target-device');
    if (targetDeviceEl) targetDeviceEl.value = draft.targetDevice || DEFAULT_TARGET_DEVICE;
    const pageCountEl = document.getElementById('creator-page-count');
    if (pageCountEl) pageCountEl.textContent = `${creatorSession.getActivePageIndex() + 1} / ${draft.pages.length}`;
    const sampleCountEl = document.getElementById('creator-sample-count');
    if (sampleCountEl) sampleCountEl.textContent = translate('creator.sampleCount', { count: sampleCount });
}

function renderStepPills(steps, activeStepIndex) {
    const stepIndicator = document.getElementById('creator-step-indicator');
    const stepPillsContainer = document.getElementById('creator-step-pills');
    const addStepBtn = document.getElementById('creator-add-step');
    const removeStepBtn = document.getElementById('creator-remove-step');

    if (stepIndicator) {
        stepIndicator.textContent = translate('creator.stepIndicator', {
            step: activeStepIndex + 1,
            total: steps.length
        });
    }

    if (addStepBtn) {
        addStepBtn.disabled = steps.length >= MAX_PAD_STEPS;
    }
    if (removeStepBtn) {
        removeStepBtn.disabled = steps.length <= 1;
    }

    if (stepPillsContainer) {
        stepPillsContainer.replaceChildren(
            ...steps.map((_st, idx) => {
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'creator-step-pill';
                pill.classList.toggle('selected', idx === activeStepIndex);
                pill.dataset.step = String(idx);
                pill.textContent = String(idx + 1);
                pill.setAttribute('role', 'tab');
                pill.setAttribute('aria-selected', String(idx === activeStepIndex));
                pill.addEventListener('click', () => {
                    creatorSession.setActiveStepIndex(idx);
                    renderSelectedPad();
                });
                return pill;
            })
        );
    }
}

function renderPadSampleControls(sample, animation, isMomentary) {
    const activePadIndex = creatorSession.getActivePadIndex();
    const selPadEl = document.getElementById('creator-selected-pad');
    if (selPadEl) selPadEl.textContent = translate('creator.pad', { pad: activePadIndex + 1 });
    const sampleNameEl = document.getElementById('creator-sample-name');
    if (sampleNameEl) {
        sampleNameEl.textContent = sample
            ? translate('creator.sampleAssigned', { file: sample.name })
            : getTranslation('creator.sampleEmpty');
    }

    const previewBtn = document.getElementById('creator-preview-pad');
    if (previewBtn) {
        previewBtn.disabled = !sample && !animation;
        if (isMomentary) {
            previewBtn.textContent = translate('creator.playPadHold');
            previewBtn.title = translate('creator.playPadHoldHint');
        } else {
            previewBtn.textContent = getTranslation('creator.playPad');
            previewBtn.removeAttribute('title');
        }
    }
    const holdHintEl = document.getElementById('creator-hold-hint');
    if (holdHintEl) holdHintEl.hidden = !isMomentary;

    const removeSampleBtn = document.getElementById('creator-remove-sample');
    if (removeSampleBtn) removeSampleBtn.disabled = !sample;
}

function renderPadLightControls(currentStep, sample, animation, isMomentary) {
    const assignedCard = document.getElementById('creator-assigned-light');
    const assignedSwatch = document.getElementById('creator-assigned-swatch');
    const assignedName = document.getElementById('creator-assigned-name');
    const removeLightBtn = document.getElementById('creator-remove-light');
    const timingSection = document.getElementById('creator-light-timing');
    const syncCheckbox = document.getElementById('creator-light-sync');

    if (animation) {
        if (assignedCard) assignedCard.hidden = false;
        if (assignedName) assignedName.textContent = getAnimationDisplayName(animation);
        if (assignedSwatch) {
            const swatchColors = getAnimationSwatchColors(animation);
            assignedSwatch.style.background = swatchColors.length > 1
                ? getAnimationSwatchGradient(swatchColors)
                : getAnimationColor(animation);
        }
        if (removeLightBtn) removeLightBtn.disabled = false;

        if (isMomentary) {
            if (timingSection) timingSection.hidden = true;
        } else {
            if (timingSection) timingSection.hidden = false;
            const manualDurationInput = document.getElementById('creator-light-duration');
            const manualDurationContainer = document.getElementById('creator-manual-light-duration');

            const isSync = currentStep.lightSyncToSound ?? true;
            if (syncCheckbox) {
                syncCheckbox.checked = isSync;
                syncCheckbox.disabled = !sample;
            }

            const durationVal = currentStep.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC;
            if (manualDurationInput) manualDurationInput.value = durationVal;
            if (manualDurationContainer) manualDurationContainer.hidden = Boolean(sample && syncCheckbox?.checked);
        }
    } else {
        if (assignedCard) assignedCard.hidden = true;
        if (removeLightBtn) removeLightBtn.disabled = true;
        if (timingSection) timingSection.hidden = true;
    }
}

function renderSelectedPad() {
    const draft = creatorSession.getDraft();
    const page = getCurrentPage();
    const padInspector = document.getElementById('creator-pad-inspector');
    if (!draft || !padInspector) return;

    updateInspectorProjectHeader(draft, page);

    const activePadIndex = creatorSession.getActivePadIndex();
    padInspector.hidden = activePadIndex === null;
    const textAnimEl = document.getElementById('creator-text-animation');
    if (textAnimEl) textAnimEl.hidden = !creatorSession.getPendingTextAnimation();
    if (activePadIndex === null || !page) return;

    const steps = getPadSteps(page, activePadIndex);
    let activeStepIndex = creatorSession.getActiveStepIndex();
    if (activeStepIndex >= steps.length) {
        activeStepIndex = Math.max(0, steps.length - 1);
        creatorSession.setActiveStepIndex(activeStepIndex);
    }
    const currentStep = steps[activeStepIndex] || steps[0] || {};
    const sample = currentStep.sample || null;
    const animation = currentStep.light || '';
    const isMomentary = !!(animation && animations[animation]?.type === 'momentary');

    renderStepPills(steps, activeStepIndex);
    renderPadSampleControls(sample, animation, isMomentary);
    renderPadLightControls(currentStep, sample, animation, isMomentary);

    renderLightPresets();
}

function ensureThemeSelectOptions() {
    const bgSelect = document.getElementById('creator-bg-select');
    const skinSelect = document.getElementById('creator-skin-select');
    if (!bgSelect || !skinSelect) return;

    if (bgSelect.options.length <= 1) {
        const data = getStaticCatalog();
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
    if (!creatorSession.setCreatorView(view)) return;
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
    return normalizeAppearance(creatorSession.getDraft() || {});
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
function previewDraftAppearance() {
    if (!creatorSession.getDraft() || !creatorSession.isEditorActive()) return;
    applyAppearance(getDraftAppearance());
}

function renderThemeView() {
    ensureThemeSelectOptions();
    const draft = creatorSession.getDraft();
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

    const viz = draft.visualizer;
    if (vizMode) vizMode.value = viz.mode;
    if (vizColors) vizColors.hidden = viz.mode === 'off';
    if (vizColor1) vizColor1.value = viz.color1;
    if (vizGradient) vizGradient.checked = viz.gradient;
    if (vizGradientSettings) vizGradientSettings.hidden = !viz.gradient;
    if (vizColor2) vizColor2.value = viz.color2;
    if (vizDirection) vizDirection.value = viz.gradientDirection;

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
    updateTargetDeviceWarnings();
}

function requestCloseCreator() {
    if (!creatorSession.isEditorActive()) return;
    if (!creatorSession.isDirty()) {
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
    creatorSession.close();
    stopPreview();
    stopAllDraftPads();
    setPadSource(null);
    resetPadStepCounters();

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
            delete pad.dataset.steps;
            pad.style.removeProperty('--creator-led-color');
            pad.removeAttribute('aria-pressed');
            pad.removeAttribute('aria-label');
        }
    }

    // Restore performance page visuals, physical lights and original appearance
    syncPerformancePageButtons();
    syncPerformanceModeButtons();
    setCreatorView('pads');

    const bgFileInput = document.getElementById('creator-bg-file');
    if (bgFileInput) bgFileInput.value = '';
    const skinFileInput = document.getElementById('creator-skin-file');
    if (skinFileInput) skinFileInput.value = '';
    const iconFileInput = document.getElementById('creator-icon-file');
    if (iconFileInput) iconFileInput.value = '';

    restoreProjectAppearance();
}

function closeCreator() {
    requestCloseCreator();
}

export function openCreator() {
    if (creatorSession.isEditorActive()) return;

    // Stop all audio playback from the performance session
    audioEngine.stopAllSounds();

    // Fresh new session
    creatorSession.open();
    resetPadStepCounters();

    setPadSource(creatorPadSource);

    const layout = document.querySelector('.layout');
    if (layout) {
        layout.classList.remove('sidebar-open');
    }

    setCreatorView('pads');
    setStudioSubMode('edit');
    renderEditor();
    previewDraftAppearance();
    updatePhysicalPageLights(creatorSession.getActivePageIndex());
}

function updateLiveToolbar() {
    const toolbar = document.getElementById('studio-live-toolbar');
    if (!toolbar) return;
    const isLive = (creatorSession.getStudioSubMode() === 'live' && creatorSession.isEditorActive());
    toolbar.hidden = !isLive;
    if (isLive) {
        const titleEl = document.getElementById('studio-live-project-name');
        const pageEl = document.getElementById('studio-live-page-indicator');
        const draft = creatorSession.getDraft();
        if (titleEl) {
            titleEl.textContent = draft?.name?.trim() || getTranslation('creator.untitledProject');
        }
        if (pageEl) {
            pageEl.textContent = `${creatorSession.getActivePageIndex() + 1} / ${draft?.pages?.length || 1}`;
        }
    }
}

function setStudioSubMode(mode) {
    if (!creatorSession.setStudioSubMode(mode)) return;
    resetPadStepCounters();
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
        if (creatorSession.getActivePadIndex() === null) {
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
    if (!creatorSession.isEditorActive() || !Number.isInteger(index) || index < 0 || index >= LAUNCHPAD_PADS) return false;
    if (creatorSession.getActiveCreatorView() !== 'pads') {
        setCreatorView('pads');
    }
    if (creatorSession.getActivePadIndex() === index && preview) {
        previewPad(index);
        return true;
    }

    creatorSession.setActivePadIndex(index);
    renderPadGrid();
    renderSelectedPad();
    if (preview) {
        previewPad(index);
    }
    return true;
}

function renderLightCategoryTabs(categoryContainer, activeLightCategory) {
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
                creatorSession.setActiveLightCategory(category);
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
}

function renderAnimationVariantSwatch(variant, group, groupLabel, selectedLight) {
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
    if (variant.tier === 'rgb') {
        button.classList.add('is-rgb');
    }
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
    const tierBadge = variant.tier === 'rgb' ? ` (${getTranslation('creator.targetDevice.badgeRgb')})` : '';
    button.setAttribute('aria-label', `${groupLabel} ${colorLabel}${tierBadge}`);
    button.title = `${groupLabel} · ${colorLabel}${tierBadge}`;

    const swatch = document.createElement('span');
    swatch.className = 'creator-light-swatch';
    const swatchColors = variant.swatchColors ?? resolveLightColors(variant);
    if (swatchColors.length > 1) {
        swatch.style.background = getAnimationSwatchGradient(swatchColors);
    }
    swatch.style.setProperty('--preset-color', swatchColors.length
        ? LIGHT_COLOR_SWATCHES[swatchColors[0]]
        : DEFAULT_ANIMATION_SWATCH_COLOR);
    button.appendChild(swatch);
    button.addEventListener('click', () => {
        if (isDynamic) {
            creatorSession.setPendingTextAnimation({ template: group.dynamicTemplate, color: variant.color });
            const textAnimBox = document.getElementById('creator-text-animation');
            if (textAnimBox) textAnimBox.hidden = false;
            const textInput = document.getElementById('creator-animation-text');
            if (textInput) textInput.focus();
            renderLightPresets();
            return;
        }
        assignLightAnimation(animationName);
    });
    return button;
}

function renderAnimationGroupCard(group, selectedLight) {
    const card = document.createElement('section');
    card.className = 'creator-animation-group';
    const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
    const heading = document.createElement('h4');
    heading.textContent = groupLabel;
    card.appendChild(heading);

    const variants = document.createElement('div');
    variants.className = 'creator-animation-variants';
    group.variants.forEach(variant => {
        variants.appendChild(renderAnimationVariantSwatch(variant, group, groupLabel, selectedLight));
    });

    card.appendChild(variants);
    return card;
}

function renderLightPresets() {
    const categoryContainer = document.getElementById('creator-light-categories');
    const presetContainer = document.getElementById('creator-light-presets');
    const searchInput = document.getElementById('creator-light-search');
    if (!categoryContainer || !presetContainer) return;

    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const activePadIndex = creatorSession.getActivePadIndex();
    const activeStepIndex = creatorSession.getActiveStepIndex();
    const currentPage = getCurrentPage();
    const selectedLight = activePadIndex === null || !currentPage
        ? ''
        : (getPadSteps(currentPage, activePadIndex)[activeStepIndex]?.light || '');

    const activeLightCategory = creatorSession.getActiveLightCategory();
    renderLightCategoryTabs(categoryContainer, activeLightCategory);

    const draft = creatorSession.getDraft();
    const targetDevice = draft?.targetDevice || DEFAULT_TARGET_DEVICE;

    if (activeLightCategory === lastRenderedCategory && search === lastRenderedSearch && targetDevice === lastRenderedTargetDevice && presetContainer.children.length > 0) {
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
    lastRenderedTargetDevice = targetDevice;

    const groups = filterCatalogByDevice(getAnimationGroups(), targetDevice)
        .filter(group => {
            const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
            const matchesCategory = activeLightCategory === 'all' || group.category === activeLightCategory;
            const matchesSearch = !search || `${groupLabel} ${group.id} ${group.variants.map(variant => `${variant.color || ''} ${variant.sequence || ''}`).join(' ')}`
                .toLowerCase().includes(search);
            return matchesCategory && matchesSearch;
        });

    const fragment = document.createDocumentFragment();
    groups.forEach(group => {
        fragment.appendChild(renderAnimationGroupCard(group, selectedLight));
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
    const padIndex = creatorSession.getActivePadIndex();
    const pendingText = creatorSession.getPendingTextAnimation();
    if (padIndex === null || !pendingText) return;
    const textInput = document.getElementById('creator-animation-text');
    const text = textInput ? textInput.value.replace(/[^a-z0-9 ]/gi, '').trim().replace(/\s+/g, ' ') : '';
    if (!text) {
        showNotification(getTranslation('creator.errorAnimationText'), 'warning');
        return;
    }

    const animationName = pendingText.template === 'text'
        ? `text_${text}_${pendingText.color}`
        : `${pendingText.template}_${text}_${pendingText.color}`;
    creatorSession.setPendingTextAnimation(null);
    if (textInput) textInput.value = '';
    const textAnimBox = document.getElementById('creator-text-animation');
    if (textAnimBox) textAnimBox.hidden = true;
    assignLightAnimation(animationName);
}

function selectProjectPage(index, updateVisuals = true) {
    if (!creatorSession.setActivePageIndex(index)) return false;
    stopPreview();
    stopAllDraftPads();
    if (creatorSession.getStudioSubMode() === 'edit') {
        if (creatorSession.getActivePadIndex() === null) {
            creatorSession.setActivePadIndex(0);
        }
        renderEditor();
    } else {
        renderPadGrid();
        updateLiveToolbar();
    }
    if (updateVisuals) {
        const activePage = creatorSession.getActivePageIndex();
        updatePageButtonHighlight(activePage);
        updatePhysicalPageLights(activePage);
    }
    return true;
}

async function assignSample(file) {
    const targetIndex = creatorSession.getActivePadIndex();
    const targetStepIndex = creatorSession.getActiveStepIndex();
    const targetPage = getCurrentPage();
    const targetDraft = creatorSession.getDraft();
    if (!file || targetIndex === null || !targetPage) return;

    stopPreview();
    const result = await assignSampleGuarded(
        targetDraft,
        targetPage,
        targetIndex,
        targetStepIndex,
        file,
        (f) => audioEngine.decodeAudioFile(f),
        () => creatorSession.getDraft()
    );

    if (result === 'failed') {
        showNotification(getTranslation('creator.errorDecode'), 'error');
        renderPadGrid();
        renderSelectedPad();
        return;
    }
    // 'superseded' / 'stale': never mutate or re-render a different draft.
    if (result !== 'assigned') {
        return;
    }

    creatorSession.markModified();
    renderPadGrid();
    renderSelectedPad();
}

function chooseSample() {
    const fileInput = document.getElementById('creator-sample-file');
    if (fileInput) fileInput.click();
}

function getPadPreviewContext(index = creatorSession.getActivePadIndex()) {
    const page = getCurrentPage();
    if (index === null || !page) return null;
    stopPreview();
    const steps = getPadSteps(page, index);
    const activePad = creatorSession.getActivePadIndex();
    const activeStep = creatorSession.getActiveStepIndex();
    const stepIdx = (index === activePad) ? activeStep : 0;
    const step = draftStepToPadStep(steps[stepIdx] || steps[0]);
    return {
        page,
        buffer: step.buffer,
        animation: step.light || '',
        syncToSound: step.syncToSound,
        manualDuration: step.duration,
        x: index % LAUNCHPAD_COLS,
        y: Math.floor(index / LAUNCHPAD_COLS)
    };
}

function startHoldPreview(index = creatorSession.getActivePadIndex()) {
    const ctx = getPadPreviewContext(index);
    if (!ctx) return;

    if (ctx.buffer) {
        audioEngine.playBuffer(ctx.buffer, 'preview');
    }
    if (ctx.animation) {
        creatorSession.setActiveMomentaryPreview({ animation: ctx.animation, x: ctx.x, y: ctx.y });
        triggerAnimation(ctx.animation, ctx.x, ctx.y);
    }
}

function previewPad(index = creatorSession.getActivePadIndex()) {
    const ctx = getPadPreviewContext(index);
    if (!ctx) return;

    let duration = 0;
    if (ctx.buffer) {
        duration = audioEngine.playBuffer(ctx.buffer, 'preview');
    }

    if (ctx.animation) {
        const animDuration = resolveLightDuration(
            ctx.syncToSound,
            duration,
            ctx.manualDuration
        );
        triggerAnimation(ctx.animation, ctx.x, ctx.y, animDuration);
    }
}

async function exportProject() {
    const exportButton = document.getElementById('creator-export');
    const draft = creatorSession.getDraft();
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

        creatorSession.markSaved();
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

async function handleProjectZipFile(file) {
    if (!file) return;

    if (creatorSession.isDirty()) {
        const confirmMsg = getTranslation('creator.confirmOverwriteDraft');
        if (!window.confirm(confirmMsg)) return;
    }

    showNotification(getTranslation('creator.importing'), 'info', 3000);
    const currentImportId = creatorSession.nextImportId();

    try {
        const { draft: importedDraft, missingAssets = [] } = await importProjectFromZip(file);

        if (currentImportId !== creatorSession.getActiveImportId() || !creatorSession.isEditorActive()) return;

        // Decode audio buffers for all imported samples across all steps
        for (let pageIdx = 0; pageIdx < importedDraft.pages.length; pageIdx++) {
            const page = importedDraft.pages[pageIdx];
            for (let padIdx = 0; padIdx < LAUNCHPAD_PADS; padIdx++) {
                const steps = getPadSteps(page, padIdx);
                for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
                    const sampleFile = steps[stepIdx].sample;
                    if (sampleFile) {
                        await assignPadStepSample(page, padIdx, stepIdx, sampleFile, (f) => audioEngine.decodeAudioFile(f));
                        if (currentImportId !== creatorSession.getActiveImportId() || !creatorSession.isEditorActive()) return;
                    }
                }
            }
        }

        if (currentImportId !== creatorSession.getActiveImportId() || !creatorSession.isEditorActive()) return;

        stopPreview();
        stopAllDraftPads();

        creatorSession.open(importedDraft);

        setStudioSubMode('edit');
        renderEditor();
        previewDraftAppearance();
        updatePhysicalPageLights(creatorSession.getActivePageIndex());
        showNotification(translate('creator.importSuccess', { name: importedDraft.name }), 'success', 5000);
        if (missingAssets.length > 0) {
            showNotification(
                translate('creator.missingAssets', { count: missingAssets.length, files: missingAssets.join(', ') }),
                'warning',
                8000
            );
        }
    } catch (error) {
        if (currentImportId !== creatorSession.getActiveImportId() || !creatorSession.isEditorActive()) return;
        console.error('[Creator] Import error:', error);
        showNotification(translate('creator.errorImport', { error: error.message }), 'error', 6000);
    }
}

function listen(targetOrId, eventName, listener, options = false) {
    const target = typeof targetOrId === 'string' ? document.getElementById(targetOrId) : targetOrId;
    if (target) {
        registerListener(target, eventName, listener, options);
    }
    return target;
}

function initUnsavedDialogAndImport() {
    listen('creator-unsaved-save', 'click', async () => {
        const ok = await exportProject();
        if (ok) {
            forceCloseCreator();
        }
    });

    listen('creator-unsaved-discard', 'click', () => {
        forceCloseCreator();
    });

    listen('creator-unsaved-cancel', 'click', () => {
        closeUnsavedDialog();
    });

    const zipInput = document.getElementById('creator-project-zip-input');
    listen('creator-import-project', 'click', () => {
        zipInput?.click();
    });

    listen(zipInput, 'change', event => {
        const file = event.target.files?.[0];
        if (file) {
            handleProjectZipFile(file);
        }
        event.target.value = '';
    });

    const inspectorEl = document.getElementById('project-inspector');
    if (inspectorEl) {
        ['dragenter', 'dragover'].forEach(eventName => {
            listen(inspectorEl, eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        listen(inspectorEl, 'drop', e => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer?.files?.[0];
            if (file && (file.name.endsWith('.zip') || file.type.includes('zip'))) {
                handleProjectZipFile(file);
            }
        });
    }
}

function initStudioModeAndNavigation() {
    listen('studio-mode-edit', 'click', () => {
        setStudioSubMode('edit');
    });
    listen('studio-mode-live', 'click', () => {
        setStudioSubMode('live');
    });
    listen('studio-exit-live', 'click', () => {
        setStudioSubMode('edit');
    });

    listen('creator-close', 'click', closeCreator);
    listen(window, 'keydown', event => {
        if (event.key === 'Escape' && creatorSession.isEditorActive()) {
            if (creatorSession.getStudioSubMode() === 'live') {
                setStudioSubMode('edit');
            } else {
                closeCreator();
            }
        }
    });

    listen('creator-target-device', 'change', event => {
        const draft = creatorSession.getDraft();
        if (draft) {
            draft.targetDevice = event.target.value;
            creatorSession.markModified();
            lastRenderedCategory = null;
            renderLightPresets();
            updateTargetDeviceWarnings();
        }
    });

    listen('project-creator-name', 'input', event => {
        const draft = creatorSession.getDraft();
        if (draft) {
            draft.name = event.target.value;
            creatorSession.markModified();
            updateLiveToolbar();
        }
    });

    listen('creator-add-page', 'click', () => {
        if (creatorSession.addPage()) {
            selectProjectPage(creatorSession.getActivePageIndex());
        }
    });

    listen('creator-remove-page', 'click', () => {
        if (creatorSession.removePage()) {
            selectProjectPage(creatorSession.getActivePageIndex());
        }
    });
}

function initPadSampleListeners() {
    listen('creator-import-sound', 'click', chooseSample);
    listen('creator-sample-file', 'change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        assignSample(file);
        event.target.value = '';
    });

    const previewBtn = document.getElementById('creator-preview-pad');
    const getActiveStepAnimation = () => {
        const step = creatorSession.getCurrentStep();
        return step?.light || '';
    };

    if (previewBtn) {
        listen(previewBtn, 'pointerdown', (e) => {
            if (previewBtn.disabled || e.button !== 0) return;
            const animation = getActiveStepAnimation();
            if (animation && animations[animation]?.type === 'momentary') {
                e.preventDefault();
                startHoldPreview(creatorSession.getActivePadIndex());
            }
        });

        const handleHoldRelease = () => {
            if (creatorSession.getActiveMomentaryPreview()) {
                stopPreview();
            }
        };

        listen(previewBtn, 'pointerup', handleHoldRelease);
        listen(previewBtn, 'pointerleave', handleHoldRelease);
        listen(previewBtn, 'pointercancel', handleHoldRelease);

        listen(previewBtn, 'click', () => {
            const animation = getActiveStepAnimation();
            if (animation && animations[animation]?.type === 'momentary') {
                return;
            }
            previewPad(creatorSession.getActivePadIndex());
        });

        listen(previewBtn, 'keydown', (e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                const animation = getActiveStepAnimation();
                if (animation && animations[animation]?.type === 'momentary') {
                    e.preventDefault();
                    startHoldPreview(creatorSession.getActivePadIndex());
                }
            }
        });

        listen(previewBtn, 'keyup', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                handleHoldRelease();
            }
        });
    }

    listen('creator-add-step', 'click', () => {
        const padIndex = creatorSession.getActivePadIndex();
        const page = getCurrentPage();
        if (padIndex === null || !page) return;
        const steps = getPadSteps(page, padIndex);
        if (steps.length >= MAX_PAD_STEPS) {
            showNotification(getTranslation('creator.maxStepsReached'), 'warning');
            return;
        }
        creatorSession.addStep();
        renderPadGrid();
        renderSelectedPad();
    });

    listen('creator-remove-step', 'click', () => {
        if (creatorSession.removeStep()) {
            renderPadGrid();
            renderSelectedPad();
        }
    });

    listen('creator-remove-sample', 'click', () => {
        if (creatorSession.getActivePadIndex() === null || !getCurrentPage()) return;
        stopPreview();
        creatorSession.removeStepSample();
        renderPadGrid();
        renderSelectedPad();
    });
}

function initPadLightListeners() {
    listen('creator-remove-light', 'click', () => {
        if (creatorSession.getActivePadIndex() === null) return;
        stopPreview();
        creatorSession.removeStepLight();
        renderPadGrid();
        renderSelectedPad();
        updateTargetDeviceWarnings();
    });

    listen('creator-light-sync', 'change', event => {
        creatorSession.setStepLightSync(
            creatorSession.getActivePadIndex(),
            creatorSession.getActiveStepIndex(),
            event.target.checked
        );
        renderSelectedPad();
    });

    const durationInput = document.getElementById('creator-light-duration');
    if (durationInput) {
        listen(durationInput, 'input', event => {
            const padIndex = creatorSession.getActivePadIndex();
            const stepIndex = creatorSession.getActiveStepIndex();
            const value = Number.parseFloat(event.target.value);
            if (Number.isFinite(value) && value >= MIN_LIGHT_DURATION_SEC && value <= MAX_LIGHT_DURATION_SEC) {
                creatorSession.setStepLightDuration(padIndex, stepIndex, Math.round(value * 10) / 10);
            }
        });
        listen(durationInput, 'change', () => {
            const padIndex = creatorSession.getActivePadIndex();
            const stepIndex = creatorSession.getActiveStepIndex();
            const value = Number.parseFloat(durationInput.value);
            if (Number.isFinite(value) && value >= MIN_LIGHT_DURATION_SEC && value <= MAX_LIGHT_DURATION_SEC) {
                creatorSession.setStepLightDuration(padIndex, stepIndex, Math.round(value * 10) / 10);
            } else {
                const step = creatorSession.getCurrentStep();
                durationInput.value = String(step?.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC);
            }
        });
    }

    let searchDebounceTimer = null;
    listen('creator-light-search', 'input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            renderLightPresets();
        }, 150);
    });
    listen('creator-assign-text-animation', 'click', assignTextAnimation);
    listen('creator-export', 'click', exportProject);
}

function initThemeCustomizationListeners() {
    listen('creator-tab-pads', 'click', () => {
        setCreatorView('pads');
    });
    listen('creator-tab-theme', 'click', () => {
        setCreatorView('theme');
    });

    const commitThemeChange = (preview) => {
        creatorSession.markModified();
        preview();
        renderThemeView();
    };

    const bindThemeAsset = ({ selectId = null, triggerId, fileId, pathKey, fileKey, preview }) => {
        const select = selectId ? document.getElementById(selectId) : null;
        if (select) {
            listen(select, 'change', (e) => {
                const draft = creatorSession.getDraft();
                if (!draft || e.target.value === 'custom') return;
                draft[fileKey] = null;
                draft[pathKey] = e.target.value;
                commitThemeChange(preview);
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
            const draft = creatorSession.getDraft();
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

    listen('creator-reset-icon-trigger', 'click', () => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.customIconFile = null;
        draft.iconImage = '';
        commitThemeChange(previewDraftIcon);
    });

    listen('creator-viz-mode', 'change', (e) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.visualizer.mode = e.target.value;
        creatorSession.markModified();
        previewDraftVisualizer();
        renderThemeView();
    });

    listen('creator-viz-color1', 'input', (e) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.visualizer.color1 = e.target.value;
        creatorSession.markModified();
        previewDraftVisualizer();
    });

    listen('creator-viz-gradient', 'change', (e) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.visualizer.gradient = e.target.checked;
        creatorSession.markModified();
        previewDraftVisualizer();
        renderThemeView();
    });

    listen('creator-viz-color2', 'input', (e) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.visualizer.color2 = e.target.value;
        creatorSession.markModified();
        previewDraftVisualizer();
    });

    listen('creator-viz-direction', 'change', (e) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.visualizer.gradientDirection = e.target.value;
        creatorSession.markModified();
        previewDraftVisualizer();
    });

    syncInputSlider('creator-rotation-slider', 'creator-rotation-input', (angle) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.launchpadRotation = angle;
        creatorSession.markModified();
        previewDraftLayout();
    }, LAUNCHPAD_ROTATION_MIN, LAUNCHPAD_ROTATION_MAX);

    syncInputSlider('creator-size-slider', 'creator-size-input', (size) => {
        const draft = creatorSession.getDraft();
        if (!draft) return;
        draft.launchpadSize = size;
        creatorSession.markModified();
        previewDraftLayout();
    }, LAUNCHPAD_SIZE_MIN, LAUNCHPAD_SIZE_MAX);

    listen(window, 'launchpad-view-changed', () => {
        if (creatorSession.isEditorActive() && creatorSession.getDraft()) {
            renderEditor();
            updatePhysicalPageLights(creatorSession.getActivePageIndex());
        }
    });

    listen(window, 'deviceprofilechange', () => {
        if (creatorSession.isEditorActive() && creatorSession.getDraft()) {
            updateTargetDeviceWarnings();
        }
    });
}

export function initializeProjectCreator() {
    if (initialized) return;
    initialized = true;

    if (!document.getElementById('project-inspector')) return;

    initUnsavedDialogAndImport();
    initStudioModeAndNavigation();
    initPadSampleListeners();
    initPadLightListeners();
    initThemeCustomizationListeners();
}

// Ordered LED colors for a light: declared metadata when available, otherwise
// derived from the animation-name suffix (covers dynamic text/scroll lights).
function getAnimationSwatchColors(animationName) {
    const colors = resolveLightColors(animations[animationName] ?? {});
    if (colors.length) return colors;
    const suffix = getColorFromAnimationName(animationName);
    return suffix ? [suffix] : [];
}

function getAnimationSwatchGradient(colors) {
    return `linear-gradient(135deg, ${colors.map(name => LIGHT_COLOR_SWATCHES[name]).join(', ')})`;
}

function getAnimationColor(animationName) {
    const colors = getAnimationSwatchColors(animationName);
    if (!colors.length) return DEFAULT_ANIMATION_SWATCH_COLOR;
    return LIGHT_COLOR_SWATCHES[colors[Math.floor(colors.length / 2)]];
}

function previewAnimation(animationName, index, stepIndex) {
    const page = getCurrentPage();
    const duration = page ? getManualLightDuration(page, index, stepIndex) : DEFAULT_LIGHT_DURATION_SEC;
    const x = index % LAUNCHPAD_COLS;
    const y = Math.floor(index / LAUNCHPAD_COLS);
    triggerAnimation(animationName, x, y, duration);
    if (animations[animationName]?.type === 'momentary') {
        window.setTimeout(() => releaseAnimation(animationName, x, y), 900);
    }
}

function assignLightAnimation(animationName) {
    const padIndex = creatorSession.getActivePadIndex();
    const stepIndex = creatorSession.getActiveStepIndex();
    if (padIndex === null) return;
    creatorSession.setPendingTextAnimation(null);
    const textAnimBox = document.getElementById('creator-text-animation');
    if (textAnimBox) textAnimBox.hidden = true;
    creatorSession.assignStepLight(padIndex, stepIndex, animationName);
    renderPadGrid();
    renderSelectedPad();
    updateTargetDeviceWarnings();
    if (animationName) previewAnimation(animationName, padIndex, stepIndex);
}
