import { 
    LAUNCHPAD_PADS, 
    MAX_PROJECT_PAGES, 
    DEFAULT_LIGHT_DURATION_SEC, 
    ANIMATION_COLORS
} from './constants.js';
import { validateProject } from './projectValidator.js';

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
        lights: Array(LAUNCHPAD_PADS).fill(''),
        lightSyncToSound: Array(LAUNCHPAD_PADS).fill(true),
        lightDurations: Array(LAUNCHPAD_PADS).fill(DEFAULT_LIGHT_DURATION_SEC)
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
    const validation = validateProject(project);
    if (!validation.isValid) {
        throw new Error(validation.errors.join('; '));
    }

    return {
        folderName: id,
        configFileName: `${id}.json`,
        files,
        project
    };
}