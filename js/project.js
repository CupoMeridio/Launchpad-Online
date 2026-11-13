/**
 * PROJECT MANAGEMENT (project.js)
 * Populates background and project menus and loads project configuration,
 * sounds, and associated Launchpad cover.
 */

import { audioEngine } from './audio.js';
import { getTranslation, translate } from './i18n.js';
import { showNotification } from './notifications.js';
import { createDefaultAppearance } from './appearanceModel.js';
import {
    applySkin,
    applyIcon,
    applyBackground,
    applyVisualizer,
    applyLayout,
    applyAppearance
} from './appearance.js';
import { getActiveProject, commitProject, beginLoadingProject, markProjectLoadError } from './projectState.js';
import { changeSoundSet, resetPadStepCounters } from './interaction.js';
import { stopAnimationLoop, startAnimationLoop } from './lights.js';
import { validateProject, getErrorSummary } from './projectValidator.js';
import { normalizeProjectData, collectSoundUrls, assignStepBuffers } from './projectModel.js';
import { debug, logger } from './logger.js';
import { PROJECT_LOADING_TIMEOUT_MS } from './constants.js';

let activeProjectLoad = null;
let selectedProjectButton = null;
// Incremented by every load; a load whose id is no longer current was
// abandoned (timed out) and must not touch the UI anymore.
let loadSequence = 0;

/**
 * A project load failure, classified so the user gets a translated message
 * (`project.error.<kind>`) instead of a raw technical one.
 */
export class ProjectLoadError extends Error {
    /**
     * @param {'offline'|'http'|'json'|'validation'|'timeout'|'unknown'} kind
     * @param {string} message - Technical message (for logs).
     * @param {object} [options]
     * @param {string} [options.details] - User-facing details (e.g. validation summary).
     * @param {*} [options.cause]
     */
    constructor(kind, message, { details = '', cause } = {}) {
        super(message, { cause });
        this.name = 'ProjectLoadError';
        this.kind = kind;
        this.details = details;
    }
}

/**
 * Translated, user-facing description of a load failure.
 * @param {Error} error
 * @returns {string}
 */
export function describeProjectLoadError(error) {
    if (!(error instanceof ProjectLoadError)) {
        return translate('project.error.unknown', { details: error?.message || '' });
    }
    if (error.kind === 'offline') return getTranslation('error.offline');
    return translate(`project.error.${error.kind}`, { details: error.details });
}

/**
 * Rejects with a 'timeout' ProjectLoadError if `promise` does not settle in time.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @returns {Promise<T>}
 */
function withLoadTimeout(promise, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ProjectLoadError('timeout', `Project loading timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function isOfflineResponse(response) {
    if (response.status !== 503) return false;
    try {
        return (await response.json())?.error === 'offline';
    } catch (_) {
        return false;
    }
}

/**
 * Fetches and validates a project JSON configuration from a remote or local URL.
 * @param {string} configPath - URL or path to the project JSON.
 * @returns {Promise<object>} Parsed and validated project object.
 * @throws {ProjectLoadError}
 */
async function fetchAndValidateProject(configPath) {
    let response;
    try {
        response = await fetch(configPath);
    } catch (error) {
        throw new ProjectLoadError('http', `Network error loading ${configPath}`, { cause: error });
    }
    if (!response.ok) {
        if (await isOfflineResponse(response)) {
            throw new ProjectLoadError('offline', `Offline: ${configPath}`);
        }
        throw new ProjectLoadError('http', `HTTP ${response.status} loading ${configPath}`);
    }

    let project;
    try {
        project = await response.json();
    } catch (error) {
        throw new ProjectLoadError('json', `Invalid JSON in ${configPath}`, { cause: error });
    }

    const validation = validateProject(project);
    if (!validation.isValid) {
        logger.error('[Project] Validation failed:', validation.errors);
        throw new ProjectLoadError('validation', `Invalid project ${configPath}`, {
            details: getErrorSummary(validation.errors)
        });
    }

    project.configPath = configPath;
    return project;
}

/**
 * Loads project media and audio assets, reporting overall progress.
 * Visual assets are applied as they load; decoded samples are attached to the
 * (not yet committed) runtime project's steps.
 * @param {import('./projectModel.js').RuntimeProject} runtimeProject - Output of normalizeProjectData.
 * @param {function} [onProgress] - Optional progress callback (0..100).
 * @param {HTMLElement} [progressText] - Optional DOM text element for status.
 * @returns {Promise<void>}
 */
async function loadProjectAssets(runtimeProject, onProgress = null, progressText = null, isCurrentLoad = () => true) {
    const { appearance } = runtimeProject;
    const soundUrls = collectSoundUrls(runtimeProject);
    let audioLoaded = 0;
    let skinLoaded = 0;
    let iconLoaded = 0;
    let videoLoaded = 0;

    const hasSkin = !!appearance.skin;
    const hasIcon = !!appearance.icon;
    const hasVideo = !!appearance.background;
    const totalAudioFiles = soundUrls.length;
    const totalAssets = Math.max(totalAudioFiles + (hasSkin ? 1 : 0) + (hasIcon ? 1 : 0) + (hasVideo ? 1 : 0), 1);

    const updateOverallProgress = () => {
        const totalLoaded = audioLoaded + skinLoaded + iconLoaded + videoLoaded;
        const percentage = Math.min(Math.round((totalLoaded / totalAssets) * 100), 100);
        if (progressText) {
            progressText.textContent = translate('overlay.loading', { progress: percentage });
        }
        if (onProgress) onProgress(percentage);
    };

    const loadingPromises = [];

    // 1. Audio Loading
    const audioPromise = audioEngine.loadBuffers(soundUrls, (loadedCount) => {
        audioLoaded = loadedCount;
        updateOverallProgress();
    }).then(({ buffersByUrl }) => {
        assignStepBuffers(runtimeProject, buffersByUrl);
    }).catch((error) => {
        logger.error('[Project] Audio loading error:', error);
        showNotification(getTranslation('project.error.audio'), 'warning');
    });
    loadingPromises.push(audioPromise);

    // 2. Skin Loading
    loadingPromises.push(Promise.resolve(applySkin(appearance.skin)).then(() => {
        if (hasSkin) {
            skinLoaded = 1;
            updateOverallProgress();
        }
    }));

    // 3. Icon Loading
    loadingPromises.push(Promise.resolve(applyIcon(appearance.icon)).then(() => {
        if (hasIcon) {
            iconLoaded = 1;
            updateOverallProgress();
        }
    }));

    // 4. Background Media Loading
    if (hasVideo) {
        debug('Loading project background media:', appearance.background);
        loadingPromises.push(Promise.resolve(applyBackground(appearance.background)).then(() => {
            videoLoaded = 1;
            updateOverallProgress();
        }));
    } else {
        applyBackground(null);
    }

    await Promise.all(loadingPromises);
    if (!isCurrentLoad()) return;
    updateOverallProgress();

    applyVisualizer(appearance.visualizer);
    applyLayout(appearance.rotation, appearance.size);
}

/**
 * Dynamically populates the background video menu.
 * @param {string[]} videoFiles - An array of video file names.
 */
export function initializeBackgroundMenu(videoFiles) {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = backgroundMenu.querySelector('.media-controls');

    videoFiles.forEach(videoFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-background', videoFile);
        button.textContent = videoFile.replace(/\.[^.]+$/, '');
        button.onclick = () => {
            if (button.classList.contains('selected')) return;
            applyBackground(videoFile);
        };
        backgroundMenu.insertBefore(button, videoControls);
    });
}

/**
 * Loads a project, its sounds, and sets the associated background.
 * @param {string} configPath - Path to the project configuration JSON file.
 * @param {HTMLElement} button - Clicked button element to update 'selected' state.
 * @param {function} onProgress - Optional callback for loading progress (0-100).
 */
export function loadProject(configPath, button, onProgress = null) {
    if (activeProjectLoad) {
        debug('[Project] A project is already loading; ignoring the new request.');
        return activeProjectLoad;
    }

    activeProjectLoad = loadProjectInternal(configPath, button, onProgress)
        .finally(() => {
            activeProjectLoad = null;
        });
    return activeProjectLoad;
}

/**
 * Fetches, validates, normalizes and loads the assets of a project, without
 * making it active.
 * @returns {Promise<import('./projectModel.js').RuntimeProject>}
 */
async function prepareProject(configPath, onProgress, progressText, isCurrentLoad) {
    const project = await fetchAndValidateProject(configPath);
    const runtimeProject = normalizeProjectData(project, configPath);
    // The active project keeps playing while the new one loads.
    await loadProjectAssets(runtimeProject, onProgress, progressText, isCurrentLoad);
    return runtimeProject;
}

function showLoadingOverlay(overlay, progressText) {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    if (progressText) {
        progressText.textContent = translate('overlay.loading', { progress: 0 });
    }
}

async function loadProjectInternal(configPath, button, onProgress = null) {
    const loadId = ++loadSequence;
    const isCurrentLoad = () => loadId === loadSequence;
    beginLoadingProject();

    const overlay = document.getElementById('audio-unlock-overlay');
    const progressText = overlay ? overlay.querySelector('p') : null;

    try {
        stopAnimationLoop();
        showLoadingOverlay(overlay, progressText);

        const runtimeProject = await withLoadTimeout(
            prepareProject(configPath, onProgress, progressText, isCurrentLoad),
            PROJECT_LOADING_TIMEOUT_MS
        );

        // Commit: a single assignment swaps sounds, lights and timing together,
        // and makes the project ready to play.
        commitProject(runtimeProject);
        selectProjectButton(button);

        debug(`Project "${runtimeProject.project.name}" loaded.`);
        resetPadStepCounters();
        changeSoundSet(0);
    } catch (error) {
        // Nothing was committed, so the previous project (if any) is intact:
        // put its visuals back, since assets of the failed one may have been applied.
        restoreProjectAppearance();
        markProjectLoadError(error);
        showNotification(describeProjectLoadError(error), 'error');
    } finally {
        if (overlay) {
            overlay.classList.add('hidden');
        }
        startAnimationLoop();
    }
}

/**
 * Moves the "selected" highlight in the project menu to the given button.
 * @param {HTMLElement|null} button
 */
function selectProjectButton(button) {
    if (selectedProjectButton) {
        selectedProjectButton.classList.remove('selected');
    }
    if (button) {
        button.classList.add('selected');
        selectedProjectButton = button;
    }
}

/**
 * Dynamically populates the project selection menu.
 * @param {object[]} projects - Array of project objects from `static-data.json`.
 */
export function initializeProjectMenu(projects) {
    const projectMenu = document.getElementById('project-menu');
    if (!projectMenu) return;

    projects.forEach(project => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = project.name;
        button.onclick = () => {
            if (button.classList.contains('selected')) return;
            loadProject(project.configPath, button);
        };
        projectMenu.appendChild(button);
    });
}

/**
 * Restores the active project's original visual appearance (background, skin, icon, visualizer).
 * Used when the user clicks "Ripristina aspetto progetto" or exits the editor.
 * @returns {boolean} True if a project appearance was restored, false if reset to defaults.
 */
export function restoreProjectAppearance() {
    const activeProject = getActiveProject();
    if (!activeProject) {
        // No project: clear the visuals but leave rotation/size to the user preference.
        applyAppearance(createDefaultAppearance());
        return false;
    }

    applyAppearance(activeProject.appearance);
    return true;
}
