/**
 * LIGHT PICKER (creator/lightPicker.js)
 *
 * Animation catalog, light presets (categories, search, swatches), dynamic text
 * animations and the helpers that describe/colour a light.
 */

import {
    ANIMATION_COLORS,
    ANIMATION_COLOR_TIERS,
    DEFAULT_ANIMATION_SWATCH_COLOR,
    DEFAULT_LIGHT_DURATION_SEC,
    DEFAULT_TARGET_DEVICE,
    LAUNCHPAD_COLS,
    getColorFromAnimationName
} from '../constants.js';
import { getTranslation } from '../i18n.js';
import { animations, releaseAnimation, triggerAnimation } from '../lights.js';
import { showNotification } from '../notifications.js';
import {
    buildAnimationCatalog,
    filterCatalogByDevice,
    getPadSteps,
    resolveLightColors
} from '../projectCreatorModel.js';
import { creatorSession } from '../projectCreatorState.js';
import { webColorMap } from '../webInterface.js';
import { listen, setProps } from './dom.js';

// Swatch previews derive from the shared palette so the two can never drift apart.
const LIGHT_COLOR_SWATCHES = Object.fromEntries(
    ANIMATION_COLORS.map(color => [color, webColorMap[color].baseColor])
);

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

// Animation groups (static catalog + dynamic text presets), built once.
let allAnimationGroups = null;

// Swatch rendering caches to avoid recreating ~2900 DOM nodes on non-structural updates
let lastRenderedCategory = null;
let lastRenderedSearch = null;
let lastRenderedTargetDevice = null;

function getAnimationGroups() {
    if (!allAnimationGroups) {
        const animationGroups = buildAnimationCatalog(animations);
        const dynamicTextGroups = DYNAMIC_TEXT_PRESETS.map(preset => ({
            id: preset.id,
            labelKey: preset.labelKey,
            category: 'text',
            dynamicTemplate: preset.template,
            variants: ANIMATION_COLORS.map(color => ({ animation: null, color, tier: ANIMATION_COLOR_TIERS[color], supportsDuration: true }))
        }));
        allAnimationGroups = [...animationGroups, ...dynamicTextGroups];
    }
    return allAnimationGroups;
}

function getManualLightDuration(page, padIndex, stepIndex) {
    const steps = getPadSteps(page, padIndex);
    const step = steps[stepIndex] || steps[0];
    return step?.duration ?? DEFAULT_LIGHT_DURATION_SEC;
}

function isSwatchSelected(selectedLight, isDynamic, template, color, animationName) {
    const pendingTextAnimation = creatorSession.getPendingTextAnimation();
    if (!selectedLight && !pendingTextAnimation) return false;
    if (isDynamic) {
        const hasDirectionPrefix = DYNAMIC_TEXT_PRESETS
            .filter(preset => preset.template.startsWith('scroll_'))
            .some(preset => selectedLight.startsWith(`${preset.template}_`));
        const matchesDynamicTemplate = template === 'scroll'
            ? selectedLight.startsWith('scroll_') && !hasDirectionPrefix
            : selectedLight.startsWith(`${template}_`);
        const savedDynamicMatch = matchesDynamicTemplate && selectedLight.endsWith(`_${color}`);
        return (pendingTextAnimation?.template === template && pendingTextAnimation.color === color) || savedDynamicMatch;
    }
    return selectedLight === animationName;
}

export function getAnimationDisplayName(animationName) {
    if (!animationName) return '';
    if (animationName.startsWith('scroll_')) {
        const parts = animationName.split('_');
        return `Scroll "${parts.slice(1, -1).join(' ')}"`;
    }
    if (animationName.startsWith('text_')) {
        const parts = animationName.split('_');
        return `Text "${parts.slice(1, -1).join(' ')}"`;
    }
    for (const group of getAnimationGroups()) {
        const variant = group.variants.find(v => v.animation === animationName || group.id === animationName);
        if (variant) {
            const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
            const colorLabel = variant.color
                ? getTranslation(`creator.led${variant.color[0].toUpperCase()}${variant.color.slice(1)}`)
                : variant.sequence
                    ? getTranslation(`creator.light.sequence.${variant.sequence}`)
                    : '';
            return colorLabel ? `${groupLabel} · ${colorLabel}` : groupLabel;
        }
    }
    return animationName.replace(/_/g, ' ');
}

export function syncTextAnimationBox() {
    setProps('creator-text-animation', { hidden: !creatorSession.getPendingTextAnimation() });
}

function renderLightCategoryTabs(categoryContainer, activeLightCategory) {
    if (categoryContainer.children.length === 0) {
        const categories = document.createDocumentFragment();
        LIGHT_CATEGORY_KEYS.forEach(category => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'creator-light-category';
            button.dataset.category = category;
            button.classList.toggle('selected', activeLightCategory === category);
            button.textContent = getTranslation(`creator.animationCategory.${category}`);
            button.addEventListener('click', () => {
                creatorSession.setActiveLightCategory(category);
            });
            categories.appendChild(button);
        });
        categoryContainer.replaceChildren(categories);
    } else {
        categoryContainer.querySelectorAll('.creator-light-category').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.category === activeLightCategory);
        });
    }
}

function renderAnimationVariantSwatch(variant, group, groupLabel, selectedLight) {
    const animationName = variant.animation || group.id;
    const isDynamic = !!group.dynamicTemplate;
    const isSelected = isSwatchSelected(
        selectedLight,
        isDynamic,
        group.dynamicTemplate,
        variant.color,
        animationName
    );

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'creator-animation-swatch';
    if (variant.tier === 'rgb') {
        button.classList.add('is-rgb');
    }
    button.classList.toggle('selected', isSelected);
    button.dataset.isDynamic = String(isDynamic);
    if (isDynamic) {
        button.dataset.template = group.dynamicTemplate;
        button.dataset.color = variant.color;
    }
    button.dataset.animation = animationName;

    const colorLabel = variant.color
        ? getTranslation(`creator.led${variant.color[0].toUpperCase()}${variant.color.slice(1)}`)
        : variant.sequence
            ? getTranslation(`creator.light.sequence.${variant.sequence}`)
            : groupLabel;
    const tierBadge = variant.tier === 'rgb' ? ` (${getTranslation('creator.targetDevice.badgeRgb')})` : '';
    button.setAttribute('aria-label', `${groupLabel} ${colorLabel}${tierBadge}`);
    button.title = `${groupLabel} · ${colorLabel}${tierBadge}`;

    const swatch = document.createElement('span');
    swatch.className = 'creator-light-swatch';
    const swatchColors = variant.swatchColors ?? resolveLightColors(variant);
    if (swatchColors.length > 1) {
        swatch.style.background = getAnimationSwatchGradient(swatchColors);
    }
    swatch.style.setProperty('--preset-color', swatchColors.length
        ? LIGHT_COLOR_SWATCHES[swatchColors[0]]
        : DEFAULT_ANIMATION_SWATCH_COLOR);
    button.appendChild(swatch);
    button.addEventListener('click', () => {
        if (isDynamic) {
            creatorSession.setPendingTextAnimation({ template: group.dynamicTemplate, color: variant.color });
            document.getElementById('creator-animation-text')?.focus();
            return;
        }
        assignLightAnimation(animationName);
    });
    return button;
}

function renderAnimationGroupCard(group, selectedLight) {
    const card = document.createElement('section');
    card.className = 'creator-animation-group';
    const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
    const heading = document.createElement('h4');
    heading.textContent = groupLabel;
    card.appendChild(heading);

    const variants = document.createElement('div');
    variants.className = 'creator-animation-variants';
    group.variants.forEach(variant => {
        variants.appendChild(renderAnimationVariantSwatch(variant, group, groupLabel, selectedLight));
    });

    card.appendChild(variants);
    return card;
}

export function renderLightPresets() {
    const categoryContainer = document.getElementById('creator-light-categories');
    const presetContainer = document.getElementById('creator-light-presets');
    const searchInput = document.getElementById('creator-light-search');
    if (!categoryContainer || !presetContainer) return;

    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const activePadIndex = creatorSession.getActivePadIndex();
    const activeStepIndex = creatorSession.getActiveStepIndex();
    const currentPage = creatorSession.getCurrentPage();
    const selectedLight = activePadIndex === null || !currentPage
        ? ''
        : (getPadSteps(currentPage, activePadIndex)[activeStepIndex]?.light || '');

    const activeLightCategory = creatorSession.getActiveLightCategory();
    renderLightCategoryTabs(categoryContainer, activeLightCategory);

    const draft = creatorSession.getDraft();
    const targetDevice = draft?.targetDevice || DEFAULT_TARGET_DEVICE;

    if (activeLightCategory === lastRenderedCategory && search === lastRenderedSearch && targetDevice === lastRenderedTargetDevice && presetContainer.children.length > 0) {
        presetContainer.querySelectorAll('.creator-animation-swatch').forEach(button => {
            const isDynamic = button.dataset.isDynamic === 'true';
            const template = button.dataset.template;
            const color = button.dataset.color;
            const animationName = button.dataset.animation;
            const isSelected = isSwatchSelected(selectedLight, isDynamic, template, color, animationName);
            button.classList.toggle('selected', isSelected);
        });
        return;
    }

    lastRenderedCategory = activeLightCategory;
    lastRenderedSearch = search;
    lastRenderedTargetDevice = targetDevice;

    const groups = filterCatalogByDevice(getAnimationGroups(), targetDevice)
        .filter(group => {
            const groupLabel = group.labelKey ? getTranslation(group.labelKey) : group.label;
            const matchesCategory = activeLightCategory === 'all' || group.category === activeLightCategory;
            const matchesSearch = !search || `${groupLabel} ${group.id} ${group.variants.map(variant => `${variant.color || ''} ${variant.sequence || ''}`).join(' ')}`
                .toLowerCase().includes(search);
            return matchesCategory && matchesSearch;
        });

    const fragment = document.createDocumentFragment();
    groups.forEach(group => {
        fragment.appendChild(renderAnimationGroupCard(group, selectedLight));
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
    const padIndex = creatorSession.getActivePadIndex();
    const pendingText = creatorSession.getPendingTextAnimation();
    if (padIndex === null || !pendingText) return;
    const textInput = document.getElementById('creator-animation-text');
    const text = textInput ? textInput.value.replace(/[^a-z0-9 ]/gi, '').trim().replace(/\s+/g, ' ') : '';
    if (!text) {
        showNotification(getTranslation('creator.errorAnimationText'), 'warning');
        return;
    }

    const animationName = pendingText.template === 'text'
        ? `text_${text}_${pendingText.color}`
        : `${pendingText.template}_${text}_${pendingText.color}`;
    if (textInput) textInput.value = '';
    assignLightAnimation(animationName);
}

// Ordered LED colors for a light: declared metadata when available, otherwise
// derived from the animation-name suffix (covers dynamic text/scroll lights).
export function getAnimationSwatchColors(animationName) {
    const colors = resolveLightColors(animations[animationName] ?? {});
    if (colors.length) return colors;
    const suffix = getColorFromAnimationName(animationName);
    return suffix ? [suffix] : [];
}

export function getAnimationSwatchGradient(colors) {
    return `linear-gradient(135deg, ${colors.map(name => LIGHT_COLOR_SWATCHES[name]).join(', ')})`;
}

/**
 * CSS background for a light's swatch: a gradient for multicolour lights,
 * otherwise its single colour.
 * @param {string} animationName
 * @returns {string}
 */
export function getAnimationSwatchBackground(animationName) {
    const colors = getAnimationSwatchColors(animationName);
    return colors.length > 1 ? getAnimationSwatchGradient(colors) : getAnimationColor(animationName);
}

export function getAnimationColor(animationName) {
    const colors = getAnimationSwatchColors(animationName);
    if (!colors.length) return DEFAULT_ANIMATION_SWATCH_COLOR;
    return LIGHT_COLOR_SWATCHES[colors[Math.floor(colors.length / 2)]];
}

function previewAnimation(animationName, index, stepIndex) {
    const page = creatorSession.getCurrentPage();
    const duration = page ? getManualLightDuration(page, index, stepIndex) : DEFAULT_LIGHT_DURATION_SEC;
    const x = index % LAUNCHPAD_COLS;
    const y = Math.floor(index / LAUNCHPAD_COLS);
    triggerAnimation(animationName, x, y, duration);
    if (animations[animationName]?.type === 'momentary') {
        window.setTimeout(() => releaseAnimation(animationName, x, y), 900);
    }
}

function assignLightAnimation(animationName) {
    const padIndex = creatorSession.getActivePadIndex();
    const stepIndex = creatorSession.getActiveStepIndex();
    if (padIndex === null) return;
    creatorSession.batch(() => {
        creatorSession.setPendingTextAnimation(null);
        creatorSession.assignStepLight(padIndex, stepIndex, animationName);
    });
    if (animationName) previewAnimation(animationName, padIndex, stepIndex);
}

/**
 * Forces the next renderLightPresets() to rebuild the swatches (e.g. when the
 * target device changes the set of available colours).
 */
export function invalidateLightPresets() {
    lastRenderedCategory = null;
}

export function initLightPickerListeners() {
    let searchDebounceTimer = null;
    listen('creator-light-search', 'input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(renderLightPresets, 150);
    });
    listen('creator-assign-text-animation', 'click', assignTextAnimation);
}
