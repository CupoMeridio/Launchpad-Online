const MAX_PAGES = 8;
const PADS_PER_PAGE = 64;
export const DEFAULT_LIGHT_DURATION_SECONDS = 2.5;
export const ANIMATION_COLORS = ['red', 'green', 'amber', 'yellow', 'orange'];

export function resolveLightDuration(syncToSound, soundDuration, customDuration) {
    return syncToSound && Number.isFinite(soundDuration) && soundDuration > 0
        ? soundDuration
        : customDuration;
}

const ANIMATION_CATEGORIES = {
    basic: ['fade', 'hold'],
    geometric: ['explode', 'implode', 'cross', 'expand', 'x', 'square', 'row', 'col', 'wave', 'rotate', 'spiral'],
    directional: ['arrow', 'bounce', 'rain', 'scanline'],
    characters: ['letter', 'number', 'symbol']
};

export function getAnimationCategory(animationName) {
    if (animationName.includes('_multi_') || animationName.endsWith('_multi')) return 'multicolor';
    const family = animationName.split('_')[0];
    for (const [category, families] of Object.entries(ANIMATION_CATEGORIES)) {
        if (families.includes(family)) return category;
    }
    return 'special';
}

export function buildAnimationCatalog(animationRegistry) {
    const groups = new Map();

    Object.keys(animationRegistry).forEach(animationName => {
        const sequenceMatch = animationName.match(/^(.*)_(red_to_green|green_to_red)$/);
        const multiMatch = sequenceMatch && sequenceMatch[1].includes('_multi') ? sequenceMatch : null;
        const color = multiMatch ? null : ANIMATION_COLORS.find(name => animationName.endsWith(`_${name}`)) || null;
        const sequence = multiMatch?.[2] || null;
        const baseName = multiMatch
            ? multiMatch[1]
            : color ? animationName.slice(0, -(color.length + 1)) : animationName;
        const category = getAnimationCategory(baseName);
        if (!groups.has(baseName)) {
            groups.set(baseName, { id: baseName, category, variants: [] });
        }
        const supportsDuration = typeof animationRegistry[animationName]?.on === 'function' &&
            animationRegistry[animationName].on.length >= 3;
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
        samples: Array(PADS_PER_PAGE).fill(null),
        lights: Array(PADS_PER_PAGE).fill(''),
        lightSyncToSound: Array(PADS_PER_PAGE).fill(true),
        lightDurations: Array(PADS_PER_PAGE).fill(DEFAULT_LIGHT_DURATION_SECONDS)
    };
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

export function buildProjectExport(draft) {
    const name = typeof draft?.name === 'string' ? draft.name.trim() : '';
    if (!name) throw new Error('Project name is required');
    if (!Array.isArray(draft.pages) || draft.pages.length < 1 || draft.pages.length > MAX_PAGES) {
        throw new Error(`Project must have between 1 and ${MAX_PAGES} pages`);
    }

    const files = [];
    const pages = draft.pages.map((page, pageIndex) => {
        if (!Array.isArray(page.samples) || page.samples.length !== PADS_PER_PAGE) {
            throw new Error(`Page ${pageIndex + 1} must have ${PADS_PER_PAGE} pad slots`);
        }
        if (!Array.isArray(page.lights) || page.lights.length !== PADS_PER_PAGE ||
            page.lights.some(light => light !== '' && typeof light !== 'string')) {
            throw new Error(`Page ${pageIndex + 1} must have ${PADS_PER_PAGE} valid light assignments`);
        }
        if (!Array.isArray(page.lightSyncToSound) || page.lightSyncToSound.length !== PADS_PER_PAGE ||
            page.lightSyncToSound.some(enabled => typeof enabled !== 'boolean')) {
            throw new Error(`Page ${pageIndex + 1} must have ${PADS_PER_PAGE} light sync settings`);
        }
        if (!Array.isArray(page.lightDurations) || page.lightDurations.length !== PADS_PER_PAGE ||
            page.lightDurations.some(duration => !Number.isFinite(duration) || duration < 0.1 || duration > 60)) {
            throw new Error(`Page ${pageIndex + 1} must have ${PADS_PER_PAGE} valid light durations`);
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
            lights: [...page.lights],
            lightSyncToSound: [...page.lightSyncToSound],
            lightDurations: [...page.lightDurations]
        };
    });

    const id = createProjectId(name);
    return {
        folderName: id,
        configFileName: `${id}.json`,
        files,
        project: { id, name, pages }
    };
}