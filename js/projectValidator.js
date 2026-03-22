/**
 * PROJECT SCHEMA VALIDATOR (projectValidator.js)
 * 
 * Validates project JSON data against a strict schema to ensure
 * data integrity and prevent crashes from malformed project files.
 * 
 * Uses a defensive programming approach to catch and report validation errors.
 */

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

    if (project.pages.length > 8) {
        errors.push(`Project has ${project.pages.length} pages, but maximum is 8`);
    }

    // 4. Validate each page
    project.pages.forEach((page, pageIndex) => {
        const pageErrors = validatePage(page, pageIndex);
        errors.push(...pageErrors);
    });

    // 5. Check optional fields (must be strings or null)
    const optionalStringFields = ['coverImage', 'iconImage', 'backgroundVideo', 'visualizerMode'];
    optionalStringFields.forEach(field => {
        if (project[field] !== undefined && project[field] !== null && typeof project[field] !== 'string') {
            errors.push(`Project field "${field}" must be a string or null if provided`);
        }
    });

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

    // Validate sounds array length (must be exactly 64 for a page)
    if (page.sounds.length !== 64) {
        errors.push(`Page ${pageNum}: sounds array must have exactly 64 elements, found ${page.sounds.length}`);
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
        } else if (page.lights.length !== 64) {
            errors.push(`Page ${pageNum}: lights array must have exactly 64 elements, found ${page.lights.length}`);
        } else {
            // Validate each light entry
            page.lights.forEach((light, lightIndex) => {
                if (light !== null && light !== undefined && light !== '' && typeof light !== 'string') {
                    errors.push(`Page ${pageNum}, Light ${lightIndex}: must be a string or empty, got ${typeof light}`);
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
