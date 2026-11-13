/**
 * PROJECT CREATOR STATE (projectCreatorState.js)
 * 
 * Encapsulates all session state and business logic for the Studio / Project Creator.
 * Decoupled from the DOM, allowing comprehensive headless testing of editor operations:
 * selection, page navigation, step management, dirty tracking, and pad configuration.
 */

import {
    LAUNCHPAD_PADS,
    MAX_PROJECT_PAGES,
    MAX_PAD_STEPS,
    DEFAULT_LIGHT_DURATION_SEC,
    MIN_LIGHT_DURATION_SEC,
    MAX_LIGHT_DURATION_SEC
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
    getPadSteps
} from './projectCreatorModel.js';

export class ProjectCreatorSession {
    constructor() {
        this.reset();
    }

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
    }

    close() {
        this.activeImportId++;
        this.editorActive = false;
        this.draft = null;
        this.activePadIndex = null;
        this.activeStepIndex = 0;
        this.studioSubMode = 'edit';
        this.pendingTextAnimation = null;
        this.activeMomentaryPreview = null;
    }

    isEditorActive() {
        return this.editorActive;
    }

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
        return true;
    }

    getActivePadIndex() {
        return this.activePadIndex;
    }

    setActivePadIndex(index) {
        if (index === null) {
            this.activePadIndex = null;
            this.activeStepIndex = 0;
            this.pendingTextAnimation = null;
            return true;
        }
        if (!this.editorActive || !Number.isInteger(index) || index < 0 || index >= LAUNCHPAD_PADS) {
            return false;
        }
        this.activePadIndex = index;
        this.activeStepIndex = 0;
        this.pendingTextAnimation = null;
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
        const steps = getPadSteps(page, this.activePadIndex);
        if (index >= steps.length) {
            return false;
        }
        this.activeStepIndex = index;
        return true;
    }

    getCurrentStep() {
        const page = this.getCurrentPage();
        if (!page || this.activePadIndex === null) return null;
        const steps = getPadSteps(page, this.activePadIndex);
        return steps[this.activeStepIndex] || steps[0] || null;
    }

    getStudioSubMode() {
        return this.studioSubMode;
    }

    setStudioSubMode(mode) {
        if (mode !== 'edit' && mode !== 'live') return false;
        this.studioSubMode = mode;
        return true;
    }

    getActiveCreatorView() {
        return this.activeCreatorView;
    }

    setCreatorView(view) {
        if (view !== 'pads' && view !== 'theme') return false;
        this.activeCreatorView = view;
        return true;
    }

    getActiveLightCategory() {
        return this.activeLightCategory;
    }

    setActiveLightCategory(category) {
        if (typeof category === 'string') {
            this.activeLightCategory = category;
        }
    }

    getPendingTextAnimation() {
        return this.pendingTextAnimation;
    }

    setPendingTextAnimation(pending) {
        this.pendingTextAnimation = pending;
    }

    getActiveMomentaryPreview() {
        return this.activeMomentaryPreview;
    }

    setActiveMomentaryPreview(preview) {
        this.activeMomentaryPreview = preview;
    }

    nextImportId() {
        return ++this.activeImportId;
    }

    getActiveImportId() {
        return this.activeImportId;
    }

    addPage() {
        if (!this.draft || this.draft.pages.length >= MAX_PROJECT_PAGES) {
            return false;
        }
        const newPage = createProjectPage(this.draft.pages.length + 1);
        this.draft.pages.push(newPage);
        this.markModified();
        this.activePageIndex = this.draft.pages.length - 1;
        return true;
    }

    removePage(index = this.activePageIndex) {
        if (!this.draft || this.draft.pages.length <= 1 || index < 0 || index >= this.draft.pages.length) {
            return false;
        }
        this.draft.pages.splice(index, 1);
        this.markModified();
        this.activePageIndex = Math.max(0, Math.min(this.activePageIndex, this.draft.pages.length - 1));
        return true;
    }

    addStep(padIndex = this.activePadIndex) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return -1;
        const steps = getPadSteps(page, padIndex);
        if (steps.length >= MAX_PAD_STEPS) return -1;
        const newStepIndex = addPadStep(page, padIndex);
        if (padIndex === this.activePadIndex) {
            this.activeStepIndex = newStepIndex;
        }
        this.markModified();
        return newStepIndex;
    }

    removeStep(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        const removed = removePadStep(page, padIndex, stepIndex);
        if (removed) {
            if (padIndex === this.activePadIndex && this.activeStepIndex > 0) {
                this.activeStepIndex--;
            }
            this.markModified();
            return true;
        }
        return false;
    }

    removeStepSample(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        removePadStepSample(page, padIndex, stepIndex);
        this.markModified();
        return true;
    }

    assignStepLight(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex, animationName = '') {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        assignPadStepLight(page, padIndex, stepIndex, animationName);
        this.markModified();
        return true;
    }

    setStepLightSync(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex, sync = true) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        setPadStepLightSync(page, padIndex, stepIndex, sync);
        this.markModified();
        return true;
    }

    setStepLightDuration(padIndex = this.activePadIndex, stepIndex = this.activeStepIndex, duration = DEFAULT_LIGHT_DURATION_SEC) {
        const page = this.getCurrentPage();
        if (!page || padIndex === null) return false;
        const num = Number.parseFloat(duration);
        if (Number.isFinite(num) && num >= MIN_LIGHT_DURATION_SEC && num <= MAX_LIGHT_DURATION_SEC) {
            setPadStepLightDuration(page, padIndex, stepIndex, Math.round(num * 10) / 10);
            this.markModified();
            return true;
        }
        return false;
    }

    getPadConfig(index, getCursorFn = null) {
        const page = this.getCurrentPage();
        if (!page) return null;
        const steps = getPadSteps(page, index);
        const totalSteps = Math.max(steps.length, 1);

        if (this.studioSubMode === 'live') {
            const counterKey = `${this.activePageIndex}:${index}`;
            const currentStep = typeof getCursorFn === 'function'
                ? (getCursorFn(counterKey) % totalSteps)
                : 0;
            const stepObj = steps[currentStep] || steps[0] || {};
            return {
                soundIndex: undefined,
                counterKey,
                stepIndex: currentStep,
                totalSteps,
                soundBuffer: stepObj.soundBuffer || null,
                soundKey: `draft:${this.activePageIndex}:${index}`,
                animationName: stepObj.light || null,
                syncToSound: stepObj.lightSyncToSound ?? true,
                manualDuration: stepObj.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC
            };
        }

        const stepIdx = (index === this.activePadIndex) ? this.activeStepIndex : 0;
        const stepObj = steps[stepIdx] || steps[0] || {};
        return {
            soundIndex: undefined,
            soundBuffer: stepObj.soundBuffer || null,
            soundKey: `draft:${this.activePageIndex}:${index}`,
            animationName: stepObj.light || null,
            syncToSound: stepObj.lightSyncToSound ?? true,
            manualDuration: stepObj.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC
        };
    }
}

export const creatorSession = new ProjectCreatorSession();
