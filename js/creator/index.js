/**
 * STUDIO CREATOR (creator/index.js)
 *
 * Entry point of the Studio Creator: opens/closes the editor, registers it as
 * the pad source, and hosts the single dispatcher that turns session changes
 * (see projectCreatorState.js) into reactions and renders. Feature modules only
 * call session methods; they never re-render each other.
 */

import { audioEngine } from '../audio.js';
import { LAUNCHPAD_COLS, LAUNCHPAD_PADS } from '../constants.js';
import { getTranslation } from '../i18n.js';
import {
    getPadStepCursor,
    resetPadStepCounters,
    setPadSource,
    syncPerformanceModeButtons,
    syncPerformancePageButtons,
    updatePhysicalPageLights
} from '../interaction.js';
import { restoreProjectAppearance } from '../project.js';
import { setCustomAnimations } from '../customAnimations.js';
import { creatorSession } from '../projectCreatorState.js';
import { getPadElement, updatePageButtonHighlight } from '../webInterface.js';
import { listen, setProps } from './dom.js';
import {
    clearAnimationCanvas,
    initAnimationEditorListeners,
    renderAnimationEditor,
    syncAnimationCanvas,
    syncAnimationCanvasChanges
} from './animationEditor.js';
import { exportProject, initImportExportListeners } from './importExport.js';
import {
    initLightPickerListeners,
    invalidateLightPresets,
    renderLightPresets,
    syncTextAnimationBox
} from './lightPicker.js';
import {
    initPadEditorListeners,
    renderPadGrid,
    renderPageTabs,
    renderSelectedPad,
    selectProjectPad,
    selectProjectPage,
    updateTargetDeviceWarnings
} from './padEditor.js';
import { initPreviewListeners, stopAllDraftPads, stopPreview } from './preview.js';
import {
    THEME_PREVIEWS,
    initThemeEditorListeners,
    previewDraftAppearance,
    renderThemeView,
    themeFormNeedsRender
} from './themeEditor.js';

/** In the "Custom lights" view (edit mode), pad presses paint the current frame. */
function isPaintingFrames() {
    return creatorSession.getActiveCreatorView() === 'animations' && creatorSession.getStudioSubMode() === 'edit';
}

const creatorPadSource = {
    getPadPlayback: (index) => (isPaintingFrames() ? null : creatorSession.getPadPlayback(index, getPadStepCursor)),
    onPadPress: (index) => {
        if (isPaintingFrames()) {
            creatorSession.paintPad(index % LAUNCHPAD_COLS, Math.floor(index / LAUNCHPAD_COLS));
        } else if (creatorSession.getStudioSubMode() === 'edit') {
            selectProjectPad(index, false);
        }
    },
    // Dragging with the button down paints a stroke across the pads.
    onPadDrag: (index) => {
        if (isPaintingFrames()) creatorSession.continueStroke(index % LAUNCHPAD_COLS, Math.floor(index / LAUNCHPAD_COLS));
    },
    onDragEnd: () => creatorSession.endStroke(),
    onPageChange: (pageIndex) => {
        selectProjectPage(pageIndex);
    }
};

/**
 * Shows the pads or theme view according to the session.
 */
const CREATOR_VIEWS = [
    { view: 'pads', tab: 'creator-tab-pads', panel: 'creator-pads-view' },
    { view: 'theme', tab: 'creator-tab-theme', panel: 'creator-theme-view' },
    { view: 'animations', tab: 'creator-tab-animations', panel: 'creator-animations-view' }
];

function applyCreatorViewUi() {
    const active = creatorSession.getActiveCreatorView();
    CREATOR_VIEWS.forEach(({ view, tab, panel }) => {
        const tabEl = document.getElementById(tab);
        if (tabEl) {
            tabEl.classList.toggle('selected', view === active);
            tabEl.setAttribute('aria-selected', String(view === active));
        }
        const panelEl = document.getElementById(panel);
        if (panelEl) panelEl.hidden = view !== active;
    });
}

function renderEditor() {
    renderPageTabs();
    renderPadGrid();
    renderSelectedPad();
    renderThemeView();
    updateTargetDeviceWarnings();
}

/**
 * Highlights the active draft page on the virtual and physical page buttons.
 */
function syncCreatorPageButtons() {
    const activePage = creatorSession.getActivePageIndex();
    updatePageButtonHighlight(activePage);
    updatePhysicalPageLights(activePage);
}

/**
 * Custom animation edits. Pads show their assigned light's name and colours,
 * so renaming or deleting refreshes the picker and the inspector; drawing only
 * marks them stale (they are hidden in this view and re-render when it changes).
 * Drawing does not change the panel either, and a drag (one change per pad
 * crossed) repaints the Launchpad incrementally.
 * @param {import('../projectCreatorState.js').SessionChange} change
 * @returns {string[]}
 */
function planAnimationChange({ field }) {
    if (field === 'stroke') return ['registerAnimations', 'animationStroke', 'rebuildPresets', 'warnings'];
    return ['registerAnimations', 'animationCanvas', 'rebuildPresets',
        ...(field === 'pads' ? [] : ['animationEditor']),
        ...(field === 'list' || field === 'meta' ? ['presets', 'inspector'] : []),
        ...(['pads', 'frames', 'list'].includes(field) ? ['warnings'] : [])];
}

/**
 * Translates one session change into the reactions and renders it requires.
 * @param {import('./projectCreatorState.js').SessionChange} change
 * @param {Set<string>} plan
 */
/**
 * Reactions and renders for each type of session change.
 * @type {Record<string, function(import('../projectCreatorState.js').SessionChange, boolean): string[]>}
 */
const CHANGE_PLANNERS = {
    draft: () => ['registerAnimations', 'stopPlayback', 'resetCounters', 'modeUi', 'viewUi', 'previewAppearance',
        'tabs', 'grid', 'inspector', 'theme', 'warnings', 'liveToolbar', 'pageButtons', 'animationEditor'],
    page: (_change, isEditMode) => ['stopPlayback', 'grid', 'liveToolbar', 'pageButtons', ...(isEditMode ? ['tabs', 'inspector'] : [])],
    selection: () => ['grid', 'inspector'],
    // The duration input is the source of the value: re-rendering the
    // inspector would rewrite it while the user is still typing.
    pads: (change) => (change.field === 'duration' ? [] : ['grid', 'inspector', 'warnings']),
    meta: (change) => (change.field === 'targetDevice'
        ? ['rebuildPresets', 'presets', 'warnings', 'animationEditor']
        : ['liveToolbar']),
    theme: (change) => [`preview:${change.aspect}`, ...(themeFormNeedsRender(change) ? ['theme'] : [])],
    mode: (_change, isEditMode) => ['resetCounters', 'stopPlayback', 'modeUi', 'liveToolbar', ...(isEditMode ? ['grid', 'inspector'] : [])],
    // The pad inspector and light picker are hidden while drawing: they catch up here.
    view: () => ['viewUi', 'grid', 'inspector', 'animationEditor'],
    lightPicker: () => ['textBox', 'presets'],
    animations: planAnimationChange,
    animationEditor: () => ['animationEditor', 'animationCanvas']
};

/**
 * Translates one session change into the reactions and renders it requires.
 * @param {import('../projectCreatorState.js').SessionChange} change
 * @param {Set<string>} plan
 */
function planSessionChange(change, plan) {
    const isEditMode = creatorSession.getStudioSubMode() === 'edit';
    (CHANGE_PLANNERS[change.type]?.(change, isEditMode) ?? []).forEach(step => plan.add(step));
    // Grid renders decorate the pads: the animation canvas repaints over them.
    if (plan.has('grid')) plan.add('animationCanvas');
}

/** Plan steps in execution order: reactions first, then renders. */
const PLAN_STEPS = [
    // The draft's custom animations must be playable before anything previews them.
    ['registerAnimations', () => setCustomAnimations('draft', creatorSession.getDraft()?.animations || [])],
    ['stopPlayback', () => { stopPreview(); stopAllDraftPads(); }],
    ['resetCounters', resetPadStepCounters],
    ['modeUi', applyStudioModeUi],
    ['viewUi', applyCreatorViewUi],
    ['previewAppearance', previewDraftAppearance],
    ...Object.entries(THEME_PREVIEWS).map(([aspect, preview]) => [`preview:${aspect}`, preview]),
    ['rebuildPresets', invalidateLightPresets],
    ['tabs', renderPageTabs],
    ['grid', renderPadGrid],
    ['inspector', renderSelectedPad],
    ['textBox', syncTextAnimationBox],
    ['presets', renderLightPresets],
    ['theme', renderThemeView],
    ['warnings', updateTargetDeviceWarnings],
    ['liveToolbar', updateLiveToolbar],
    ['pageButtons', syncCreatorPageButtons],
    ['animationEditor', renderAnimationEditor],
    // A full repaint, when planned too, comes after and supersedes the incremental one.
    ['animationStroke', syncAnimationCanvasChanges],
    ['animationCanvas', syncAnimationCanvas]
];

/**
 * The only place that decides how the view reacts to state changes. Event
 * handlers just call session methods; every resulting change lands here, and
 * each reaction or render runs at most once per notification (or batch).
 * @param {import('./projectCreatorState.js').SessionChange[]} changes
 */
function handleSessionChanges(changes) {
    if (!creatorSession.isEditorActive()) return;
    const plan = new Set();
    changes.forEach(change => planSessionChange(change, plan));
    PLAN_STEPS.forEach(([step, run]) => {
        if (plan.has(step)) run();
    });
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
    clearAnimationCanvas();
    setCustomAnimations('draft', []);
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
    applyCreatorViewUi();
    applyStudioModeUi();

    setProps('creator-bg-file', { value: '' });
    setProps('creator-skin-file', { value: '' });
    setProps('creator-icon-file', { value: '' });

    restoreProjectAppearance();
}

function closeCreator() {
    requestCloseCreator();
}

export function openCreator() {
    if (creatorSession.isEditorActive()) return;

    // Stop all audio playback from the performance session
    audioEngine.stopAllSounds();

    setPadSource(creatorPadSource);

    const layout = document.querySelector('.layout');
    if (layout) {
        layout.classList.remove('sidebar-open');
    }

    // Fresh session: the 'draft' change renders the whole editor.
    creatorSession.open();
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

/**
 * Switches between edit and live preview. Entering edit mode always leaves a
 * pad selected.
 * @param {'edit'|'live'} mode
 */
function setStudioSubMode(mode) {
    creatorSession.batch(() => {
        if (!creatorSession.setStudioSubMode(mode)) return;
        if (mode === 'edit' && creatorSession.getActivePadIndex() === null) {
            creatorSession.setActivePadIndex(0);
        }
    });
}

/**
 * Reflects the studio sub-mode (edit/live) on the mode buttons, banner and layout.
 */
function applyStudioModeUi() {
    const mode = creatorSession.isEditorActive() ? creatorSession.getStudioSubMode() : null;
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
        if (mode) {
            layout.dataset.studio = mode;
        } else {
            delete layout.dataset.studio;
        }
    }

    if (mode === 'live') {
        for (let i = 0; i < LAUNCHPAD_PADS; i++) {
            const pad = getPadElement(i);
            if (pad) pad.classList.remove('creator-pad-selected');
        }
    }
}

let initialized = false;

/**
 * Editor shell: unsaved-changes dialog, studio modes, view tabs, project
 * metadata and reactions to Launchpad/device changes.
 */
function initEditorShellListeners() {
    listen('creator-unsaved-save', 'click', async () => {
        if (await exportProject()) forceCloseCreator();
    });
    listen('creator-unsaved-discard', 'click', forceCloseCreator);
    listen('creator-unsaved-cancel', 'click', closeUnsavedDialog);

    listen('studio-mode-edit', 'click', () => setStudioSubMode('edit'));
    listen('studio-mode-live', 'click', () => setStudioSubMode('live'));
    listen('studio-exit-live', 'click', () => setStudioSubMode('edit'));

    listen('creator-close', 'click', closeCreator);
    listen(window, 'keydown', event => {
        if (event.key !== 'Escape' || !creatorSession.isEditorActive()) return;
        if (creatorSession.getStudioSubMode() === 'live') {
            setStudioSubMode('edit');
        } else {
            closeCreator();
        }
    });

    listen('creator-tab-pads', 'click', () => creatorSession.setCreatorView('pads'));
    listen('creator-tab-theme', 'click', () => creatorSession.setCreatorView('theme'));
    listen('creator-tab-animations', 'click', () => creatorSession.setCreatorView('animations'));

    listen('creator-target-device', 'change', event => {
        creatorSession.setTargetDevice(event.target.value);
    });
    listen('project-creator-name', 'input', event => {
        creatorSession.setName(event.target.value);
    });

    listen(window, 'launchpad-view-changed', () => {
        if (creatorSession.isEditorActive()) {
            renderEditor();
            syncCreatorPageButtons();
        }
    });
    listen(window, 'deviceprofilechange', () => {
        if (creatorSession.isEditorActive()) {
            updateTargetDeviceWarnings();
            syncAnimationCanvas(); // A Launchpad just connected shows the frame being drawn
        }
    });
}

/**
 * Wires the Studio Creator once. The editor itself opens with openCreator().
 */
export function initializeProjectCreator() {
    if (initialized) return;
    initialized = true;

    if (!document.getElementById('project-inspector')) return;

    creatorSession.subscribe(handleSessionChanges);
    initEditorShellListeners();
    initPadEditorListeners();
    initPreviewListeners();
    initLightPickerListeners();
    initThemeEditorListeners();
    initImportExportListeners();
    initAnimationEditorListeners();
}
