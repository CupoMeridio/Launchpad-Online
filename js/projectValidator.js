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
    MIN_LIGHT_DURATION_SEC, 
    MAX_LIGHT_DURATION_SEC,
    LAUNCHPAD_ROTATION_MIN,
    LAUNCHPAD_ROTATION_MAX,
    LAUNCHPAD_SIZE_MIN,
    LAUNCHPAD_SIZE_MAX,
    VISUALIZER_MODES,
    VISUALIZER_GRADIENT_DIRECTIONS
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
        'backgroundVideo', 
        'backgroundImage',
        'backgroundMedia',
        'visualizerMode', 
        'visualizerColor1', 
        'visualizerColor2', 
        'visualizerGradientDirection'
    ];
    optionalStringFields.forEach(field => {
        if (project[field] !== undefined && project[field] !== null && typeof project[field] !== 'string') {
            errors.push(`Project field "${field}" must be a string or null if provided`);
        }
    });

    if (project.visualizerGradient !== undefined && project.visualizerGradient !== null && typeof project.visualizerGradient !== 'boolean') {
        errors.push('Project field "visualizerGradient" must be a boolean or null if provided');
    }

    validateVisualizerValues({
        mode: project.visualizerMode,
        color1: project.visualizerColor1,
        color2: project.visualizerColor2,
        gradientDirection: project.visualizerGradientDirection
    }, 'Project', errors);

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

    const isValid = errors.length === 0;
    return { isValid, errors };
}

/**
 * Validates a page object within a project.
 * @param {object} page - The page to validate
 * @param {number} pageIndex - The index of this page (for error messages)
 * @returns {string[]} Array of error messages (empty if valid)
 */
export function validatePage(page, pageIndex) {
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

    // Check sounds array
    if (!Array.isArray(page.sounds)) {
        errors.push(`Page ${pageNum}: must have a "sounds" array`);
        return errors;
    }

    // Validate sounds array length (must be exactly LAUNCHPAD_PADS for a page)
    if (page.sounds.length !== LAUNCHPAD_PADS) {
        errors.push(`Page ${pageNum}: sounds array must have exactly ${LAUNCHPAD_PADS} elements, found ${page.sounds.length}`);
    }

    // Validate each sound entry
    page.sounds.forEach((sound, soundIndex) => {
        if (sound !== null && sound !== undefined && sound !== '' && typeof sound !== 'string') {
            errors.push(`Page ${pageNum}, Sound ${soundIndex}: must be a string or empty, got ${typeof sound}`);
        }
    });

    // Check lights array if it exists
    if (page.lights !== undefined && page.lights !== null) {
        if (!Array.isArray(page.lights)) {
            errors.push(`Page ${pageNum}: "lights" must be an array if provided`);
        } else if (page.lights.length !== LAUNCHPAD_PADS) {
            errors.push(`Page ${pageNum}: lights array must have exactly ${LAUNCHPAD_PADS} elements, found ${page.lights.length}`);
        } else {
            // Validate each light entry
            page.lights.forEach((light, lightIndex) => {
                if (light !== null && light !== undefined && light !== '' && typeof light !== 'string') {
                    errors.push(`Page ${pageNum}, Light ${lightIndex}: must be a string or empty, got ${typeof light}`);
                }
            });
        }
    }

    if (page.lightSyncToSound !== undefined && page.lightSyncToSound !== null) {
        if (!Array.isArray(page.lightSyncToSound) || page.lightSyncToSound.length !== LAUNCHPAD_PADS) {
            errors.push(`Page ${pageNum}: "lightSyncToSound" must be an array with exactly ${LAUNCHPAD_PADS} elements`);
        } else {
            page.lightSyncToSound.forEach((enabled, padIndex) => {
                if (typeof enabled !== 'boolean') {
                    errors.push(`Page ${pageNum}, Light sync ${padIndex}: must be a boolean`);
                }
            });
        }
    }

    if (page.lightDurations !== undefined && page.lightDurations !== null) {
        if (!Array.isArray(page.lightDurations) || page.lightDurations.length !== LAUNCHPAD_PADS) {
            errors.push(`Page ${pageNum}: "lightDurations" must be an array with exactly ${LAUNCHPAD_PADS} elements`);
        } else {
            page.lightDurations.forEach((duration, padIndex) => {
                if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < MIN_LIGHT_DURATION_SEC || duration > MAX_LIGHT_DURATION_SEC) {
                    errors.push(`Page ${pageNum}, Light duration ${padIndex}: must be between ${MIN_LIGHT_DURATION_SEC} and ${MAX_LIGHT_DURATION_SEC} seconds`);
                }
            });
        }
    }

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
