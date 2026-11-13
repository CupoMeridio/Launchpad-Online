/**
 * PROJECT SCHEMA VALIDATOR (projectValidator.js)
 * 
 * Validates project JSON data against a strict schema to ensure
 * data integrity and prevent crashes from malformed project files.
 * 
 * Uses a defensive programming approach to catch and report validation errors.
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

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Validates a visualizer color value (hex notation).
 * @param {string} value
 * @returns {boolean}
 */
function isValidColor(value) {
    return HEX_COLOR_PATTERN.test(value);
}

/**
 * Validates the enumerable/juridical values of a visualizer configuration,
 * shared by the flat legacy fields and the nested `visualizer` object.
 * @param {object} viz - Object exposing optional mode/color1/color2/gradientDirection.
 * @param {string} label - Human-readable label for error messages.
 * @param {string[]} errors - Accumulator for error messages.
 */
function validateVisualizerValues(viz, label, errors) {
    if (viz.mode !== undefined && viz.mode !== null) {
        if (typeof viz.mode !== 'string' || !VISUALIZER_MODES.includes(viz.mode)) {
            errors.push(`${label} field "mode" must be one of: ${VISUALIZER_MODES.join(', ')}`);
        }
    }

    ['color1', 'color2'].forEach(field => {
        const value = viz[field];
        if (value !== undefined && value !== null) {
            if (typeof value !== 'string' || !isValidColor(value)) {
                errors.push(`${label} field "${field}" must be a hex color (e.g. #00aaff)`);
            }
        }
    });

    if (viz.gradientDirection !== undefined && viz.gradientDirection !== null) {
        if (typeof viz.gradientDirection !== 'string' || !VISUALIZER_GRADIENT_DIRECTIONS.includes(viz.gradientDirection)) {
            errors.push(`${label} field "gradientDirection" must be one of: ${VISUALIZER_GRADIENT_DIRECTIONS.join(', ')}`);
        }
    }
}

/**
 * Validates a project configuration object.
 * @param {object} project - The project object to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validateProject(project) {
    const errors = [];

    // 1. Check if project exists and is an object
    if (!project || typeof project !== 'object') {
        errors.push('Project must be an object');
        return { isValid: false, errors };
    }

    // 2. Check required fields
    if (!project.name || typeof project.name !== 'string') {
        errors.push('Project must have a valid "name" field (string)');
    }

    if (!project.id || typeof project.id !== 'string') {
        errors.push('Project must have a valid "id" field (string)');
    }

    // 3. Check pages array
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

    // 4. Validate each page
    project.pages.forEach((page, pageIndex) => {
        const pageErrors = validatePage(page, pageIndex);
        errors.push(...pageErrors);
    });

    // 5. Check optional fields (must be strings, booleans, or objects as appropriate)
    const optionalStringFields = [
        'coverImage', 
        'iconImage', 
        'backgroundMedia'
    ];
    optionalStringFields.forEach(field => {
        if (project[field] !== undefined && project[field] !== null && typeof project[field] !== 'string') {
            errors.push(`Project field "${field}" must be a string or null if provided`);
        }
    });

    if (project.visualizer !== undefined && project.visualizer !== null) {
        if (typeof project.visualizer !== 'object' || Array.isArray(project.visualizer)) {
            errors.push('Project field "visualizer" must be an object if provided');
        } else {
            const viz = project.visualizer;
            const vizStringFields = ['mode', 'color1', 'color2', 'gradientDirection'];
            vizStringFields.forEach(field => {
                if (viz[field] !== undefined && viz[field] !== null && typeof viz[field] !== 'string') {
                    errors.push(`Visualizer field "${field}" must be a string or null if provided`);
                }
            });
            if (viz.gradient !== undefined && viz.gradient !== null && typeof viz.gradient !== 'boolean') {
                errors.push('Visualizer field "gradient" must be a boolean or null if provided');
            }
            validateVisualizerValues(viz, 'Visualizer', errors);
        }
    }

    if (project.launchpadRotation !== undefined && project.launchpadRotation !== null) {
        if (typeof project.launchpadRotation !== 'number' || Number.isNaN(project.launchpadRotation) || 
            project.launchpadRotation < LAUNCHPAD_ROTATION_MIN || project.launchpadRotation > LAUNCHPAD_ROTATION_MAX) {
            errors.push(`Project field "launchpadRotation" must be a number between ${LAUNCHPAD_ROTATION_MIN} and ${LAUNCHPAD_ROTATION_MAX} if provided`);
        }
    }

    if (project.launchpadSize !== undefined && project.launchpadSize !== null) {
        if (typeof project.launchpadSize !== 'number' || Number.isNaN(project.launchpadSize) || 
            project.launchpadSize < LAUNCHPAD_SIZE_MIN || project.launchpadSize > LAUNCHPAD_SIZE_MAX) {
            errors.push(`Project field "launchpadSize" must be a number between ${LAUNCHPAD_SIZE_MIN} and ${LAUNCHPAD_SIZE_MAX} if provided`);
        }
    }

    if (project.targetDevice !== undefined && project.targetDevice !== null) {
        if (typeof project.targetDevice !== 'string' || !TARGET_DEVICES.includes(project.targetDevice)) {
            errors.push(`Project field "targetDevice" must be one of: ${TARGET_DEVICES.join(', ')} if provided`);
        }
    }

    const isValid = errors.length === 0;
    return { isValid, errors };
}

/**
 * Validates a per-pad field whose value is an array of step arrays
 * (`sounds`, `lights`, `lightSyncToSound`, `lightDurations`).
 * @param {*} entries - The field value (array of per-pad step arrays).
 * @param {object} options
 * @param {number} options.pageNum - 1-based page number for error messages.
 * @param {string} options.fieldName - Field name (e.g. "lights").
 * @param {string} options.entryLabel - Singular label for a pad entry (e.g. "Light").
 * @param {function(*, number, number): (string|null)} options.stepError - Returns the step error message, or null when the step is valid.
 * @param {string[]} options.errors - Accumulator for error messages.
 * @param {boolean} [options.required=false] - When true, a missing/malformed field aborts page validation.
 * @returns {boolean} False when a required field is missing, true otherwise.
 */
function validateStepArrayField(entries, { pageNum, fieldName, entryLabel, stepError, errors, required = false }) {
    if (entries === undefined || entries === null) {
        if (required) {
            errors.push(`Page ${pageNum}: must have a "${fieldName}" array`);
            return false;
        }
        return true;
    }

    if (!Array.isArray(entries) || entries.length !== LAUNCHPAD_PADS) {
        const found = Array.isArray(entries) ? entries.length : 0;
        errors.push(`Page ${pageNum}: ${fieldName} array must have exactly ${LAUNCHPAD_PADS} elements, found ${found}`);
        return true;
    }

    entries.forEach((stepEntry, padIndex) => {
        if (!Array.isArray(stepEntry)) {
            errors.push(`Page ${pageNum}, ${entryLabel} ${padIndex}: must be an array of steps`);
            return;
        }
        if (stepEntry.length > MAX_PAD_STEPS) {
            errors.push(`Page ${pageNum}, ${entryLabel} ${padIndex}: step count exceeds maximum of ${MAX_PAD_STEPS}`);
        }
        stepEntry.forEach((step, stepIndex) => {
            const message = stepError(step, padIndex, stepIndex);
            if (message) errors.push(message);
        });
    });

    return true;
}

/**
 * Validates a page object within a project.
 * @param {object} page - The page to validate
 * @param {number} pageIndex - The index of this page (for error messages)
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validatePage(page, pageIndex) {
    const errors = [];
    const pageNum = pageIndex + 1;

    // Check if page is an object
    if (!page || typeof page !== 'object') {
        errors.push(`Page ${pageNum}: must be an object`);
        return errors;
    }

    // Check page name
    if (!page.name || typeof page.name !== 'string') {
        errors.push(`Page ${pageNum}: must have a valid "name" field (string)`);
    }

    const stringStepError = (label) => (step, padIndex, stepIndex) => (
        step !== null && step !== undefined && step !== '' && typeof step !== 'string'
            ? `Page ${pageNum}, ${label} ${padIndex}, Step ${stepIndex}: must be a string or empty, got ${typeof step}`
            : null
    );

    // Check sounds array (required)
    if (!validateStepArrayField(page.sounds, {
        pageNum,
        fieldName: 'sounds',
        entryLabel: 'Sound',
        stepError: stringStepError('Sound'),
        errors,
        required: true
    })) {
        return errors;
    }

    // Check lights array if it exists
    validateStepArrayField(page.lights, {
        pageNum,
        fieldName: 'lights',
        entryLabel: 'Light',
        stepError: stringStepError('Light'),
        errors
    });

    validateStepArrayField(page.lightSyncToSound, {
        pageNum,
        fieldName: 'lightSyncToSound',
        entryLabel: 'Light sync',
        stepError: (step, padIndex, stepIndex) => (
            typeof step !== 'boolean'
                ? `Page ${pageNum}, Light sync ${padIndex}, Step ${stepIndex}: must be a boolean`
                : null
        ),
        errors
    });

    validateStepArrayField(page.lightDurations, {
        pageNum,
        fieldName: 'lightDurations',
        entryLabel: 'Light duration',
        stepError: (step, padIndex, stepIndex) => (
            typeof step !== 'number' || !Number.isFinite(step) || step < MIN_LIGHT_DURATION_SEC || step > MAX_LIGHT_DURATION_SEC
                ? `Page ${pageNum}, Light duration ${padIndex}, Step ${stepIndex}: must be between ${MIN_LIGHT_DURATION_SEC} and ${MAX_LIGHT_DURATION_SEC} seconds`
                : null
        ),
        errors
    });

    return errors;
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

    const truncate = (arr, maxItems = 3) => {
        if (arr.length > maxItems) {
            return [...arr.slice(0, maxItems), `... and ${arr.length - maxItems} more`];
        }
        return arr;
    };

    const errorList = truncate(errors)
        .map(err => `• ${err}`)
        .join('\n');

    return `Project validation failed with ${errors.length} error(s):\n${errorList}`;
}

/**
 * Counts RGB-only lights used by a project that targets legacy hardware.
 * This is non-fatal (the schema stays valid) but those pads will fall back
 * to bicolor LEDs on physical legacy devices.
 * The caller composes the localized user-facing message.
 * @param {object} project
 * @returns {{ rgbLightCount: number }}
 */
export function checkProjectDeviceConsistency(project) {
    if (!project || typeof project !== 'object') return { rgbLightCount: 0 };

    let rgbLightCount = 0;
    if (normalizeTargetDevice(project.targetDevice) === 'legacy' && Array.isArray(project.pages)) {
        project.pages.forEach((page) => {
            if (!Array.isArray(page?.lights)) return;
            page.lights.forEach((lightEntry) => {
                if (!Array.isArray(lightEntry)) return;
                lightEntry.forEach((light) => {
                    if (typeof light !== 'string' || !light) return;
                    const color = getColorFromAnimationName(light);
                    if (color && ANIMATION_COLOR_TIERS[color] === 'rgb') {
                        rgbLightCount++;
                    }
                });
            });
        });
    }

    return { rgbLightCount };
}
