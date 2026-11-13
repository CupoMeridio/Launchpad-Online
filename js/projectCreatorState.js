/**
 * PROJECT CREATOR STATE (projectCreatorState.js)
 *
 * The Studio Creator's model: the draft being edited plus the editor state
 * (selection, sub-mode, view...). Every change goes through a method of this
 * session, which validates it, marks the draft modified when relevant and
 * notifies subscribers of WHAT changed. The view never mutates the draft and
 * never decides on its own what to re-render after an edit: it reacts to these
 * notifications in a single place.
 *
 * DOM-free, so all editor operations are testable headlessly.
 */

import {
    LAUNCHPAD_PADS,
    MAX_PROJECT_PAGES,
    MAX_PAD_STEPS,
    DEFAULT_LIGHT_DURATION_SEC,
    MIN_LIGHT_DURATION_SEC,
    MAX_LIGHT_DURATION_SEC,
    normalizeTargetDevice
} from './constants.js';
import {
    createDraft,
    createProjectPage,
    isDraftDirty,
    addPadStep,
    removePadStep,
    assignPadStepLight,
    setPadStepLightSync,
    setPadStepLightDuration,
    removePadStepSample,
    assignSampleGuarded,
    getPadSteps
} from './projectCreatorModel.js';
import { normalizeVisualizer } from './appearanceModel.js';

/**
 * A change notification. `type` says which part of the state changed:
 * - 'draft':       a draft was opened/replaced, or the editor was closed;
 * - 'page':        the active page changed, or pages were added/removed;
 * - 'selection':   the active pad or step changed;
 * - 'pads':        pad content changed; \`field\` is 'steps' | 'sample' | 'light' | 'sync' | 'duration';
 * - 'meta':        project metadata changed; \`field\` is 'name' | 'targetDevice';
 * - 'theme':       the appearance changed; \`aspect\` is 'background' | 'skin' | 'icon' | 'visualizer' | 'layout',
 *                  and for 'visualizer' \`keys\` lists the changed settings;
 * - 'mode':        the studio sub-mode (edit/live) changed;
 * - 'view':        the creator view (pads/theme) changed;
 * - 'lightPicker': the light category or the pending text animation changed.
 * @typedef {{type: string, field?: string, aspect?: string, keys?: string[]}} SessionChange
 */

const APPEARANCE_ASSET_KEYS = ['background', 'skin', 'icon'];

function isValidLightDuration(value) {
    return Number.isFinite(value) && value >= MIN_LIGHT_DURATION_SEC && value <= MAX_LIGHT_DURATION_SEC;
}

export class ProjectCreatorSession {
    /** @type {Set<function(SessionChange[]): void>} */
    #listeners = new Set();
    #batchDepth = 0;
    /** @type {SessionChange[]} */
    #pendingChanges = [];

    constructor() {
        this.reset();
    }

    // ------------------------------------------------------------------------
    // Change notifications
    // ------------------------------------------------------------------------

    /**
     * Registers a listener called with the changes of each mutation (or of a
     * whole \`batch\`).
     * @param {function(SessionChange[]): void} listener
     * @returns {function(): void} Unsubscribe function.
     */
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    /**
     * Runs several mutations and notifies their changes once, at the end, so
     * the view re-renders a single time.
     * @template T
     * @param {function(): T} mutate
     * @returns {T}
     */
    batch(mutate) {
        this.#batchDepth++;
        try {
            return mutate();
        } finally {
            this.#batchDepth--;
            if (this.#batchDepth === 0) this.#flush();
        }
    }

    /** @param {SessionChange} change */
    #notify(change) {
        this.#pendingChanges.push(change);
        if (this.#batchDepth === 0) this.#flush();
    }

    #flush() {
        if (this.#pendingChanges.length === 0) return;
        const changes = this.#pendingChanges;
        this.#pendingChanges = [];
        this.#listeners.forEach(listener => listener(changes));
    }

    /** Marks the draft modified and notifies the change. */
    #commit(change) {
        this.markModified();
        this.#notify(change);
    }

    // ------------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------------

    reset() {
        this.draft = null;
        this.editorActive = false;
        this.activePageIndex = 0;
        this.activePadIndex = null;
        this.activeStepIndex = 0;
        this.studioSubMode = 'edit';
        this.activeCreatorView = 'pads';
        this.activeLightCategory = 'all';
        this.pendingTextAnimation = null;
        this.activeMomentaryPreview = null;
        this.activeImportId = 0;
    }

    open(initialDraft = null) {
        this.draft = initialDraft || createDraft();
        this.editorActive = true;
        this.activePageIndex = 0;
        this.activePadIndex = 0;
        this.activeStepIndex = 0;
        this.studioSubMode = 'edit';
        this.activeCreatorView = 'pads';
        this.activeLightCategory = 'all';
        this.pendingTextAnimation = null;
        this.activeMomentaryPreview = null;
        this.#notify({ type: 'draft' });
    }

    close() {
        this.activeImportId++;
        this.editorActive = false;
        this.draft = null;
        this.activePadIndex = null;
        this.activeStepIndex = 0;
        this.studioSubMode = 'edit';
        this.activeCreatorView = 'pads';
        this.pendingTextAnimation = null;
        this.activeMomentaryPreview = null;
        this.#notify({ type: 'draft' });
    }

    isEditorActive() {
        return this.editorActive;
    }

    /**
     * The draft being edited. Read-only for callers: change it through the
     * session's methods so modifications are tracked and notified.
     * @returns {object|null}
     */
    getDraft() {
        return this.draft;
    }

    markModified() {
        if (this.draft) {
            this.draft.changeCount++;
        }
    }

    isDirty() {
        return isDraftDirty(this.draft);
    }

    markSaved() {
        if (this.draft) {
            this.draft.savedChangeCount = this.draft.changeCount;
        }
    }

    // ------------------------------------------------------------------------
    // Imports in flight
    // ------------------------------------------------------------------------

    /** Starts a new import; any earlier one becomes stale. @returns {number} */
    nextImportId() {
        return ++this.activeImportId;
    }

    getActiveImportId() {
        return this.activeImportId;
    }

    /**
     * True while \`importId\` is still the latest import and the editor is open,
     * i.e. its result may still be applied.
     * @param {number} importId
     * @returns {boolean}
     */
    isImportCurrent(importId) {
        return importId === this.activeImportId && this.editorActive;
    }

    // ------------------------------------------------------------------------
    // Project metadata and appearance
    // ------------------------------------------------------------------------

    /** @param {string} name @returns {boolean} True if the name changed. */
    setName(name) {
        if (!this.draft || typeof name !== 'string' || name === this.draft.name) return false;
        this.draft.name = name;
        this.#commit({ type: 'meta', field: 'name' });
        return true;
    }

    /** @param {string} targetDevice @returns {boolean} True if the target changed. */
    setTargetDevice(targetDevice) {
        const normalized = normalizeTargetDevice(targetDevice);
        if (!this.draft || normalized === this.draft.targetDevice) return false;
        this.draft.targetDevice = normalized;
        this.#commit({ type: 'meta', field: 'targetDevice' });
        return true;
    }

    /**
     * @param {'background'|'skin'|'icon'} key
     * @param {File|Blob|string|null} asset - Catalog path, uploaded file, or null to clear.
     * @returns {boolean}
     */
    setAppearanceAsset(key, asset) {
        if (!this.draft || !APPEARANCE_ASSET_KEYS.includes(key)) return false;
        this.draft.appearance[key] = asset || null;
        this.#commit({ type: 'theme', aspect: key });
        return true;
    }

    /**
     * Updates some visualizer settings; the result is normalized.
     * @param {object} patch - Any of mode, color1, color2, gradient, gradientDirection.
     * @returns {boolean}
     */
    updateVisualizer(patch) {
        if (!this.draft || !patch) return false;
        this.draft.appearance.visualizer = normalizeVisualizer({
            visualizer: { ...this.draft.appearance.visualizer, ...patch }
        });
        this.#commit({ type: 'theme', aspect: 'visualizer', keys: Object.keys(patch) });
        return true;
    }

    /**
     * Sets the project's rotation and/or size override.
     * @param {{rotation?: number|null, size?: number|null}} patch
     * @returns {boolean}
     */
    setLayout(patch) {
        if (!this.draft || !patch) return false;
        ['rotation', 'size'].forEach(key => {
            if (key in patch) {
                this.draft.appearance[key] = typeof patch[key] === 'number' ? patch[key] : null;
            }
        });
        this.#commit({ type: 'theme', aspect: 'layout' });
        return true;
    }

    // ------------------------------------------------------------------------
    // Pages and selection
    // ------------------------------------------------------------------------

    getActivePageIndex() {
        return this.activePageIndex;
    }

    getCurrentPage() {
        return this.draft?.pages[this.activePageIndex] || null;
    }

    setActivePageIndex(index) {
        if (!this.editorActive || !Number.isInteger(index) || index < 0 || !this.draft || index >= this.draft.pages.length) {
            return false;
        }
        this.activePageIndex = index;
        this.pendingTextAnimation = null;
        this.#notify({ type: 'page' });
        return true;
    }

    addPage() {
        if (!this.draft || this.draft.pages.length >= MAX_PROJECT_PAGES) {
            return false;
        }
        this.draft.pages.push(createProjectPage(this.draft.pages.length + 1));
        this.activePageIndex = this.draft.pages.length - 1;
        this.pendingTextAnimation = null;
        this.#commit({ type: 'page' });
        return true;
    }

    removePage(index = this.activePageIndex) {
        if (!this.draft || this.draft.pages.length <= 1 || index < 0 || index >= this.draft.pages.length) {
            return false;
        }
        this.draft.pages.splice(index, 1);
        this.activePageIndex = Math.max(0, Math.min(this.activePageIndex, this.draft.pages.length - 1));
        this.pendingTextAnimation = null;
        this.#commit({ type: 'page' });
        return true;
    }

    getActivePadIndex() {
        return this.activePadIndex;
    }

    setActivePadIndex(index) {
        if (index !== null && (!this.editorActive || !Number.isInteger(index) || index < 0 || index >= LAUNCHPAD_PADS)) {
            return false;
        }
        this.activePadIndex = index;
        this.activeStepIndex = 0;
        this.pendingTextAnimation = null;
        this.#notify({ type: 'selection' });
        return true;
    }

    getActiveStepIndex() {
        return this.activeStepIndex;
    }

    setActiveStepIndex(index) {
        const page = this.getCurrentPage();
        if (!page || this.activePadIndex === null || !Number.isInteger(index) || index < 0) {
            return false;
        }
        if (index >= getPadSteps(page, this.activePadIndex).length) {
            return false;
        }
        this.activeStepIndex = index;
        this.#notify({ type: 'selection' });
        return true;
    }

    getCurrentStep() {
        const page = this.getCurrentPage();
        if (!page || this.activePadIndex === null) return null;
        const steps = getPadSteps(page, this.activePadIndex);
        return steps[this.activeStepIndex] || steps[0] || null;
    }

    // ------------------------------------------------------------------------
    // Editor modes and light picker
    // ------------------------------------------------------------------------

    getStudioSubMode() {
        return this.studioSubMode;
    }

    setStudioSubMode(mode) {
        if (mode !== 'edit' && mode !== 'live') return false;
        this.studioSubMode = mode;
        this.#notify({ type: 'mode' });
        return true;
    }

    getActiveCreatorView() {
        return this.activeCreatorView;
    }

    setCreatorView(view) {
        if (view !== 'pads' && view !== 'theme') return false;
        if (view === this.activeCreatorView) return true;
        this.activeCreatorView = view;
        this.#notify({ type: 'view' });
        return true;
    }

    getActiveLightCategory() {
        return this.activeLightCategory;
    }

    setActiveLightCategory(category) {
        if (typeof category !== 'string') return;
        this.activeLightCategory = category;
        this.#notify({ type: 'lightPicker' });
    }

    getPendingTextAnimation() {
        return this.pendingTextAnimation;
    }

    setPendingTextAnimation(pending) {
        this.pendingTextAnimation = pending;
        this.#notify({ type: 'lightPicker' });
    }

    /** Transient preview bookkeeping (not editor state): never notified. */
    getActiveMomentaryPreview() {
        return this.activeMomentaryPreview;
    }

    setActiveMomentaryPreview(preview) {
        this.activeMomentaryPreview = preview;
    }

    // ------------------------------------------------------------------------
    // Pad steps
    // ------------------------------------------------------------------------

    addStep(padIndex = this.activePadIndex) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return -1;
        if (getPadSteps(page, padIndex).length >= MAX_PAD_STEPS) return -1;
        const newStepIndex = addPadStep(page, padIndex);
        if (padIndex === this.activePadIndex) {
            this.activeStepIndex = newStepIndex;
        }
        this.#commit({ type: 'pads', field: 'steps' });
        return newStepIndex;
    }

    removeStep(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        if (!removePadStep(page, padIndex, stepIndex)) return false;
        if (padIndex === this.activePadIndex && this.activeStepIndex > 0) {
            this.activeStepIndex--;
        }
        this.#commit({ type: 'pads', field: 'steps' });
        return true;
    }

    /**
     * Decodes \`file\` and assigns it to the step selected when the call starts.
     * Late results are discarded if that step changed meanwhile ('superseded')
     * or another draft was opened ('stale').
     * @param {File|Blob} file
     * @param {function(File|Blob): Promise<AudioBuffer>} decoder
     * @returns {Promise<'assigned'|'failed'|'superseded'|'stale'>}
     */
    async assignStepSample(file, decoder) {
        const page = this.getCurrentPage();
        const padIndex = this.activePadIndex;
        if (!file || !page || padIndex === null) return 'failed';

        const result = await assignSampleGuarded({
            targetDraft: this.draft,
            page,
            padIndex,
            stepIndex: this.activeStepIndex,
            file,
            decoder,
            getActiveDraft: () => this.draft
        });
        if (result === 'assigned') {
            this.#commit({ type: 'pads', field: 'sample' });
        }
        return result;
    }

    removeStepSample(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        removePadStepSample(page, padIndex, stepIndex);
        this.#commit({ type: 'pads', field: 'sample' });
        return true;
    }

    assignStepLight(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex, animationName = null) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        assignPadStepLight(page, padIndex, stepIndex, animationName);
        this.#commit({ type: 'pads', field: 'light' });
        return true;
    }

    removeStepLight(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex) {
        return this.assignStepLight(padIndex, stepIndex, null);
    }

    setStepLightSync(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex, sync = true) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        setPadStepLightSync(page, padIndex, stepIndex, sync);
        this.#commit({ type: 'pads', field: 'sync' });
        return true;
    }

    setStepLightDuration(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex, duration = DEFAULT_LIGHT_DURATION_SEC) {
        const page = this.getCurrentPage();
        const value = Number.parseFloat(duration);
        if (!page || padIndex === null || !isValidLightDuration(value)) return false;
        setPadStepLightDuration(page, padIndex, stepIndex, Math.round(value * 10) / 10);
        this.#commit({ type: 'pads', field: 'duration' });
        return true;
    }

    // ------------------------------------------------------------------------
    // Pad source
    // ------------------------------------------------------------------------

    /**
     * Pad source contract (see PadSource in interaction.js). Draft steps are
     * PadSteps, so they are returned as-is.
     * - Live mode: round-robin through the pad's steps using the shared cursor.
     * - Edit mode: the selected pad plays its selected step, others step 0;
     *   the cursor never advances.
     * @param {number} index - Pad index (0-63).
     * @param {function(string): number} [getCursorFn] - Reads a round-robin cursor.
     * @returns {import('./interaction.js').PadPlayback|null}
     */
    getPadPlayback(index, getCursorFn = null) {
        const page = this.getCurrentPage();
        if (!page) return null;
        const steps = getPadSteps(page, index);
        const totalSteps = Math.max(steps.length, 1);
        const soundKey = `draft:${this.activePageIndex}:${index}`;

        if (this.studioSubMode === 'live') {
            const counterKey = `${this.activePageIndex}:${index}`;
            const stepIndex = typeof getCursorFn === 'function' ? getCursorFn(counterKey) % totalSteps : 0;
            return { step: steps[stepIndex], stepIndex, totalSteps, soundKey, counterKey };
        }

        const stepIndex = (index === this.activePadIndex && steps[this.activeStepIndex]) ? this.activeStepIndex : 0;
        return { step: steps[stepIndex], stepIndex, totalSteps, soundKey, counterKey: null };
    }
}

export const creatorSession = new ProjectCreatorSession();
