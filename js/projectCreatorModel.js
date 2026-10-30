import { 
    LAUNCHPAD_PADS, 
    MAX_PROJECT_PAGES, 
    DEFAULT_LIGHT_DURATION_SEC, 
    ANIMATION_COLORS
} from './constants.js';
import { validateProject } from './projectValidator.js';
import { normalizeVisualizer, normalizeLayout, getBackgroundMedia } from './appearanceModel.js';

export function buildAnimationCatalog(animationRegistry) {
    const groups = new Map();

    Object.entries(animationRegistry).forEach(([animationName, anim]) => {
        const baseName = anim.baseName || animationName;
        const category = anim.category || 'special';
        const color = anim.color ?? null;
        const sequence = anim.sequence ?? null;
        const supportsDuration = anim.supportsDuration ?? (anim.type === 'fixed');

        if (!groups.has(baseName)) {
            groups.set(baseName, { id: baseName, category, variants: [] });
        }
        groups.get(baseName).variants.push({
            animation: animationName,
            color,
            sequence,
            supportsDuration
        });
    });

    return [...groups.values()]
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

export function createProjectPage(pageNumber) {
    return {
        name: `Page ${pageNumber}`,
        samples: Array(LAUNCHPAD_PADS).fill(null),
        soundBuffers: Array(LAUNCHPAD_PADS).fill(null),
        sampleTokens: Array(LAUNCHPAD_PADS).fill(0),
        lights: Array(LAUNCHPAD_PADS).fill(''),
        lightSyncToSound: Array(LAUNCHPAD_PADS).fill(true),
        lightDurations: Array(LAUNCHPAD_PADS).fill(DEFAULT_LIGHT_DURATION_SEC)
    };
}

/**
 * Assigns an audio sample to a specific pad using token-based concurrency protection.
 * If superseded by a newer assignment or removal during decoding, returns 'superseded' and discards result.
 * If decode fails or buffer is null, returns 'failed' and leaves previous sample intact.
 * If successful, assigns sample and buffer and returns 'assigned'.
 * 
 * @param {object} page - The target page object.
 * @param {number} padIndex - Pad index (0..63).
 * @param {Blob|File|object} file - Audio file to decode and assign.
 * @param {Function} [decoder] - Async function (file) => Promise<AudioBuffer|any>.
 * @returns {Promise<'assigned' | 'superseded' | 'failed'>} Result of assignment.
 */
export async function assignPadSample(page, padIndex, file, decoder = null) {
    if (!page || typeof padIndex !== 'number' || padIndex < 0 || padIndex >= LAUNCHPAD_PADS || !file) {
        return 'failed';
    }
    if (!page.sampleTokens) {
        page.sampleTokens = Array(LAUNCHPAD_PADS).fill(0);
    }
    const token = ++page.sampleTokens[padIndex];

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

    // Ignore if superseded by a subsequent file selection or removal
    if (page.sampleTokens[padIndex] !== token) {
        return 'superseded';
    }

    if (!buffer) {
        return 'failed';
    }

    page.samples[padIndex] = file;
    page.soundBuffers[padIndex] = buffer;
    return 'assigned';
}

/**
 * Removes an assigned sample and buffer from a pad, incrementing the token
 * to cancel any in-flight decode.
 * 
 * @param {object} page - The target page object.
 * @param {number} padIndex - Pad index (0..63).
 */
export function removePadSample(page, padIndex) {
    if (!page || typeof padIndex !== 'number' || padIndex < 0 || padIndex >= LAUNCHPAD_PADS) {
        return;
    }
    if (!page.sampleTokens) {
        page.sampleTokens = Array(LAUNCHPAD_PADS).fill(0);
    }
    page.sampleTokens[padIndex]++;
    page.samples[padIndex] = null;
    page.soundBuffers[padIndex] = null;
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

        if (Array.isArray(page.sounds)) {
            page.sounds.slice(0, LAUNCHPAD_PADS).forEach((soundPath, padIdx) => {
                if (soundPath) {
                    const file = getFile(soundPath);
                    if (file) {
                        draftPage.samples[padIdx] = file;
                    }
                }
            });
        }

        if (Array.isArray(page.lights)) {
            page.lights.slice(0, LAUNCHPAD_PADS).forEach((light, padIdx) => {
                draftPage.lights[padIdx] = (typeof light === 'string') ? light : '';
            });
        }

        if (Array.isArray(page.lightSyncToSound)) {
            page.lightSyncToSound.slice(0, LAUNCHPAD_PADS).forEach((sync, padIdx) => {
                draftPage.lightSyncToSound[padIdx] = (typeof sync === 'boolean') ? sync : true;
            });
        }

        if (Array.isArray(page.lightDurations)) {
            page.lightDurations.slice(0, LAUNCHPAD_PADS).forEach((dur, padIdx) => {
                draftPage.lightDurations[padIdx] = (typeof dur === 'number' && Number.isFinite(dur)) ? dur : DEFAULT_LIGHT_DURATION_SEC;
            });
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
        if (!Array.isArray(page.samples) || page.samples.length !== LAUNCHPAD_PADS) {
            throw new Error(`Page ${pageIndex + 1} must have ${LAUNCHPAD_PADS} pad slots`);
        }
        const sounds = page.samples.map((file, padIndex) => {
            if (!file) return '';
            if (typeof file.name !== 'string') {
                throw new Error(`Sample at page ${pageIndex + 1}, pad ${padIndex + 1} is invalid`);
            }

            const extensionMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
            const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'audio';
            const samplePath = `samples/page-${pageIndex + 1}/pad-${String(padIndex + 1).padStart(2, '0')}.${extension}`;
            files.push({ path: samplePath, file });
            return samplePath;
        });

        return {
            name: typeof page.name === 'string' && page.name.trim() ? page.name.trim() : `Page ${pageIndex + 1}`,
            sounds,
            lights: Array.isArray(page.lights) ? [...page.lights] : new Array(LAUNCHPAD_PADS).fill(''),
            lightSyncToSound: Array.isArray(page.lightSyncToSound) ? [...page.lightSyncToSound] : new Array(LAUNCHPAD_PADS).fill(true),
            lightDurations: Array.isArray(page.lightDurations) ? [...page.lightDurations] : new Array(LAUNCHPAD_PADS).fill(DEFAULT_LIGHT_DURATION_SEC)
        };
    });

    const id = createProjectId(name);
    const project = { id, name, pages };

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