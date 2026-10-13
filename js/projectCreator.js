import { getTranslation, showNotification } from './ui.js';
import { validateProject } from './projectValidator.js';
import { buildAnimationCatalog, buildProjectExport, createProjectPage, resolveLightDuration, ANIMATION_COLORS, DEFAULT_LIGHT_DURATION_SECONDS } from './projectCreatorModel.js';
import { animations, releaseAnimation, triggerAnimation } from './lights.js';

const LIGHT_COLOR_SWATCHES = {
    red: '#ff554f',
    green: '#52d273',
    amber: '#ffbb45',
    yellow: '#e4e94b',
    orange: '#ff8a38'
};

const LIGHT_CATEGORY_KEYS = ['all', 'basic', 'geometric', 'directional', 'multicolor', 'characters', 'special', 'text'];
const DYNAMIC_TEXT_PRESETS = [
    { id: 'text', template: 'text', labelKey: 'creator.light.text' },
    { id: 'scroll', template: 'scroll', labelKey: 'creator.light.scroll' },
    { id: 'scroll_left', template: 'scroll_left', labelKey: 'creator.light.scrollLeft' },
    { id: 'scroll_right', template: 'scroll_right', labelKey: 'creator.light.scrollRight' },
    { id: 'scroll_up', template: 'scroll_up', labelKey: 'creator.light.scrollUp' },
    { id: 'scroll_down', template: 'scroll_down', labelKey: 'creator.light.scrollDown' },
    { id: 'scroll_top', template: 'scroll_top', labelKey: 'creator.light.scrollTop' },
    { id: 'scroll_bottom', template: 'scroll_bottom', labelKey: 'creator.light.scrollBottom' }
];

let initialized = false;
let draft = null;
let activePageIndex = 0;
let activePadIndex = null;
let editorActive = false;
let previewAudio = null;
let previewUrl = null;
let activeLightCategory = 'all';
let pendingTextAnimation = null;
let allAnimationGroups = null;

function getAnimationGroups() {
    if (!allAnimationGroups) {
        const animationGroups = buildAnimationCatalog(animations);
        const dynamicTextGroups = DYNAMIC_TEXT_PRESETS.map(preset => ({
            id: preset.id,
            labelKey: preset.labelKey,
            category: 'text',
            dynamicTemplate: preset.template,
            variants: ANIMATION_COLORS.map(color => ({ animation: null, color, supportsDuration: true }))
        }));
        allAnimationGroups = [...animationGroups, ...dynamicTextGroups];
    }
    return allAnimationGroups;
}

function translate(key, values = {}) {
    return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        getTranslation(key)
    );
}

function getCurrentPage() {
    return draft?.pages[activePageIndex] || null;
}

function supportsAnimationDuration(animationName) {
    if (!animationName) return false;
    if (animationName.startsWith('text_') || animationName.startsWith('scroll_')) return true;
    return getAnimationGroups().some(group => group.variants.some(variant =>
        variant.animation === animationName && variant.supportsDuration
    ));
}

function getManualLightDuration(page, padIndex) {
    return page.lightDurations[padIndex] ?? DEFAULT_LIGHT_DURATION_SECONDS;
}
function stopPreview() {
    if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        previewAudio.src = '';
        previewAudio = null;
    }
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
}

function renderPageTabs() {
    const tabs = document.getElementById('creator-page-tabs');
    tabs.replaceChildren();

    draft.pages.forEach((page, index) => {
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

    document.getElementById('creator-add-page').disabled = draft.pages.length >= 8;
    document.getElementById('creator-remove-page').disabled = draft.pages.length <= 1;
}

function renderPadGrid() {
    const page = getCurrentPage();

    document.querySelectorAll('#Launchpad .grid-item').forEach((pad, index) => {
        const sample = page.samples[index];
        const led = page.lights[index];
        pad.classList.toggle('creator-pad-assigned', !!sample || !!led);
        pad.classList.toggle('creator-pad-selected', index === activePadIndex);
        pad.setAttribute('aria-pressed', String(index === activePadIndex));
        const labels = [sample
            ? translate('creator.padAssigned', { pad: index + 1, file: sample.name })
            : translate('creator.padEmpty', { pad: index + 1 })];
        if (led) labels.push(translate('creator.padLightAssigned'));
        pad.setAttribute('aria-label', labels.join(', '));

        if (led) {
            pad.dataset.creatorLed = led;
            pad.style.setProperty('--creator-led-color', getAnimationColor(led));
        } else {
            delete pad.dataset.creatorLed;
            pad.style.removeProperty('--creator-led-color');
        }
    });
}

function renderSelectedPad() {
    const page = getCurrentPage();
    const padInspector = document.getElementById('creator-pad-inspector');
    const sampleCount = page.samples.filter(Boolean).length;
    document.getElementById('project-creator-name').value = draft.name;
    document.getElementById('creator-page-name').value = page.name;
    document.getElementById('creator-page-count').textContent = `${activePageIndex + 1} / ${draft.pages.length}`;
    document.getElementById('creator-sample-count').textContent = translate('creator.sampleCount', {
        count: sampleCount
    });

    document.getElementById('creator-project-details').hidden = activePadIndex !== null;
    padInspector.hidden = activePadIndex === null;
    document.getElementById('creator-text-animation').hidden = !pendingTextAnimation;
    if (activePadIndex === null) return;

    const sample = page.samples[activePadIndex];
    document.getElementById('creator-selected-pad').textContent = translate('creator.pad', {
        pad: activePadIndex + 1
    });
    document.getElementById('creator-sample-name').textContent = sample
        ? translate('creator.sampleAssigned', { file: sample.name })
        : getTranslation('creator.sampleEmpty');
    document.getElementById('creator-preview-pad').disabled = !sample && !page.lights[activePadIndex];
    document.getElementById('creator-remove-sample').disabled = !sample;
    document.getElementById('creator-remove-light').disabled = !page.lights[activePadIndex];
    const animation = page.lights[activePadIndex];
    const durationSupported = supportsAnimationDuration(animation);
    const timingSection = document.getElementById('creator-light-timing');
    const syncCheckbox = document.getElementById('creator-light-sync');
    timingSection.hidden = !animation;
    syncCheckbox.checked = page.lightSyncToSound[activePadIndex] ?? true;
    syncCheckbox.disabled = !durationSupported;
    document.getElementById('creator-manual-light-duration').hidden = !durationSupported || syncCheckbox.checked;
    document.getElementById('creator-light-duration-unsupported').hidden = !animation || durationSupported;
    document.getElementById('creator-light-duration').value = String(getManualLightDuration(page, activePadIndex));
    renderLightPresets();
}

function renderEditor() {
    renderPageTabs();
    renderPadGrid();
    renderSelectedPad();
}

function closeCreator() {
    editorActive = false;
    document.querySelector('.layout').classList.remove('project-editor-active');
    document.getElementById('Launchpad').classList.remove('project-editing');
    document.getElementById('toggle-project-creator').classList.remove('active');
    stopPreview();
    activePadIndex = null;
    pendingTextAnimation = null;
    renderPadGrid();
}

function openCreator() {
    if (!draft) {
        draft = { name: '', pages: [createProjectPage(1)] };
    }

    editorActive = true;
    activePageIndex = 0;
    activePadIndex = 0;
    pendingTextAnimation = null;
    document.querySelector('.layout').classList.add('project-editor-active', 'sidebar-open');
    document.getElementById('Launchpad').classList.add('project-editing');
    document.getElementById('toggle-project-creator').classList.add('active');
    renderEditor();
}

export function isProjectEditorActive() {
    return editorActive;
}

export function selectProjectPad(index) {
    if (!editorActive || !Number.isInteger(index) || index < 0 || index >= 64) return false;
    if (activePadIndex === index) {
        previewPad(index);
        return true;
    }
    stopPreview();
    pendingTextAnimation = null;
    activePadIndex = index;
    renderPadGrid();
    renderSelectedPad();
    return true;
}

function renderLightPresets() {
    const categoryContainer = document.getElementById('creator-light-categories');
    const presetContainer = document.getElementById('creator-light-presets');
    const search = document.getElementById('creator-light-search').value.trim().toLowerCase();
    const selectedLight = activePadIndex === null ? '' : getCurrentPage().lights[activePadIndex];
    const categories = document.createDocumentFragment();

    LIGHT_CATEGORY_KEYS.forEach(category => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'creator-light-category';
        button.classList.toggle('selected', activeLightCategory === category);
        button.textContent = getTranslation(`creator.animationCategory.${category}`);
        button.addEventListener('click', () => {
            activeLightCategory = category;
            renderLightPresets();
        });
        categories.appendChild(button);
    });
    categoryContainer.replaceChildren(categories);

    const groups = getAnimationGroups().filter(group => {
        const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
        const matchesCategory = activeLightCategory === 'all' || group.category === activeLightCategory;
        const matchesSearch = !search || `${groupLabel} ${group.id} ${group.variants.map(variant => `${variant.color || ''} ${variant.sequence || ''}`).join(' ')}`
            .toLowerCase().includes(search);
        return matchesCategory && matchesSearch;
    });
    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
        const card = document.createElement('section');
        card.className = 'creator-animation-group';
        const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
        const heading = document.createElement('h4');
        heading.textContent = groupLabel;
        card.appendChild(heading);

        const variants = document.createElement('div');
        variants.className = 'creator-animation-variants';
        group.variants.forEach(variant => {
            const animationName = variant.animation || group.id;
            const isDynamic = !!group.dynamicTemplate;
            const hasDirectionPrefix = DYNAMIC_TEXT_PRESETS
                .filter(preset => preset.template.startsWith('scroll_'))
                .some(preset => selectedLight.startsWith(`${preset.template}_`));
            const matchesDynamicTemplate = group.dynamicTemplate === 'scroll'
                ? selectedLight.startsWith('scroll_') && !hasDirectionPrefix
                : selectedLight.startsWith(`${group.dynamicTemplate}_`);
            const savedDynamicMatch = isDynamic && matchesDynamicTemplate &&
                selectedLight.endsWith(`_${variant.color}`);
            const isSelected = isDynamic
                ? (pendingTextAnimation?.template === group.dynamicTemplate && pendingTextAnimation.color === variant.color) || savedDynamicMatch
                : selectedLight === animationName;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'creator-animation-swatch';
            button.classList.toggle('selected', isSelected);
            const colorLabel = variant.color
                ? getTranslation(`creator.led${variant.color[0].toUpperCase()}${variant.color.slice(1)}`)
                : variant.sequence
                    ? getTranslation(`creator.light.sequence.${variant.sequence}`)
                    : groupLabel;
            button.setAttribute('aria-label', `${groupLabel} ${colorLabel}`);
            button.title = `${groupLabel} · ${colorLabel}`;

            const swatch = document.createElement('span');
            swatch.className = 'creator-light-swatch';
            if (variant.sequence) {
                const sequenceColors = variant.sequence === 'red_to_green' ? ['red', 'green'] : ['green', 'red'];
                swatch.style.background = `linear-gradient(135deg, ${LIGHT_COLOR_SWATCHES[sequenceColors[0]]}, ${LIGHT_COLOR_SWATCHES[sequenceColors[1]]})`;
                swatch.style.setProperty('--preset-color', LIGHT_COLOR_SWATCHES[sequenceColors[0]]);
            } else {
                swatch.style.setProperty('--preset-color', variant.color ? LIGHT_COLOR_SWATCHES[variant.color] : '#59bfe8');
            }
            button.appendChild(swatch);
            button.addEventListener('click', () => {
                if (isDynamic) {
                    pendingTextAnimation = { template: group.dynamicTemplate, color: variant.color };
                    document.getElementById('creator-text-animation').hidden = false;
                    document.getElementById('creator-animation-text').focus();
                    renderLightPresets();
                    return;
                }
                assignLightAnimation(animationName);
            });
            variants.appendChild(button);
        });

        card.appendChild(variants);
        fragment.appendChild(card);
    });

    if (!groups.length) {
        const empty = document.createElement('p');
        empty.className = 'creator-animation-empty';
        empty.textContent = getTranslation('creator.noAnimations');
        fragment.appendChild(empty);
    }
    presetContainer.replaceChildren(fragment);
}

function assignTextAnimation() {
    if (activePadIndex === null || !pendingTextAnimation) return;
    const text = document.getElementById('creator-animation-text').value
        .replace(/[^a-z0-9 ]/gi, '')
        .trim()
        .replace(/\s+/g, ' ');
    if (!text) {
        showNotification(getTranslation('creator.errorAnimationText'), 'warning');
        return;
    }

    const animationName = pendingTextAnimation.template === 'text'
        ? `text_${text}_${pendingTextAnimation.color}`
        : `${pendingTextAnimation.template}_${text}_${pendingTextAnimation.color}`;
    pendingTextAnimation = null;
    document.getElementById('creator-animation-text').value = '';
    document.getElementById('creator-text-animation').hidden = true;
    assignLightAnimation(animationName);
}

export function clearProjectPadSelection() {
    if (!editorActive) return false;
    stopPreview();
    pendingTextAnimation = null;
    activePadIndex = null;
    renderPadGrid();
    renderSelectedPad();
    return true;
}

export function selectProjectPage(index) {
    if (!editorActive || !Number.isInteger(index) || index < 0 || index >= draft.pages.length) return false;
    stopPreview();
    pendingTextAnimation = null;
    activePageIndex = index;
    activePadIndex = null;
    renderEditor();
    return true;
}

function assignSample(file) {
    if (!file || activePadIndex === null) return;
    stopPreview();
    getCurrentPage().samples[activePadIndex] = file;
    renderPadGrid();
    renderSelectedPad();
}

function chooseSample() {
    document.getElementById('creator-sample-file').click();
}

function previewPad(index = activePadIndex) {
    if (index === null || !getCurrentPage()) return;
    stopPreview();
    const page = getCurrentPage();
    const animation = page.lights[index];
    const sample = page.samples[index];
    const manualDuration = getManualLightDuration(page, index);
    const durationSupported = supportsAnimationDuration(animation);
    const playAnimation = soundDuration => {
        if (!animation) return;
        const duration = resolveLightDuration(
            page.lightSyncToSound[index] && durationSupported,
            soundDuration,
            manualDuration
        );
        triggerAnimation(animation, index % 8, Math.floor(index / 8), duration);
    };

    if (sample) {
        previewUrl = URL.createObjectURL(sample);
        previewAudio = new Audio(previewUrl);
        if (page.lightSyncToSound[index] && durationSupported) {
            if (Number.isFinite(previewAudio.duration) && previewAudio.duration > 0) {
                playAnimation(previewAudio.duration);
            } else {
                previewAudio.addEventListener('loadedmetadata', () => {
                    if (previewAudio) playAnimation(previewAudio.duration);
                }, { once: true });
                previewAudio.addEventListener('error', () => playAnimation(0), { once: true });
            }
        } else {
            playAnimation(0);
        }
        previewAudio.addEventListener('ended', stopPreview, { once: true });
        previewAudio.play().catch(() => {
            stopPreview();
            showNotification(getTranslation('creator.errorPreview'), 'error');
        });
    } else {
        playAnimation(0);
    }
}

async function writeFile(directoryHandle, fileName, contents) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
}

async function writeProjectFiles(projectDirectory, files) {
    for (const entry of files) {
        const segments = entry.path.split('/');
        const fileName = segments.pop();
        let targetDirectory = projectDirectory;

        for (const segment of segments) {
            targetDirectory = await targetDirectory.getDirectoryHandle(segment, { create: true });
        }

        await writeFile(targetDirectory, fileName, entry.file);
    }
}

async function exportProject() {
    const exportButton = document.getElementById('creator-export');
    if (!window.showDirectoryPicker) {
        showNotification(getTranslation('creator.errorUnsupported'), 'error');
        return;
    }
    exportButton.disabled = true;

    try {
        draft.name = document.getElementById('project-creator-name').value;
        if (!draft.name.trim()) {
            showNotification(getTranslation('creator.errorName'), 'warning');
            return;
        }
        const exportData = buildProjectExport(draft);
        const validation = validateProject(exportData.project);
        if (!validation.isValid) throw new Error(validation.errors.join('; '));

        const parentDirectory = await window.showDirectoryPicker({
            id: 'launchpad-project-export',
            mode: 'readwrite'
        });

        let existingDirectory = false;
        try {
            await parentDirectory.getDirectoryHandle(exportData.folderName);
            existingDirectory = true;
        } catch (error) {
            if (error.name !== 'NotFoundError') throw error;
        }

        if (existingDirectory) {
            const confirmation = translate('creator.confirmOverwrite', { folder: exportData.folderName });
            if (!window.confirm(confirmation)) return;
            await parentDirectory.removeEntry(exportData.folderName, { recursive: true });
        }

        const projectDirectory = await parentDirectory.getDirectoryHandle(exportData.folderName, { create: true });
        await writeProjectFiles(projectDirectory, exportData.files);
        await writeFile(projectDirectory, exportData.configFileName, JSON.stringify(exportData.project, null, 2));
        showNotification(getTranslation('creator.exportSuccess'), 'success', 5000);
        closeCreator();
        draft = null;
    } catch (error) {
        if (error.name !== 'AbortError') {
            showNotification(translate('creator.errorExport', { error: error.message }), 'error', 6000);
        }
    } finally {
        exportButton.disabled = false;
    }
}

export function initializeProjectCreator() {
    if (initialized) return;
    initialized = true;

    if (!document.getElementById('project-inspector')) return;

    document.getElementById('toggle-project-creator').addEventListener('click', () => {
        if (editorActive) closeCreator();
        else openCreator();
    });
    document.getElementById('creator-close').addEventListener('click', closeCreator);
    document.getElementById('creator-project-settings').addEventListener('click', clearProjectPadSelection);
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && editorActive) closeCreator();
    });

    document.getElementById('project-creator-name').addEventListener('input', event => {
        if (draft) draft.name = event.target.value;
    });
    document.getElementById('creator-page-name').addEventListener('input', event => {
        const page = getCurrentPage();
        if (page) {
            page.name = event.target.value;
            renderPageTabs();
        }
    });
    document.getElementById('creator-add-page').addEventListener('click', () => {
        if (draft.pages.length >= 8) return;
        stopPreview();
        draft.pages.push(createProjectPage(draft.pages.length + 1));
        activePageIndex = draft.pages.length - 1;
        activePadIndex = null;
        renderEditor();
    });
    document.getElementById('creator-remove-page').addEventListener('click', () => {
        if (draft.pages.length <= 1) return;
        stopPreview();
        draft.pages.splice(activePageIndex, 1);
        activePageIndex = Math.min(activePageIndex, draft.pages.length - 1);
        activePadIndex = null;
        renderEditor();
    });

    document.getElementById('creator-import-sound').addEventListener('click', chooseSample);
    document.getElementById('creator-light-search').addEventListener('input', renderLightPresets);
    document.getElementById('creator-assign-text-animation').addEventListener('click', assignTextAnimation);
    document.getElementById('creator-sample-file').addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        assignSample(file);
        event.target.value = '';
    });
    document.getElementById('creator-preview-pad').addEventListener('click', () => previewPad());
    document.getElementById('creator-remove-sample').addEventListener('click', () => {
        if (activePadIndex === null) return;
        stopPreview();
        getCurrentPage().samples[activePadIndex] = null;
        renderPadGrid();
        renderSelectedPad();
    });
    document.getElementById('creator-remove-light').addEventListener('click', () => {
        if (activePadIndex === null) return;
        getCurrentPage().lights[activePadIndex] = '';
        renderPadGrid();
        renderSelectedPad();
    });
    const syncCheckbox = document.getElementById('creator-light-sync');
    syncCheckbox.addEventListener('change', () => {
        if (activePadIndex === null) return;
        const page = getCurrentPage();
        if (!page) return;
        page.lightSyncToSound[activePadIndex] = syncCheckbox.checked;
        const animation = page.lights[activePadIndex];
        const durationSupported = supportsAnimationDuration(animation);
        document.getElementById('creator-manual-light-duration').hidden = !durationSupported || syncCheckbox.checked;
    });

    const durationInput = document.getElementById('creator-light-duration');
    const updateManualDuration = () => {
        if (activePadIndex === null) return;
        const page = getCurrentPage();
        if (!page) return;
        const val = parseFloat(durationInput.value);
        if (Number.isFinite(val) && val >= 0.1 && val <= 60) {
            page.lightDurations[activePadIndex] = Math.round(val * 10) / 10;
        }
    };
    durationInput.addEventListener('input', updateManualDuration);
    durationInput.addEventListener('change', () => {
        if (activePadIndex === null) return;
        const page = getCurrentPage();
        if (!page) return;
        const val = parseFloat(durationInput.value);
        if (Number.isFinite(val) && val >= 0.1 && val <= 60) {
            page.lightDurations[activePadIndex] = Math.round(val * 10) / 10;
        } else {
            durationInput.value = String(getManualLightDuration(page, activePadIndex));
        }
    });

    document.getElementById('creator-export').addEventListener('click', exportProject);
}

function getAnimationColor(animationName) {
    const color = ANIMATION_COLORS.find(name => animationName.endsWith(`_${name}`));
    return color ? LIGHT_COLOR_SWATCHES[color] : '#59bfe8';
}

function previewAnimation(animationName, index) {
    const page = getCurrentPage();
    const duration = page ? getManualLightDuration(page, index) : DEFAULT_LIGHT_DURATION_SECONDS;
    const x = index % 8;
    const y = Math.floor(index / 8);
    triggerAnimation(animationName, x, y, duration);
    if (animations[animationName]?.type === 'momentary') {
        window.setTimeout(() => releaseAnimation(animationName, x, y), 900);
    }
}

function assignLightAnimation(animationName) {
    if (activePadIndex === null) return;
    pendingTextAnimation = null;
    document.getElementById('creator-text-animation').hidden = true;
    getCurrentPage().lights[activePadIndex] = animationName;
    renderPadGrid();
    renderSelectedPad();
    if (animationName) previewAnimation(animationName, activePadIndex);
}