import { 
    LAUNCHPAD_PADS, 
    MAX_PROJECT_PAGES, 
    MAX_PAD_STEPS,
    DEFAULT_LIGHT_DURATION_SEC, 
    ANIMATION_COLORS,
    DEFAULT_TARGET_DEVICE,
    normalizeTargetDevice,
    isAppAssetPath
} from './constants.js';
import { validateProject, countRgbOnlyLights } from './projectValidator.js';
import { normalizeAppearance, normalizeVisualizer, createDefaultAppearance, isFileAsset } from './appearanceModel.js';
import { createPadStep, readPagePads, writePagePads } from './projectModel.js';
import { normalizeCustomAnimations } from './customAnimationModel.js';

/**
 * Drops the color variants a target device cannot display.
 * Legacy Launchpads only support the five base colors, so RGB-only variants
 * (and any group left with no variants) are removed for a 'legacy' target.
 * @param {Array<object>} groups - Catalog groups whose `variants[].tier` marks the required hardware.
 * @param {string} [targetDevice] - 'universal' | 'legacy' | 'rgb'.
 * @returns {Array<object>} Groups compatible with the target device.
 */
export function filterCatalogByDevice(groups, targetDevice = DEFAULT_TARGET_DEVICE) {
    if (targetDevice !== 'legacy') return groups;
    return groups
        .map(group => group.variants.some(variant => variant.tier === 'rgb')
            ? { ...group, variants: group.variants.filter(variant => variant.tier !== 'rgb') }
            : group)
        .filter(group => group.variants.length > 0);
}

/**
 * Ordered LED colors an animation blends, used to paint its light swatch.
 * Prefers the explicit `swatchColors` list declared on the animation (needed by
 * color-blending names such as `eq_real` that carry no single-color suffix),
 * then falls back to the color / sequence metadata derived from the key.
 * @param {object} [anim] - Animation metadata ({ color, sequence, swatchColors }).
 * @returns {string[]} Ordered palette color names (empty when unresolved).
 */
export function resolveLightColors(anim = {}) {
    if (anim.swatchColors?.length) return anim.swatchColors;
    if (anim.sequence) return anim.sequence === 'red_to_green' ? ['red', 'green'] : ['green', 'red'];
    return anim.color ? [anim.color] : [];
}

export function buildAnimationCatalog(animationRegistry, targetDevice = DEFAULT_TARGET_DEVICE) {
    const groups = new Map();

    Object.entries(animationRegistry).forEach(([animationName, anim]) => {
        // User-drawn animations are listed separately, not as catalog groups.
        if (anim.custom) return;
        const baseName = anim.baseName || animationName;
        const category = anim.category || 'special';
        const color = anim.color ?? null;
        const sequence = anim.sequence ?? null;
        const tier = anim.tier || 'legacy';
        const supportsDuration = anim.supportsDuration ?? (anim.type === 'fixed');
        const swatchColors = resolveLightColors({ color, sequence, swatchColors: anim.swatchColors });

        if (!groups.has(baseName)) {
            groups.set(baseName, { id: baseName, category, variants: [] });
        }
        groups.get(baseName).variants.push({
            animation: animationName,
            color,
            sequence,
            tier,
            supportsDuration,
            swatchColors
        });
    });

    return filterCatalogByDevice([...groups.values()], targetDevice)
        .map(group => ({
            ...group,
            label: group.id.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
            variants: group.variants.sort((first, second) => {
                const firstOrder = first.sequence === 'red_to_green' ? 0 : first.sequence === 'green_to_red'
                    ? 1 : ANIMATION_COLORS.indexOf(first.color) + 2;
                const secondOrder = second.sequence === 'red_to_green' ? 0 : second.sequence === 'green_to_red'
                    ? 1 : ANIMATION_COLORS.indexOf(second.color) + 2;
                return firstOrder - secondOrder;
            })
        }))
        .sort((first, second) => first.label.localeCompare(second.label));
}

/**
 * A draft step is a runtime PadStep plus what only the editor needs:
 * - `sample`: the source audio File, packaged on export;
 * - `sampleToken`: bumped on every change so late decodes can be discarded.
 * Its `buffer` is the decoded `sample`, so draft steps play exactly like
 * project steps. `soundUrl` stays null: drafts reference files, not URLs.
 * @typedef {import('./projectModel.js').PadStep & {sample: (File|Blob|null), sampleToken: number}} DraftStep
 */

/**
 * @param {object} [fields] - PadStep fields plus an optional `sample`.
 * @returns {DraftStep}
 */
export function createDraftStep({ sample = null, ...padStepFields } = {}) {
    return {
        ...createPadStep({ ...padStepFields, soundUrl: null }),
        sample: sample || null,
        sampleToken: 0
    };
}

export function createProjectPage(pageNumber) {
    const padSteps = Array.from({ length: LAUNCHPAD_PADS }, () => [createDraftStep()]);
    return {
        name: `Page ${pageNumber}`,
        padSteps
    };
}

/**
 * Returns a pad's mutable step list. `padSteps` is the single source of truth:
 * the legacy page-level mirrors (samples, lights, ...) are derived only when
 * exporting, so there is nothing to reconcile here.
 * @param {object} page
 * @param {number} padIndex
 * @returns {Array<object>}
 */
export function getPadSteps(page, padIndex) {
    if (!page) return [];
    if (!page.padSteps) {
        page.padSteps = Array.from({ length: LAUNCHPAD_PADS }, () => [createDraftStep()]);
    }
    if (!page.padSteps[padIndex] || page.padSteps[padIndex].length === 0) {
        page.padSteps[padIndex] = [createDraftStep()];
    }
    return page.padSteps[padIndex];
}

export function addPadStep(page, padIndex) {
    const steps = getPadSteps(page, padIndex);
    if (steps.length >= MAX_PAD_STEPS) return steps.length - 1;
    steps.push(createDraftStep());
    return steps.length - 1;
}

export function removePadStep(page, padIndex, stepIndex) {
    const steps = getPadSteps(page, padIndex);
    if (steps.length <= 1) return false;
    if (stepIndex < 0 || stepIndex >= steps.length) return false;
    const [removedStep] = steps.splice(stepIndex, 1);
    if (removedStep) {
        removedStep.sampleToken = (removedStep.sampleToken || 0) + 1;
    }
    return true;
}

export async function assignPadStepSample(page, padIndex, stepIndex, file, decoder = null) {
    if (!page || typeof padIndex !== 'number' || padIndex < 0 || padIndex >= LAUNCHPAD_PADS || !file) {
        return 'failed';
    }
    const steps = getPadSteps(page, padIndex);
    if (stepIndex < 0 || stepIndex >= steps.length) {
        return 'failed';
    }

    const targetStep = steps[stepIndex];
    if (!targetStep.sampleToken) {
        targetStep.sampleToken = 0;
    }
    const token = ++targetStep.sampleToken;

    let buffer = null;
    if (typeof decoder === 'function') {
        try {
            buffer = await decoder(file);
        } catch (_) {
            buffer = null;
        }
    }

    const currentSteps = getPadSteps(page, padIndex);
    if (!currentSteps.includes(targetStep) || targetStep.sampleToken !== token) {
        return 'superseded';
    }

    if (!buffer) {
        return 'failed';
    }

    targetStep.sample = file;
    targetStep.buffer = buffer;

    return 'assigned';
}

export function removePadStepSample(page, padIndex, stepIndex = 0) {
    if (!page || typeof padIndex !== 'number' || padIndex < 0 || padIndex >= LAUNCHPAD_PADS) return;
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        const step = steps[stepIndex];
        if (step) {
            step.sampleToken = (step.sampleToken || 0) + 1;
            step.sample = null;
            step.buffer = null;
        }
    }
}

/**
 * Removes a light from every pad step that uses it (e.g. a deleted custom animation).
 * @param {object} draft
 * @param {string} lightName
 * @returns {number} How many steps lost the light.
 */
export function clearLightReferences(draft, lightName) {
    let cleared = 0;
    draft.pages.forEach(page => (page.padSteps || []).forEach(steps => steps.forEach(step => {
        if (step.light === lightName) {
            step.light = null;
            cleared++;
        }
    })));
    return cleared;
}

export function assignPadStepLight(page, padIndex, stepIndex, animationName) {
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        steps[stepIndex].light = animationName || null;
    }
}

export function setPadStepLightSync(page, padIndex, stepIndex, sync) {
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        steps[stepIndex].syncToSound = Boolean(sync);
    }
}

export function setPadStepLightDuration(page, padIndex, stepIndex, duration) {
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        steps[stepIndex].duration = typeof duration === 'number' && Number.isFinite(duration)
            ? duration
            : DEFAULT_LIGHT_DURATION_SEC;
    }
}

/**
 * Decodes `file` and assigns it to a pad step, guarding against the editor
 * swapping drafts while the decode is in flight. Deliberately free of DOM and
 * UI concerns so the guard is testable without touching the creator module.
 *
 * @param {object} options
 * @param {object} options.targetDraft - Draft captured when the decode started.
 * @param {object} options.page - Page (owned by `targetDraft`) that holds the pad.
 * @param {number} options.padIndex
 * @param {number} options.stepIndex
 * @param {File|Blob} options.file
 * @param {Function|null} options.decoder - Async (file) => AudioBuffer.
 * @param {Function} options.getActiveDraft - Returns the currently active draft.
 * @returns {Promise<'assigned'|'failed'|'superseded'|'stale'>} 'stale' when the
 *   active draft changed, so the caller must not re-render or mark it modified.
 */
export async function assignSampleGuarded({ targetDraft, page, padIndex, stepIndex, file, decoder, getActiveDraft }) {
    if (!file || !page) return 'failed';
    const result = await assignPadStepSample(page, padIndex, stepIndex, file, decoder);
    if (getActiveDraft() !== targetDraft) return 'stale';
    return result;
}

/**
 * Counts RGB-only lights in a draft that targets legacy hardware (see
 * checkProjectDeviceConsistency for the project-file equivalent).
 * @param {object|null} draft
 * @returns {{ rgbLightCount: number }}
 */
export function checkDraftDeviceConsistency(draft) {
    if (!draft || normalizeTargetDevice(draft.targetDevice) !== 'legacy') return { rgbLightCount: 0 };
    const lightNames = draft.pages.flatMap(page => (page.padSteps || []).flat().map(step => step.light));
    return { rgbLightCount: countRgbOnlyLights(lightNames, draft.animations || []) };
}

export function createProjectId(name) {
    const id = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return id || 'project';
}

/**
 * Normalizes a file path for consistent matching across operating systems and zip structures.
 * Converts backslashes to forward slashes, strips leading/trailing slashes, and lowercases.
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizeZipPath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return '';
    return rawPath
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Creates a new blank or initialized Studio Creator draft object.
 *
 * @param {string} [name=''] - Project name.
 * @param {Array<object>|null} [pages=null] - Project pages, defaults to 1 blank page.
 * @param {object} [options]
 * @param {string} [options.targetDevice] - 'universal' | 'legacy' | 'rgb'.
 * @param {object} [options.appearance] - Canonical appearance (see appearanceModel.js);
 *   each asset is a catalog path string, an uploaded File, or null.
 * @param {object[]} [options.animations] - Custom light animations (see customAnimationModel.js).
 * @returns {object} Draft object with changeCount and savedChangeCount tracking.
 */
export function createDraft(name = '', pages = null, { targetDevice, appearance, animations } = {}) {
    return {
        name: typeof name === 'string' ? name.trim() : '',
        targetDevice: normalizeTargetDevice(targetDevice),
        changeCount: 0,
        savedChangeCount: 0,
        pages: Array.isArray(pages) && pages.length > 0 ? pages : [createProjectPage(1)],
        // `rotation`/`size` null means "the project does not specify it", so the
        // user's personal preference must not be overwritten.
        appearance: {
            ...createDefaultAppearance(),
            ...appearance,
            visualizer: normalizeVisualizer({ visualizer: appearance?.visualizer })
        },
        animations: normalizeCustomAnimations(animations)
    };
}

/**
 * Checks if a draft has unsaved changes / modifications.
 * Directly compares changeCount with savedChangeCount.
 * @param {object|null} draft
 * @returns {boolean} True if the draft contains unsaved modifications.
 */
export function isDraftDirty(draft) {
    if (!draft) return false;
    if (typeof draft.changeCount === 'number' && typeof draft.savedChangeCount === 'number') {
        return draft.changeCount !== draft.savedChangeCount;
    }
    return false;
}

/**
 * Indexes the files of an imported archive for lookup by the paths a project
 * manifest declares, recording every declared path that cannot be found.
 * @param {Map<string, Blob|File>|Record<string, Blob|File>} fileMap
 * @returns {{getFile: (path: string) => (File|Blob|null), missingAssets: string[]}}
 */
function createArchiveLookup(fileMap) {
    const inputMap = fileMap instanceof Map ? fileMap : new Map(Object.entries(fileMap || {}));
    const missingAssets = [];
    const samplesRelative = (norm) => {
        const samplesIdx = norm.indexOf('samples/');
        return samplesIdx !== -1 ? norm.slice(samplesIdx) : null;
    };

    // Index files by exact normalized path and by their path relative to samples/
    const index = new Map();
    for (const [key, value] of inputMap.entries()) {
        const norm = normalizeZipPath(key);
        if (!norm) continue;
        index.set(norm, value);
        const relative = samplesRelative(norm);
        if (relative) index.set(relative, value);
    }

    const getFile = (lookupPath) => {
        const norm = normalizeZipPath(lookupPath);
        if (!norm) return null;
        const relative = samplesRelative(norm);
        const file = index.get(norm) ?? (relative ? index.get(relative) : undefined) ?? null;
        // Asset declared by the manifest but missing from the archive.
        if (!file) missingAssets.push(lookupPath);
        return file;
    };

    return { getFile, missingAssets };
}

/**
 * Reconstructs a Studio Creator draft from a validated project configuration
 * and the files of its archive. App-bundled assets (`assets/...`, e.g. catalog
 * videos and skins) are kept as paths; other declared assets resolve to their
 * packaged File, and a reference whose file is not in the archive is dropped
 * (and reported in `missingAssets`), so a dangling path is never re-written on
 * the next export.
 * @param {object} projectData - Project configuration object.
 * @param {Map<string, Blob|File>|Record<string, Blob|File>} fileMap - Map or object associating relative paths/filenames to files.
 * @returns {object} Reconstructed draft with pages, samples, and light configurations.
 */
export function buildDraftFromProject(projectData, fileMap = new Map()) {
    const validation = validateProject(projectData);
    if (!validation.isValid) {
        throw new Error(`Invalid project: ${validation.errors.join('; ')}`);
    }

    const { getFile, missingAssets } = createArchiveLookup(fileMap);

    const draftPages = projectData.pages.map((page, index) => {
        const draftPage = createProjectPage(index + 1);
        if (page.name && typeof page.name === 'string') {
            draftPage.name = page.name.trim();
        }
        // Editor pads always hold at least one (possibly empty) step.
        draftPage.padSteps = readPagePads(page).map(steps => steps.length === 0
            ? [createDraftStep()]
            : steps.map(({ soundUrl, ...step }) => createDraftStep({ ...step, sample: soundUrl ? getFile(soundUrl) : null })));
        return draftPage;
    });

    const draft = createDraft(projectData.name, draftPages, {
        targetDevice: projectData.targetDevice,
        appearance: normalizeAppearance(projectData, path => (isAppAssetPath(path) ? path : getFile(path))),
        animations: projectData.animations
    });
    draft.missingAssets = missingAssets;
    return draft;
}

/**
 * Where each packaged appearance asset is written, and the project field that references it.
 */
const APPEARANCE_ASSET_EXPORTS = [
    { key: 'skin', field: 'coverImage', baseName: 'cover', defaultExtension: 'png' },
    { key: 'icon', field: 'iconImage', baseName: 'icon', defaultExtension: 'png' },
    { key: 'background', field: 'backgroundMedia', baseName: 'background', defaultExtension: 'mp4' }
];

function getFileExtension(fileName, defaultExtension) {
    const match = (fileName || '').match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : defaultExtension;
}

/**
 * Writes the draft appearance into `project`, queueing uploaded files for
 * packaging. Catalog assets are kept as their path. Rotation/size are written
 * only when specified, so loading the project back does not overwrite the
 * user's personal preference.
 */
function exportAppearance(appearance, project, files) {
    APPEARANCE_ASSET_EXPORTS.forEach(({ key, field, baseName, defaultExtension }) => {
        const asset = appearance[key];
        if (isFileAsset(asset)) {
            const path = `${baseName}.${getFileExtension(asset.name, defaultExtension)}`;
            files.push({ path, file: asset });
            project[field] = path;
        } else if (typeof asset === 'string' && asset) {
            project[field] = asset;
        }
    });

    // Canonical visualizer schema: always written as a nested object.
    project.visualizer = normalizeVisualizer({ visualizer: appearance.visualizer });

    if (typeof appearance.rotation === 'number') project.launchpadRotation = appearance.rotation;
    if (typeof appearance.size === 'number') project.launchpadSize = appearance.size;
}

/**
 * Archive path of a step's sample: samples/page-<P>/pad-<NN>[_step-<SS>].<ext>
 */
function getSamplePath(sample, pageIndex, padIndex, stepIndex, stepCount) {
    if (typeof sample.name !== 'string') {
        throw new Error(`Sample at page ${pageIndex + 1}, pad ${padIndex + 1}, step ${stepIndex + 1} is invalid`);
    }
    const padNum = String(padIndex + 1).padStart(2, '0');
    const suffix = stepCount > 1 ? `_step-${String(stepIndex + 1).padStart(2, '0')}` : '';
    return `samples/page-${pageIndex + 1}/pad-${padNum}${suffix}.${getFileExtension(sample.name, 'audio')}`;
}

/**
 * Converts a draft into a project file plus the list of files to package.
 * @param {object} draft
 * @returns {{id: string, folderName: string, configFileName: string, files: Array<{path: string, file: Blob}>, project: object}}
 */
export function buildProjectExport(draft) {
    const name = typeof draft?.name === 'string' ? draft.name.trim() : '';
    if (!name) throw new Error('Project name is required');
    if (!Array.isArray(draft.pages) || draft.pages.length < 1 || draft.pages.length > MAX_PROJECT_PAGES) {
        throw new Error(`Project must have between 1 and ${MAX_PROJECT_PAGES} pages`);
    }

    const files = [];
    const pages = draft.pages.map((page, pageIndex) => {
        if (page?.padSteps?.length !== LAUNCHPAD_PADS) {
            throw new Error(`Each page must provide ${LAUNCHPAD_PADS} pad slots`);
        }

        const pads = Array.from({ length: LAUNCHPAD_PADS }, (_, padIndex) => getPadSteps(page, padIndex));
        const padFields = writePagePads(pads, (step, padIndex, stepIndex, stepCount) => {
            if (!step.sample) return '';
            const path = getSamplePath(step.sample, pageIndex, padIndex, stepIndex, stepCount);
            files.push({ path, file: step.sample });
            return path;
        });

        return {
            name: typeof page.name === 'string' && page.name.trim() ? page.name.trim() : `Page ${pageIndex + 1}`,
            ...padFields
        };
    });

    const id = createProjectId(name);
    const project = { id, name, targetDevice: normalizeTargetDevice(draft?.targetDevice), pages };
    exportAppearance(draft.appearance || createDefaultAppearance(), project, files);
    if (draft.animations?.length > 0) {
        project.animations = normalizeCustomAnimations(draft.animations);
    }

    const validation = validateProject(project);
    if (!validation.isValid) {
        throw new Error(validation.errors.join('; '));
    }

    return {
        id,
        folderName: id,
        configFileName: `${id}.json`,
        files,
        project
    };
}
