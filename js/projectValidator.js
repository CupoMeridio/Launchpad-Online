/**
 * PROJECT SCHEMA VALIDATOR (projectValidator.js)
 *
 * Validates project JSON data before it is used, so malformed files are
 * reported instead of crashing the player or the Studio.
 *
 * The schema is declarative: each optional field maps to a rule, a function
 * returning an error message (or null). Rules only run on fields that are
 * present (not undefined/null); required fields are checked explicitly.
 */

import {
    LAUNCHPAD_PADS,
    MAX_PROJECT_PAGES,
    MAX_PAD_STEPS,
    MIN_LIGHT_DURATION_SEC,
    MAX_LIGHT_DURATION_SEC,
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX,
    VISUALIZER_MODES,
    VISUALIZER_GRADIENT_DIRECTIONS,
    TARGET_DEVICES,
    ANIMATION_COLOR_TIERS,
    normalizeTargetDevice,
    getColorFromAnimationName
} from './constants.js';
import {
    PLAYBACK_MODES,
    LIGHT_LEVELS,
    MAX_CUSTOM_FRAMES,
    MIN_FRAME_DURATION_MS,
    MAX_FRAME_DURATION_MS,
    CUSTOM_ANIMATION_ID_PATTERN,
    parsePadKey,
    parseCustomLightName,
    usesRgbOnlyColors
} from './customAnimationModel.js';

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// ----------------------------------------------------------------------------
// Rules: (value) => error message | null
// ----------------------------------------------------------------------------

/** @typedef {function(*): (string|null)} Rule */

const isPresent = value => value !== undefined && value !== null;
const isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @returns {Rule} */
const ofType = (type) => value => (typeof value === type ? null : `must be a ${type} or null if provided`);

/** @returns {Rule} */
const oneOf = (allowed, suffix = '') => value => (
    allowed.includes(value) ? null : `must be one of: ${allowed.join(', ')}${suffix}`
);

/** @type {Rule} */
const hexColor = value => (HEX_COLOR_PATTERN.test(value) ? null : 'must be a hex color (e.g. #00aaff)');

/** @returns {Rule} */
const numberBetween = (min, max) => value => (
    typeof value === 'number' && !Number.isNaN(value) && value >= min && value <= max
        ? null
        : `must be a number between ${min} and ${max} if provided`
);

/** @type {Rule} */
const plainObject = value => (isPlainObject(value) ? null : 'must be an object if provided');

/**
 * Applies rules in order and reports the first failure.
 * @param {...Rule} rules
 * @returns {Rule}
 */
const all = (...rules) => value => {
    for (const rule of rules) {
        const message = rule(value);
        if (message) return message;
    }
    return null;
};

// ----------------------------------------------------------------------------
// Schema
// ----------------------------------------------------------------------------

const REQUIRED_STRING_FIELDS = ['name', 'id'];

/** Optional top-level project fields. */
const PROJECT_FIELDS = {
    coverImage: ofType('string'),
    iconImage: ofType('string'),
    backgroundMedia: ofType('string'),
    visualizer: plainObject,
    launchpadRotation: numberBetween(LAUNCHPAD_ROTATION_MIN, LAUNCHPAD_ROTATION_MAX),
    launchpadSize: numberBetween(LAUNCHPAD_SIZE_MIN, LAUNCHPAD_SIZE_MAX),
    targetDevice: oneOf(TARGET_DEVICES, ' if provided'),
    animations: value => (Array.isArray(value) ? null : 'must be an array if provided')
};

/** Optional fields of the nested `visualizer` object. */
const VISUALIZER_FIELDS = {
    mode: all(ofType('string'), oneOf(VISUALIZER_MODES)),
    color1: all(ofType('string'), hexColor),
    color2: all(ofType('string'), hexColor),
    gradient: ofType('boolean'),
    gradientDirection: all(ofType('string'), oneOf(VISUALIZER_GRADIENT_DIRECTIONS))
};

/** Step rules for strings that may be empty (no sample / no light). */
const optionalStringStep = step => (
    step === null || step === undefined || typeof step === 'string'
        ? null
        : `must be a string or empty, got ${typeof step}`
);

/**
 * Per-pad page fields: each is an array of 64 step lists.
 * `required` fields abort page validation when missing.
 */
const PAGE_STEP_FIELDS = [
    { fieldName: 'sounds', entryLabel: 'Sound', required: true, stepRule: optionalStringStep },
    { fieldName: 'lights', entryLabel: 'Light', stepRule: optionalStringStep },
    {
        fieldName: 'lightSyncToSound',
        entryLabel: 'Light sync',
        stepRule: step => (typeof step === 'boolean' ? null : 'must be a boolean')
    },
    {
        fieldName: 'lightDurations',
        entryLabel: 'Light duration',
        stepRule: step => (
            typeof step === 'number' && Number.isFinite(step) && step >= MIN_LIGHT_DURATION_SEC && step <= MAX_LIGHT_DURATION_SEC
                ? null
                : `must be between ${MIN_LIGHT_DURATION_SEC} and ${MAX_LIGHT_DURATION_SEC} seconds`
        )
    }
];

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

/**
 * Applies a field schema to the present fields of `object`.
 * @param {object} object
 * @param {Record<string, Rule>} schema
 * @param {string} label - Prefix for error messages (e.g. "Project").
 * @param {string[]} errors - Accumulator.
 */
function validateFields(object, schema, label, errors) {
    Object.entries(schema).forEach(([field, rule]) => {
        if (!isPresent(object[field])) return;
        const message = rule(object[field]);
        if (message) errors.push(`${label} field "${field}" ${message}`);
    });
}

/**
 * Validates a project configuration object.
 * @param {object} project - The project object to validate
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateProject(project) {
    const errors = [];

    if (!isPlainObject(project)) {
        return { isValid: false, errors: ['Project must be an object'] };
    }

    REQUIRED_STRING_FIELDS.forEach(field => {
        if (!project[field] || typeof project[field] !== 'string') {
            errors.push(`Project must have a valid "${field}" field (string)`);
        }
    });

    if (!Array.isArray(project.pages)) {
        errors.push('Project must have a "pages" array');
        return { isValid: false, errors };
    }
    if (project.pages.length === 0) {
        errors.push('Project must have at least one page');
    }
    if (project.pages.length > MAX_PROJECT_PAGES) {
        errors.push(`Project has ${project.pages.length} pages, but maximum is ${MAX_PROJECT_PAGES}`);
    }
    project.pages.forEach((page, pageIndex) => errors.push(...validatePage(page, pageIndex)));

    validateFields(project, PROJECT_FIELDS, 'Project', errors);
    if (isPlainObject(project.visualizer)) {
        validateFields(project.visualizer, VISUALIZER_FIELDS, 'Visualizer', errors);
    }

    const animationIds = Array.isArray(project.animations) ? validateCustomAnimations(project.animations, errors) : new Set();
    validateCustomLightReferences(project.pages, animationIds, errors);

    return { isValid: errors.length === 0, errors };
}

/**
 * Validates one per-pad field of a page (an array of 64 step lists).
 * @param {*} entries - The field value.
 * @param {number} pageNum - 1-based page number for error messages.
 * @param {{fieldName: string, entryLabel: string, stepRule: Rule}} field
 * @param {string[]} errors - Accumulator.
 */
function validateStepArrayField(entries, pageNum, { fieldName, entryLabel, stepRule }, errors) {
    if (!Array.isArray(entries) || entries.length !== LAUNCHPAD_PADS) {
        const found = Array.isArray(entries) ? entries.length : 0;
        errors.push(`Page ${pageNum}: ${fieldName} array must have exactly ${LAUNCHPAD_PADS} elements, found ${found}`);
        return;
    }

    entries.forEach((stepEntry, padIndex) => {
        const entryPrefix = `Page ${pageNum}, ${entryLabel} ${padIndex}`;
        if (!Array.isArray(stepEntry)) {
            errors.push(`${entryPrefix}: must be an array of steps`);
            return;
        }
        if (stepEntry.length > MAX_PAD_STEPS) {
            errors.push(`${entryPrefix}: step count exceeds maximum of ${MAX_PAD_STEPS}`);
        }
        stepEntry.forEach((step, stepIndex) => {
            const message = stepRule(step);
            if (message) errors.push(`${entryPrefix}, Step ${stepIndex}: ${message}`);
        });
    });
}

/**
 * Validates a page object within a project.
 * @param {object} page - The page to validate
 * @param {number} pageIndex - The index of this page (for error messages)
 * @returns {string[]} Error messages (empty if valid)
 */
function validatePage(page, pageIndex) {
    const pageNum = pageIndex + 1;
    if (!isPlainObject(page)) {
        return [`Page ${pageNum}: must be an object`];
    }

    const errors = [];
    if (!page.name || typeof page.name !== 'string') {
        errors.push(`Page ${pageNum}: must have a valid "name" field (string)`);
    }

    for (const field of PAGE_STEP_FIELDS) {
        const entries = page[field.fieldName];
        if (!isPresent(entries)) {
            if (field.required) {
                errors.push(`Page ${pageNum}: must have a "${field.fieldName}" array`);
                return errors;
            }
            continue;
        }
        validateStepArrayField(entries, pageNum, field, errors);
    }
    return errors;
}

// ----------------------------------------------------------------------------
// Custom light animations
// ----------------------------------------------------------------------------

/** Rule for one lit pad of a frame: a known colour and, optionally, a level. */
const frameCellRule = cell => {
    if (!isPlainObject(cell)) return 'must be an object with a "color"';
    if (!ANIMATION_COLOR_TIERS[cell.color]) return `has an unknown color "${cell.color}"`;
    if (isPresent(cell.level) && !LIGHT_LEVELS.includes(cell.level)) return `level must be one of: ${LIGHT_LEVELS.join(', ')}`;
    return null;
};

function validateFrame(frame, label, errors) {
    if (!isPlainObject(frame)) {
        errors.push(`${label}: must be an object`);
        return;
    }
    const duration = frame.duration;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < MIN_FRAME_DURATION_MS || duration > MAX_FRAME_DURATION_MS) {
        errors.push(`${label}: duration must be between ${MIN_FRAME_DURATION_MS} and ${MAX_FRAME_DURATION_MS} ms`);
    }
    if (!isPlainObject(frame.pads)) {
        errors.push(`${label}: "pads" must be an object`);
        return;
    }
    Object.entries(frame.pads).forEach(([key, cell]) => {
        const message = parsePadKey(key) ? frameCellRule(cell) : 'is not a pad of the 8x8 grid ("x,y" with 0-7)';
        if (message) errors.push(`${label}, pad "${key}": ${message}`);
    });
}

function validateCustomAnimation(animation, index, errors) {
    const label = `Animation ${index + 1}`;
    if (!isPlainObject(animation)) {
        errors.push(`${label}: must be an object`);
        return null;
    }
    if (typeof animation.id !== 'string' || !CUSTOM_ANIMATION_ID_PATTERN.test(animation.id)) {
        errors.push(`${label}: "id" must use lowercase letters, digits and dashes (max 32)`);
    }
    if (isPresent(animation.name) && typeof animation.name !== 'string') {
        errors.push(`${label}: "name" must be a string`);
    }
    if (!PLAYBACK_MODES.includes(animation.playback)) {
        errors.push(`${label}: "playback" must be one of: ${PLAYBACK_MODES.join(', ')}`);
    }
    if (!Array.isArray(animation.frames) || animation.frames.length === 0 || animation.frames.length > MAX_CUSTOM_FRAMES) {
        errors.push(`${label}: must have between 1 and ${MAX_CUSTOM_FRAMES} frames`);
    } else {
        animation.frames.forEach((frame, frameIndex) => validateFrame(frame, `${label}, Frame ${frameIndex + 1}`, errors));
    }
    return typeof animation.id === 'string' ? animation.id : null;
}

/**
 * Validates the project's custom animations.
 * @returns {Set<string>} The ids that are defined (for reference checks).
 */
function validateCustomAnimations(animations, errors) {
    const ids = new Set();
    animations.forEach((animation, index) => {
        const id = validateCustomAnimation(animation, index, errors);
        if (id === null) return;
        if (ids.has(id)) errors.push(`Animation ${index + 1}: duplicate id "${id}"`);
        ids.add(id);
    });
    return ids;
}

/** Every `custom:<id>` light used by a pad must be defined in `animations`. */
function validateCustomLightReferences(pages, animationIds, errors) {
    pages.forEach((page, pageIndex) => {
        if (!Array.isArray(page?.lights)) return;
        page.lights.forEach((steps, padIndex) => {
            if (!Array.isArray(steps)) return;
            steps.forEach((light, stepIndex) => {
                const id = parseCustomLightName(light);
                if (id !== null && !animationIds.has(id)) {
                    errors.push(`Page ${pageIndex + 1}, Light ${padIndex}, Step ${stepIndex}: custom animation "${id}" is not defined`);
                }
            });
        });
    });
}

/**
 * Gets a human-readable error summary for displaying to the user.
 * @param {string[]} errors - Array of error messages
 * @returns {string} Formatted error message for user display
 */
export function getErrorSummary(errors) {
    if (errors.length === 0) {
        return 'Project is valid';
    }

    const maxItems = 3;
    const shown = errors.length > maxItems
        ? [...errors.slice(0, maxItems), `... and ${errors.length - maxItems} more`]
        : errors;

    return `Project validation failed with ${errors.length} error(s):\n${shown.map(err => `• ${err}`).join('\n')}`;
}

// ----------------------------------------------------------------------------
// Device consistency (non-fatal)
// ----------------------------------------------------------------------------

/**
 * Counts lights that need an RGB device: built-in lights with an RGB-only
 * colour, and custom animations whose frames use one.
 * @param {Iterable<string|null|undefined>} lightNames
 * @param {object[]} [customAnimations] - The project's custom animations.
 * @returns {number}
 */
export function countRgbOnlyLights(lightNames, customAnimations = []) {
    const rgbCustomIds = new Set(customAnimations.filter(usesRgbOnlyColors).map(animation => animation.id));
    let count = 0;
    for (const light of lightNames) {
        if (typeof light !== 'string' || !light) continue;
        const customId = parseCustomLightName(light);
        const color = customId === null ? getColorFromAnimationName(light) : null;
        if (customId !== null ? rgbCustomIds.has(customId) : (color && ANIMATION_COLOR_TIERS[color] === 'rgb')) count++;
    }
    return count;
}

/**
 * Counts RGB-only lights used by a project file that targets legacy hardware.
 * This is non-fatal (the schema stays valid) but those pads will fall back
 * to bicolor LEDs on physical legacy devices.
 * The caller composes the localized user-facing message.
 * @param {object} project - Project file (pages with per-pad \`lights\` arrays).
 * @returns {{ rgbLightCount: number }}
 */
export function checkProjectDeviceConsistency(project) {
    if (!isPlainObject(project) || normalizeTargetDevice(project.targetDevice) !== 'legacy' || !Array.isArray(project.pages)) {
        return { rgbLightCount: 0 };
    }
    const lightNames = project.pages.flatMap(page => (
        Array.isArray(page?.lights) ? page.lights.filter(Array.isArray).flat() : []
    ));
    const customAnimations = Array.isArray(project.animations) ? project.animations.filter(isPlainObject).filter(a => Array.isArray(a.frames)) : [];
    return { rgbLightCount: countRgbOnlyLights(lightNames, customAnimations) };
}
