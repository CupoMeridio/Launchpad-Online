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
    getPadSteps,
    clearLightReferences
} from './projectCreatorModel.js';
import {
    createCustomAnimation,
    createCustomAnimationId,
    customLightName,
    addFrameAfter,
    duplicateFrame,
    removeFrame,
    moveFrame,
    paintFrameCell,
    setFrameCell,
    floodFillFrame,
    transformFramePads,
    copyFramePads,
    isValidFrameDuration,
    PLAYBACK_MODES,
    LIGHT_LEVELS
} from './customAnimationModel.js';

/** Pencil: paints pad by pad (click or drag). Fill: paint bucket. */
export const BRUSH_TOOLS = Object.freeze(['pencil', 'fill']);
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
 * - 'lightPicker': the light category or the pending text animation changed;
 * - 'animations':  a custom animation changed; `field` is 'list' (added/removed),
 *                  'meta' (name, playback), 'frames' (added/removed/moved), 'pads', 'timing'
 *                  or 'stroke' (pads painted by dragging: frequent, one per pad crossed);
 * - 'animationEditor': the animation, frame or brush being edited changed.
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
        this.resetAnimationEditor();
        this.resetAnimationTools();
    }

    /** Selection of the animation editor (the animation and frame being edited). */
    resetAnimationEditor(animationId = null) {
        this.activeAnimationId = animationId;
        this.activeFrameIndex = 0;
        this.stroke = null;
    }

    /**
     * Drawing tools: they outlive the selection, so a copied frame can be
     * pasted into another animation and the brush stays as the user set it.
     */
    resetAnimationTools() {
        this.brush = { color: 'red', level: 'full', erase: false, tool: 'pencil' };
        this.frameClipboard = null;
        this.onionSkin = false;
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
        this.resetAnimationEditor(this.draft.animations?.[0]?.id ?? null);
        this.resetAnimationTools();
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
        if (!['pads', 'theme', 'animations'].includes(view)) return false;
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
    // Custom animations
    // ------------------------------------------------------------------------

    getAnimations() {
        return this.draft?.animations ?? [];
    }

    getActiveAnimation() {
        return this.getAnimations().find(animation => animation.id === this.activeAnimationId) ?? null;
    }

    getActiveFrame() {
        return this.getActiveAnimation()?.frames[this.activeFrameIndex] ?? null;
    }

    getActiveFrameIndex() {
        return this.activeFrameIndex;
    }

    getBrush() {
        return { ...this.brush };
    }

    /**
     * Creates an animation (one empty frame) and selects it.
     * @param {string} [name]
     * @returns {string|null} The new animation id.
     */
    createAnimation(name = '') {
        if (!this.draft) return null;
        this.draft.animations ??= [];
        const id = createCustomAnimationId(this.draft.animations.map(animation => animation.id));
        this.draft.animations.push(createCustomAnimation({ id, name }));
        this.activeAnimationId = id;
        this.activeFrameIndex = 0;
        this.#commit({ type: 'animations', field: 'list' });
        return id;
    }

    /**
     * Deletes an animation and removes it from the pad steps that used it, so
     * the project never references a missing animation.
     * @param {string} [id]
     * @returns {boolean}
     */
    deleteAnimation(id = this.activeAnimationId) {
        const index = this.getAnimations().findIndex(animation => animation.id === id);
        if (index < 0) return false;
        this.draft.animations.splice(index, 1);
        const neighbour = this.draft.animations[Math.min(index, this.draft.animations.length - 1)];
        this.resetAnimationEditor(neighbour?.id ?? null);
        this.batch(() => {
            this.#commit({ type: 'animations', field: 'list' });
            if (clearLightReferences(this.draft, customLightName(id)) > 0) {
                this.#notify({ type: 'pads', field: 'light' });
            }
        });
        return true;
    }

    selectAnimation(id) {
        if (!this.getAnimations().some(animation => animation.id === id)) return false;
        this.activeAnimationId = id;
        this.activeFrameIndex = 0;
        this.#notify({ type: 'animationEditor' });
        return true;
    }

    renameAnimation(name) {
        const animation = this.getActiveAnimation();
        if (!animation || typeof name !== 'string' || animation.name === name) return false;
        animation.name = name;
        this.#commit({ type: 'animations', field: 'meta' });
        return true;
    }

    setAnimationPlayback(playback) {
        const animation = this.getActiveAnimation();
        if (!animation || !PLAYBACK_MODES.includes(playback) || animation.playback === playback) return false;
        animation.playback = playback;
        this.#commit({ type: 'animations', field: 'meta' });
        return true;
    }

    selectFrame(index) {
        const animation = this.getActiveAnimation();
        if (!animation || !Number.isInteger(index) || !animation.frames[index]) return false;
        this.activeFrameIndex = index;
        this.stroke = null;
        this.#notify({ type: 'animationEditor' });
        return true;
    }

    /** Applies a frame operation that returns the frame to select (or -1). */
    #editFrames(operation) {
        const animation = this.getActiveAnimation();
        if (!animation) return false;
        const nextIndex = operation(animation);
        if (nextIndex < 0) return false;
        this.activeFrameIndex = nextIndex;
        this.#commit({ type: 'animations', field: 'frames' });
        return true;
    }

    addFrame() {
        return this.#editFrames(animation => addFrameAfter(animation, this.activeFrameIndex));
    }

    duplicateActiveFrame() {
        return this.#editFrames(animation => duplicateFrame(animation, this.activeFrameIndex));
    }

    deleteActiveFrame() {
        return this.#editFrames(animation => (
            removeFrame(animation, this.activeFrameIndex) ? Math.max(0, this.activeFrameIndex - 1) : -1
        ));
    }

    moveActiveFrame(delta) {
        return this.#editFrames(animation => moveFrame(animation, this.activeFrameIndex, delta));
    }

    /** @param {number|string} ms - New duration of the active frame. */
    setFrameDuration(ms) {
        const frame = this.getActiveFrame();
        const value = Math.round(Number(ms));
        if (!frame || !isValidFrameDuration(value)) return false;
        if (frame.duration === value) return true;
        frame.duration = value;
        this.#commit({ type: 'animations', field: 'timing' });
        return true;
    }

    /** The cell the brush paints (null for the eraser). */
    #brushCell() {
        return this.brush.erase ? null : { color: this.brush.color, level: this.brush.level };
    }

    /**
     * A press on a pad: the pencil paints it (or toggles it off) and starts a
     * stroke; the fill tool fills its region.
     */
    paintPad(x, y) {
        const frame = this.getActiveFrame();
        this.stroke = null;
        if (!frame) return false;
        if (this.brush.tool === 'fill') {
            if (!floodFillFrame(frame, x, y, this.#brushCell())) return false;
        } else {
            if (!paintFrameCell(frame, x, y, this.brush)) return false;
            // Dragging on gives the other pads what the first one got: paint or erase.
            const cell = frame.pads[`${x},${y}`];
            this.stroke = { cell: cell ? { ...cell } : null };
        }
        this.#commit({ type: 'animations', field: 'pads' });
        return true;
    }

    /** Dragging over a pad during a pencil stroke (never toggles). */
    continueStroke(x, y) {
        const frame = this.getActiveFrame();
        if (!frame || !this.stroke || !setFrameCell(frame, x, y, this.stroke.cell)) return false;
        this.#commit({ type: 'animations', field: 'stroke' });
        return true;
    }

    endStroke() {
        this.stroke = null;
    }

    /**
     * Moves, mirrors or rotates the drawing of the active frame, or of every frame.
     * @param {string} name - A key of FRAME_TRANSFORMS.
     * @param {boolean} [allFrames]
     */
    transformFrames(name, allFrames = false) {
        const animation = this.getActiveAnimation();
        const frame = this.getActiveFrame();
        if (!animation || !frame || !transformFramePads({}, name)) return false;
        (allFrames ? animation.frames : [frame]).forEach(target => {
            target.pads = transformFramePads(target.pads, name);
        });
        this.#commit({ type: 'animations', field: 'pads' });
        return true;
    }

    copyActiveFrame() {
        const frame = this.getActiveFrame();
        if (!frame) return false;
        this.frameClipboard = copyFramePads(frame.pads);
        this.#notify({ type: 'animationEditor' });
        return true;
    }

    hasFrameClipboard() {
        return this.frameClipboard !== null;
    }

    /** Replaces the drawing of the active frame with the copied one (its duration is kept). */
    pasteIntoActiveFrame() {
        const frame = this.getActiveFrame();
        if (!frame || !this.frameClipboard) return false;
        frame.pads = copyFramePads(this.frameClipboard);
        this.#commit({ type: 'animations', field: 'pads' });
        return true;
    }

    isOnionSkinEnabled() {
        return this.onionSkin;
    }

    /** Onion skin: the previous frame shows faintly under the one being drawn. */
    setOnionSkin(enabled) {
        if (this.onionSkin === Boolean(enabled)) return false;
        this.onionSkin = Boolean(enabled);
        this.#notify({ type: 'animationEditor' });
        return true;
    }

    /** The frame before the active one (none for the first frame). */
    getPreviousFrame() {
        return this.activeFrameIndex > 0 ? this.getActiveAnimation()?.frames[this.activeFrameIndex - 1] ?? null : null;
    }

    clearActiveFrame() {
        const frame = this.getActiveFrame();
        if (!frame || Object.keys(frame.pads).length === 0) return false;
        frame.pads = {};
        this.#commit({ type: 'animations', field: 'pads' });
        return true;
    }

    /** @param {{color?: string, level?: string, erase?: boolean, tool?: 'pencil'|'fill'}} patch */
    setBrush(patch) {
        const next = { ...this.brush, ...patch };
        if (!LIGHT_LEVELS.includes(next.level) || !BRUSH_TOOLS.includes(next.tool)) return false;
        this.brush = { color: next.color, level: next.level, erase: Boolean(next.erase), tool: next.tool };
        this.#notify({ type: 'animationEditor' });
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
