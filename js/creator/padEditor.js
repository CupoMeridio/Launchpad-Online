/**
 * PAD EDITOR (creator/padEditor.js)
 *
 * Page tabs, the pad grid and the pad inspector (steps, sample, light timing).
 */

import { audioEngine } from '../audio.js';
import {
    DEFAULT_LIGHT_DURATION_SEC,
    DEFAULT_TARGET_DEVICE,
    LAUNCHPAD_PADS,
    MAX_PAD_STEPS,
    MAX_PROJECT_PAGES
} from '../constants.js';
import { getShortestFrameMs, MIN_VISIBLE_FRAME_MS, parseCustomLightName } from '../customAnimationModel.js';
import { getTranslation, translate } from '../i18n.js';
import { animations } from '../lights.js';
import { showNotification } from '../notifications.js';
import { getActiveDeviceProfile } from '../physicalInterface.js';
import { checkDraftDeviceConsistency, getPadSteps } from '../projectCreatorModel.js';
import { creatorSession } from '../projectCreatorState.js';
import { getPadElement } from '../webInterface.js';
import { listen, setProps } from './dom.js';
import {
    getAnimationColor,
    getAnimationDisplayName,
    getAnimationSwatchColors,
    paintLightSwatch,
    renderLightPresets
} from './lightPicker.js';
import { previewPad, stopPreview } from './preview.js';

export function renderPageTabs() {
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

    setProps('creator-add-page', { disabled: draft.pages.length >= MAX_PROJECT_PAGES });
    setProps('creator-remove-page', { disabled: draft.pages.length <= 1 });
}

export function renderPadGrid() {
    const page = creatorSession.getCurrentPage();
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

        const ledColor = led ? getAnimationColor(led) : null;
        if (led) {
            pad.dataset.creatorLed = led;
        } else {
            delete pad.dataset.creatorLed;
        }
        // A light without colours gets a dashed ring, never a stand-in colour.
        pad.classList.toggle('creator-pad-colorless', Boolean(led) && !ledColor);
        if (ledColor) {
            pad.style.setProperty('--creator-led-color', ledColor);
        } else {
            pad.style.removeProperty('--creator-led-color');
        }
    }
}

export function updateTargetDeviceWarnings() {
    const warningEl = document.getElementById('creator-target-warning');
    const draft = creatorSession.getDraft();
    if (!warningEl || !draft) return;
    const messages = [];
    const { rgbLightCount } = checkDraftDeviceConsistency(draft);
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
    setProps('project-creator-name', { value: draft.name });
    setProps('creator-target-device', { value: draft.targetDevice || DEFAULT_TARGET_DEVICE });
    setProps('creator-page-count', { textContent: `${creatorSession.getActivePageIndex() + 1} / ${draft.pages.length}` });
    setProps('creator-sample-count', { textContent: translate('creator.sampleCount', { count: sampleCount }) });
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
                });
                return pill;
            })
        );
    }
}

function renderPadSampleControls(sample, animation, isMomentary) {
    const activePadIndex = creatorSession.getActivePadIndex();
    setProps('creator-selected-pad', { textContent: translate('creator.pad', { pad: activePadIndex + 1 }) });
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
    setProps('creator-hold-hint', { hidden: !isMomentary });

    setProps('creator-remove-sample', { disabled: !sample });
}

function findDraftAnimation(lightName) {
    const id = parseCustomLightName(lightName);
    return id === null ? null : creatorSession.getAnimations().find(animation => animation.id === id) ?? null;
}

/**
 * A custom light plays at its own speed, or stretched to the sample when synced;
 * compressed too much, its shortest frames may not be seen at all.
 */
function describeCustomLightTiming(step, sample, animation) {
    const syncedMs = sample && step.syncToSound && step.buffer?.duration > 0 ? step.buffer.duration * 1000 : 0;
    if (!syncedMs) {
        const naturalMs = animation.frames.reduce((sum, frame) => sum + frame.duration, 0);
        return translate('creator.customLightOwnSpeed', { seconds: (naturalMs / 1000).toFixed(2) });
    }
    const shortest = getShortestFrameMs(animation, syncedMs);
    return shortest < MIN_VISIBLE_FRAME_MS
        ? translate('creator.customLightTooFast', { ms: Math.round(shortest) })
        : translate('creator.customLightSynced', { seconds: (syncedMs / 1000).toFixed(2) });
}

/**
 * Light timing: "sync to sound" needs a sample; the manual duration is shown
 * whenever the light is not synced to one. Custom lights have no manual
 * duration (their frames set it): a note explains their timing instead.
 */
function renderLightTiming(step, sample) {
    const custom = findDraftAnimation(step.light);
    setProps('creator-light-sync', { checked: step.syncToSound, disabled: !sample });
    setProps('creator-light-duration', { value: step.duration });
    setProps('creator-manual-light-duration', { hidden: Boolean(custom || (sample && step.syncToSound)) });
    setProps('creator-custom-light-timing', custom
        ? { hidden: false, textContent: describeCustomLightTiming(step, sample, custom) }
        : { hidden: true });
}

function renderPadLightControls(currentStep, sample, animation, isMomentary) {
    setProps('creator-assigned-light', { hidden: !animation });
    setProps('creator-remove-light', { disabled: !animation });

    // Momentary lights last as long as the pad is held: no timing to set.
    const showTiming = Boolean(animation) && !isMomentary;
    setProps('creator-light-timing', { hidden: !showTiming });

    if (!animation) return;
    setProps('creator-assigned-name', { textContent: getAnimationDisplayName(animation) });
    const assignedSwatch = document.getElementById('creator-assigned-swatch');
    if (assignedSwatch) {
        const colors = getAnimationSwatchColors(animation);
        paintLightSwatch(assignedSwatch, colors);
        assignedSwatch.title = colors.length ? '' : getTranslation('creator.lightNoColor');
    }
    if (showTiming) renderLightTiming(currentStep, sample);
}

export function renderSelectedPad() {
    const draft = creatorSession.getDraft();
    const page = creatorSession.getCurrentPage();
    const padInspector = document.getElementById('creator-pad-inspector');
    if (!draft || !padInspector) return;

    updateInspectorProjectHeader(draft, page);

    const activePadIndex = creatorSession.getActivePadIndex();
    padInspector.hidden = activePadIndex === null;
    setProps('creator-text-animation', { hidden: !creatorSession.getPendingTextAnimation() });
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

export function selectProjectPad(index, preview = false) {
    if (!creatorSession.isEditorActive() || !Number.isInteger(index) || index < 0 || index >= LAUNCHPAD_PADS) return false;
    const alreadySelected = creatorSession.getActivePadIndex() === index;
    creatorSession.batch(() => {
        creatorSession.setCreatorView('pads');
        if (!alreadySelected) creatorSession.setActivePadIndex(index);
    });
    if (preview) {
        previewPad(index);
    }
    return true;
}

/**
 * Selects a draft page. In edit mode a pad is always selected afterwards.
 * @param {number} index
 * @returns {boolean} False if the page does not exist.
 */
export function selectProjectPage(index) {
    return creatorSession.batch(() => {
        if (!creatorSession.setActivePageIndex(index)) return false;
        if (creatorSession.getStudioSubMode() === 'edit' && creatorSession.getActivePadIndex() === null) {
            creatorSession.setActivePadIndex(0);
        }
        return true;
    });
}

async function assignSample(file) {
    if (!file) return;
    stopPreview();
    const result = await creatorSession.assignStepSample(file, (f) => audioEngine.decodeAudioFile(f));
    // 'superseded' / 'stale' are silent: the user already moved on.
    if (result === 'failed') {
        showNotification(getTranslation('creator.errorDecode'), 'error');
    }
}

function chooseSample() {
    const fileInput = document.getElementById('creator-sample-file');
    if (fileInput) fileInput.click();
}

export function initPadEditorListeners() {
    listen('creator-add-page', 'click', () => {
        creatorSession.addPage();
    });
    listen('creator-remove-page', 'click', () => {
        creatorSession.removePage();
    });

    listen('creator-import-sound', 'click', chooseSample);
    listen('creator-sample-file', 'change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        assignSample(file);
        event.target.value = '';
    });
    listen('creator-remove-sample', 'click', () => {
        if (creatorSession.getActivePadIndex() === null || !creatorSession.getCurrentPage()) return;
        stopPreview();
        creatorSession.removeStepSample();
    });

    listen('creator-add-step', 'click', () => {
        const padIndex = creatorSession.getActivePadIndex();
        const page = creatorSession.getCurrentPage();
        if (padIndex === null || !page) return;
        if (getPadSteps(page, padIndex).length >= MAX_PAD_STEPS) {
            showNotification(getTranslation('creator.maxStepsReached'), 'warning');
            return;
        }
        creatorSession.addStep();
    });
    listen('creator-remove-step', 'click', () => {
        creatorSession.removeStep();
    });

    listen('creator-remove-light', 'click', () => {
        if (creatorSession.getActivePadIndex() === null) return;
        stopPreview();
        creatorSession.removeStepLight();
    });
    listen('creator-light-sync', 'change', event => {
        creatorSession.setStepLightSync(
            creatorSession.getActivePadIndex(),
            creatorSession.getActiveStepIndex(),
            event.target.checked
        );
    });

    // The session validates and rounds the value; invalid input is ignored
    // while typing and reverted to the stored duration once committed.
    const durationInput = document.getElementById('creator-light-duration');
    listen(durationInput, 'input', event => {
        creatorSession.setStepLightDuration(undefined, undefined, event.target.value);
    });
    listen(durationInput, 'change', () => {
        if (!creatorSession.setStepLightDuration(undefined, undefined, durationInput.value)) {
            durationInput.value = String(creatorSession.getCurrentStep()?.duration ?? DEFAULT_LIGHT_DURATION_SEC);
        }
    });
}
