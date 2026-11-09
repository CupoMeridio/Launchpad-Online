import { 
    LAUNCHPAD_PADS, 
    MAX_PROJECT_PAGES, 
    MAX_PAD_STEPS,
    DEFAULT_LIGHT_DURATION_SEC, 
    ANIMATION_COLORS,
    DEFAULT_TARGET_DEVICE,
    normalizeTargetDevice
} from './constants.js';
import { validateProject } from './projectValidator.js';
import { normalizeVisualizer, normalizeLayout, getBackgroundMedia } from './appearanceModel.js';

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

export function createEmptyPadStep() {
    return {
        sample: null,
        soundBuffer: null,
        sampleToken: 0,
        light: '',
        lightSyncToSound: true,
        lightDuration: DEFAULT_LIGHT_DURATION_SEC
    };
}

export function createProjectPage(pageNumber) {
    const padSteps = Array.from({ length: LAUNCHPAD_PADS }, () => [createEmptyPadStep()]);
    return {
        name: `Page ${pageNumber}`,
        padSteps,
        samples: Array(LAUNCHPAD_PADS).fill(null),
        soundBuffers: Array(LAUNCHPAD_PADS).fill(null),
        sampleTokens: Array(LAUNCHPAD_PADS).fill(0),
        lights: Array(LAUNCHPAD_PADS).fill(''),
        lightSyncToSound: Array(LAUNCHPAD_PADS).fill(true),
        lightDurations: Array(LAUNCHPAD_PADS).fill(DEFAULT_LIGHT_DURATION_SEC)
    };
}

export function getPadSteps(page, padIndex) {
    if (!page) return [];
    if (!page.padSteps) {
        page.padSteps = Array.from({ length: LAUNCHPAD_PADS }, (_, i) => [{
            sample: page.samples?.[i] || null,
            soundBuffer: page.soundBuffers?.[i] || null,
            light: page.lights?.[i] || '',
            lightSyncToSound: page.lightSyncToSound?.[i] ?? true,
            lightDuration: page.lightDurations?.[i] ?? DEFAULT_LIGHT_DURATION_SEC
        }]);
    }
    if (!page.padSteps[padIndex] || page.padSteps[padIndex].length === 0) {
        page.padSteps[padIndex] = [{
            sample: page.samples?.[padIndex] || null,
            soundBuffer: page.soundBuffers?.[padIndex] || null,
            light: page.lights?.[padIndex] || '',
            lightSyncToSound: page.lightSyncToSound?.[padIndex] ?? true,
            lightDuration: page.lightDurations?.[padIndex] ?? DEFAULT_LIGHT_DURATION_SEC
        }];
    }
    // Reflect mutations between step-0 and legacy page-level mirrors
    if (page.padSteps[padIndex]?.[0]) {
        const step0 = page.padSteps[padIndex][0];
        if (page.samples) {
            if (page.samples[padIndex] && page.samples[padIndex] !== step0.sample) {
                step0.sample = page.samples[padIndex];
            } else if (step0.sample) {
                page.samples[padIndex] = step0.sample;
            }
        }
        if (page.soundBuffers) {
            if (page.soundBuffers[padIndex] && page.soundBuffers[padIndex] !== step0.soundBuffer) {
                step0.soundBuffer = page.soundBuffers[padIndex];
            } else if (step0.soundBuffer) {
                page.soundBuffers[padIndex] = step0.soundBuffer;
            }
        }
        if (page.lights) {
            if (page.lights[padIndex] && page.lights[padIndex] !== step0.light) {
                step0.light = page.lights[padIndex];
            } else if (step0.light) {
                page.lights[padIndex] = step0.light;
            }
        }
        if (page.lightSyncToSound) {
            if (page.lightSyncToSound[padIndex] === false) {
                step0.lightSyncToSound = false;
            } else if (step0.lightSyncToSound === false) {
                page.lightSyncToSound[padIndex] = false;
            }
        }
        if (page.lightDurations) {
            if (typeof page.lightDurations[padIndex] === 'number' && page.lightDurations[padIndex] !== DEFAULT_LIGHT_DURATION_SEC) {
                step0.lightDuration = page.lightDurations[padIndex];
            } else if (typeof step0.lightDuration === 'number' && step0.lightDuration !== DEFAULT_LIGHT_DURATION_SEC) {
                page.lightDurations[padIndex] = step0.lightDuration;
            }
        }
    }
    return page.padSteps[padIndex];
}

export function addPadStep(page, padIndex) {
    const steps = getPadSteps(page, padIndex);
    if (steps.length >= MAX_PAD_STEPS) return steps.length - 1;
    steps.push(createEmptyPadStep());
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
    // Sync step 0 mirror
    if (page.samples) page.samples[padIndex] = steps[0]?.sample || null;
    if (page.soundBuffers) page.soundBuffers[padIndex] = steps[0]?.soundBuffer || null;
    if (page.lights) page.lights[padIndex] = steps[0]?.light || '';
    if (page.lightSyncToSound) page.lightSyncToSound[padIndex] = steps[0]?.lightSyncToSound ?? true;
    if (page.lightDurations) page.lightDurations[padIndex] = steps[0]?.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC;
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

    if (stepIndex === 0) {
        if (!page.sampleTokens) {
            page.sampleTokens = Array(LAUNCHPAD_PADS).fill(0);
        }
        page.sampleTokens[padIndex]++;
    }

    let buffer = null;
    if (typeof decoder === 'function') {
        try {
            buffer = await decoder(file);
        } catch (_) {
            buffer = null;
        }
    } else if (file && file.soundBuffer) {
        buffer = file.soundBuffer;
    }

    const currentSteps = getPadSteps(page, padIndex);
    if (!currentSteps.includes(targetStep) || targetStep.sampleToken !== token) {
        return 'superseded';
    }

    if (!buffer) {
        return 'failed';
    }

    targetStep.sample = file;
    targetStep.soundBuffer = buffer;

    if (currentSteps[0] === targetStep) {
        if (page.samples) page.samples[padIndex] = file;
        if (page.soundBuffers) page.soundBuffers[padIndex] = buffer;
    }

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
            step.soundBuffer = null;
        }
    }

    if (stepIndex === 0) {
        if (!page.sampleTokens) {
            page.sampleTokens = Array(LAUNCHPAD_PADS).fill(0);
        }
        page.sampleTokens[padIndex]++;
        if (page.samples) page.samples[padIndex] = null;
        if (page.soundBuffers) page.soundBuffers[padIndex] = null;
    }
}

export function assignPadStepLight(page, padIndex, stepIndex, animationName) {
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        steps[stepIndex].light = animationName || '';
        if (stepIndex === 0 && page.lights) {
            page.lights[padIndex] = steps[0].light;
        }
    }
}

export function setPadStepLightSync(page, padIndex, stepIndex, sync) {
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        steps[stepIndex].lightSyncToSound = Boolean(sync);
        if (stepIndex === 0 && page.lightSyncToSound) {
            page.lightSyncToSound[padIndex] = steps[0].lightSyncToSound;
        }
    }
}

export function setPadStepLightDuration(page, padIndex, stepIndex, duration) {
    const steps = getPadSteps(page, padIndex);
    if (stepIndex >= 0 && stepIndex < steps.length) {
        steps[stepIndex].lightDuration = typeof duration === 'number' && Number.isFinite(duration)
            ? duration
            : DEFAULT_LIGHT_DURATION_SEC;
        if (stepIndex === 0 && page.lightDurations) {
            page.lightDurations[padIndex] = steps[0].lightDuration;
        }
    }
}

export async function assignPadSample(page, padIndex, file, decoder = null) {
    return assignPadStepSample(page, padIndex, 0, file, decoder);
}

export function removePadSample(page, padIndex) {
    removePadStepSample(page, padIndex, 0);
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
 * @param {object} [theme={}] - Project theme & visual options.
 * @returns {object} Draft object with changeCount and savedChangeCount tracking.
 */
export function createDraft(name = '', pages = null, theme = {}) {
    const visualizer = normalizeVisualizer(theme);
    const layout = normalizeLayout(theme);
    const backgroundMedia = getBackgroundMedia(theme);

    return {
        name: typeof name === 'string' ? name.trim() : '',
        targetDevice: normalizeTargetDevice(theme?.targetDevice),
        changeCount: 0,
        savedChangeCount: 0,
        pages: Array.isArray(pages) && pages.length > 0 ? pages : [createProjectPage(1)],
        coverImage: typeof theme?.coverImage === 'string' ? theme.coverImage : '',
        iconImage: typeof theme?.iconImage === 'string' ? theme.iconImage : '',
        backgroundMedia: typeof backgroundMedia === 'string' ? backgroundMedia : '',
        visualizerMode: visualizer.mode,
        visualizerColor1: visualizer.color1,
        visualizerColor2: visualizer.color2,
        visualizerGradient: visualizer.gradient,
        visualizerGradientDirection: visualizer.gradientDirection,
        // `null` means "the project does not specify it" so the user's personal
        // rotation/size preference must not be overwritten.
        launchpadRotation: layout.rotation,
        launchpadSize: layout.size,
        customCoverFile: theme?.customCoverFile || null,
        customIconFile: theme?.customIconFile || null,
        customBackgroundFile: theme?.customBackgroundFile || null
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
 * Reconstructs a Studio Creator draft object from a validated project configuration and file map.
 * @param {object} projectData - Project configuration object.
 * @param {Map<string, Blob|File>|Record<string, Blob|File>} fileMap - Map or object associating relative paths/filenames to sample files.
 * @returns {object} Reconstructed draft with pages, samples, and light configurations.
 */
export function buildDraftFromProject(projectData, fileMap = new Map()) {
    const validation = validateProject(projectData);
    if (!validation.isValid) {
        throw new Error(`Invalid project: ${validation.errors.join('; ')}`);
    }

    // Assets declared by the manifest but not present in the archive.
    const missingAssets = [];

    const inputMap = fileMap instanceof Map ? fileMap : new Map(Object.entries(fileMap || {}));

    // Index files by exact normalized path and relative from samples/
    const exactMap = new Map();

    for (const [key, value] of inputMap.entries()) {
        const norm = normalizeZipPath(key);
        if (!norm) continue;
        exactMap.set(norm, value);

        const samplesIdx = norm.indexOf('samples/');
        if (samplesIdx !== -1) {
            exactMap.set(norm.slice(samplesIdx), value);
        }
    }

    const getFile = (lookupPath) => {
        if (!lookupPath || typeof lookupPath !== 'string') return null;
        const norm = normalizeZipPath(lookupPath);
        if (!norm) return null;

        // 1. Exact normalized path match
        if (exactMap.has(norm)) return exactMap.get(norm);

        // 2. Relative from samples/
        const samplesIdx = norm.indexOf('samples/');
        if (samplesIdx !== -1) {
            const sub = norm.slice(samplesIdx);
            if (exactMap.has(sub)) return exactMap.get(sub);
        }

        // Asset declared by the manifest but missing from the archive.
        missingAssets.push(lookupPath);
        return null;
    };

    const draftPages = projectData.pages.map((page, index) => {
        const draftPage = createProjectPage(index + 1);
        if (page.name && typeof page.name === 'string') {
            draftPage.name = page.name.trim();
        }

        for (let padIdx = 0; padIdx < LAUNCHPAD_PADS; padIdx++) {
            const rawSound = page.sounds?.[padIdx];
            const rawLight = page.lights?.[padIdx];
            const rawSync = page.lightSyncToSound?.[padIdx];
            const rawDur = page.lightDurations?.[padIdx];

            const soundSteps = Array.isArray(rawSound) ? rawSound : (rawSound ? [rawSound] : []);
            const lightSteps = Array.isArray(rawLight) ? rawLight : (rawLight ? [rawLight] : []);
            const syncSteps = Array.isArray(rawSync) ? rawSync : (typeof rawSync === 'boolean' ? [rawSync] : []);
            const durSteps = Array.isArray(rawDur) ? rawDur : (typeof rawDur === 'number' ? [rawDur] : []);

            const totalSteps = Math.max(soundSteps.length, lightSteps.length, 1);
            const steps = [];

            for (let s = 0; s < totalSteps; s++) {
                const soundPath = soundSteps[s] || '';
                const sampleFile = soundPath ? getFile(soundPath) : null;
                const light = lightSteps[s] || '';
                const sync = syncSteps[s] !== undefined ? syncSteps[s] : true;
                const dur = (typeof durSteps[s] === 'number' && Number.isFinite(durSteps[s])) ? durSteps[s] : DEFAULT_LIGHT_DURATION_SEC;

                steps.push({
                    sample: sampleFile,
                    soundBuffer: null,
                    sampleToken: 0,
                    light,
                    lightSyncToSound: sync,
                    lightDuration: dur
                });
            }

            draftPage.padSteps[padIdx] = steps;
            draftPage.samples[padIdx] = steps[0]?.sample || null;
            draftPage.lights[padIdx] = steps[0]?.light || '';
            draftPage.lightSyncToSound[padIdx] = steps[0]?.lightSyncToSound ?? true;
            draftPage.lightDurations[padIdx] = steps[0]?.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC;
        }

        return draftPage;
    });

    const bgSource = getBackgroundMedia(projectData);
    const visualizer = normalizeVisualizer(projectData);
    const layout = normalizeLayout(projectData);
    // Declared theme paths are kept only when the matching file was packaged; a
    // dangling reference would otherwise be re-written on the next export.
    const coverFile = typeof projectData.coverImage === 'string' ? getFile(projectData.coverImage) : null;
    const iconFile = typeof projectData.iconImage === 'string' ? getFile(projectData.iconImage) : null;
    const backgroundFile = typeof bgSource === 'string' ? getFile(bgSource) : null;

    const theme = {
        targetDevice: normalizeTargetDevice(projectData.targetDevice),
        coverImage: coverFile ? projectData.coverImage : '',
        iconImage: iconFile ? projectData.iconImage : '',
        backgroundMedia: backgroundFile ? bgSource : '',
        visualizerMode: visualizer.mode,
        visualizerColor1: visualizer.color1,
        visualizerColor2: visualizer.color2,
        visualizerGradient: visualizer.gradient,
        visualizerGradientDirection: visualizer.gradientDirection,
        launchpadRotation: layout.rotation,
        launchpadSize: layout.size,
        customCoverFile: coverFile,
        customIconFile: iconFile,
        customBackgroundFile: backgroundFile
    };

    const draft = createDraft(projectData.name, draftPages, theme);
    draft.missingAssets = missingAssets;
    return draft;
}

export function buildProjectExport(draft) {
    const name = typeof draft?.name === 'string' ? draft.name.trim() : '';
    if (!name) throw new Error('Project name is required');
    if (!Array.isArray(draft.pages) || draft.pages.length < 1 || draft.pages.length > MAX_PROJECT_PAGES) {
        throw new Error(`Project must have between 1 and ${MAX_PROJECT_PAGES} pages`);
    }

    const files = [];
    const pages = draft.pages.map((page, pageIndex) => {
        const padCount = page?.padSteps?.length ?? page?.samples?.length;
        if (padCount !== LAUNCHPAD_PADS) {
            throw new Error(`Each page must provide ${LAUNCHPAD_PADS} pad slots`);
        }

        const sounds = [];
        const lights = [];
        const lightSyncToSound = [];
        const lightDurations = [];

        for (let padIndex = 0; padIndex < LAUNCHPAD_PADS; padIndex++) {
            const steps = getPadSteps(page, padIndex);
            const padNum = String(padIndex + 1).padStart(2, '0');

            const hasAnyContent = steps.some(st => st.sample || st.light);
            if (!hasAnyContent) {
                sounds.push([]);
                lights.push([]);
                lightSyncToSound.push([]);
                lightDurations.push([]);
                continue;
            }

            const stepSounds = [];
            const stepLights = [];
            const stepSyncs = [];
            const stepDurs = [];

            steps.forEach((step, stepIndex) => {
                let samplePath = '';
                if (step.sample) {
                    if (typeof step.sample.name !== 'string') {
                        throw new Error(`Sample at page ${pageIndex + 1}, pad ${padIndex + 1}, step ${stepIndex + 1} is invalid`);
                    }
                    const extensionMatch = step.sample.name.match(/\.([a-zA-Z0-9]+)$/);
                    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'audio';
                    const suffix = steps.length > 1 ? `_step-${String(stepIndex + 1).padStart(2, '0')}` : '';
                    samplePath = `samples/page-${pageIndex + 1}/pad-${padNum}${suffix}.${extension}`;
                    files.push({ path: samplePath, file: step.sample });
                }
                stepSounds.push(samplePath);
                stepLights.push(step.light || '');
                stepSyncs.push(step.lightSyncToSound ?? true);
                stepDurs.push(step.lightDuration ?? DEFAULT_LIGHT_DURATION_SEC);
            });

            sounds.push(stepSounds);
            lights.push(stepLights);
            lightSyncToSound.push(stepSyncs);
            lightDurations.push(stepDurs);
        }

        return {
            name: typeof page.name === 'string' && page.name.trim() ? page.name.trim() : `Page ${pageIndex + 1}`,
            sounds,
            lights,
            lightSyncToSound,
            lightDurations
        };
    });

    const id = createProjectId(name);
    const targetDevice = normalizeTargetDevice(draft?.targetDevice);
    const project = { id, name, targetDevice, pages };

    const getFileExt = (fileName, defaultExt) => {
        const match = (fileName || '').match(/\.([a-zA-Z0-9]+)$/);
        return match ? match[1].toLowerCase() : defaultExt;
    };

    if (draft?.customCoverFile) {
        const ext = getFileExt(draft.customCoverFile.name, 'png');
        const coverPath = `cover.${ext}`;
        files.push({ path: coverPath, file: draft.customCoverFile });
        project.coverImage = coverPath;
    } else if (typeof draft?.coverImage === 'string' && draft.coverImage) {
        project.coverImage = draft.coverImage;
    }

    if (draft?.customIconFile) {
        const ext = getFileExt(draft.customIconFile.name, 'png');
        const iconPath = `icon.${ext}`;
        files.push({ path: iconPath, file: draft.customIconFile });
        project.iconImage = iconPath;
    } else if (typeof draft?.iconImage === 'string' && draft.iconImage) {
        project.iconImage = draft.iconImage;
    }

    if (draft?.customBackgroundFile) {
        const ext = getFileExt(draft.customBackgroundFile.name, 'mp4');
        const bgPath = `background.${ext}`;
        files.push({ path: bgPath, file: draft.customBackgroundFile });
        project.backgroundMedia = bgPath;
    } else if (typeof draft?.backgroundMedia === 'string' && draft.backgroundMedia) {
        project.backgroundMedia = draft.backgroundMedia;
    }

    // Canonical visualizer schema: always written as a nested object.
    project.visualizer = normalizeVisualizer(draft);

    // Rotation/size are only exported when the project explicitly defines them,
    // so loading it back does not overwrite the user's personal preference.
    if (typeof draft?.launchpadRotation === 'number') {
        project.launchpadRotation = draft.launchpadRotation;
    }
    if (typeof draft?.launchpadSize === 'number') {
        project.launchpadSize = draft.launchpadSize;
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