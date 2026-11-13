/**
 * PROJECT MANAGEMENT (project.js)
 * Populates background and project menus and loads project configuration,
 * sounds, and associated Launchpad cover.
 */

import { audioEngine } from './audio.js';
import { getTranslation } from './i18n.js';
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
import { getActiveProject, commitProject } from './projectState.js';
import { changeSoundSet, resetPadStepCounters } from './interaction.js';
import { stopAnimationLoop, startAnimationLoop } from './lights.js';
import { validateProject, getErrorSummary } from './projectValidator.js';
import { 
    beginLoadingProject, 
    markProjectReady, 
    markProjectLoadError
} from './projectLoadingState.js';
import { normalizeProjectData, collectSoundUrls, assignStepBuffers } from './projectModel.js';
import { debug } from './logger.js';

let activeProjectLoad = null;
let selectedProjectButton = null;

/**
 * Fetches and validates a project JSON configuration from a remote or local URL.
 * @param {string} configPath - URL or path to the project JSON.
 * @returns {Promise<object>} Parsed and validated project object.
 */
async function fetchAndValidateProject(configPath) {
    const response = await fetch(configPath);
    if (!response.ok) {
        if (response.status === 503) {
            let errData = null;
            try { errData = await response.json(); } catch (_) { /* ignore */ }
            if (errData?.error === 'offline') {
                const offlineMessage = getTranslation('error.offline');
                showNotification(offlineMessage, 'warning', 5000);
                throw new Error(offlineMessage);
            }
        }
        throw new Error(`HTTP Error: ${response.status} - Failed to load project`);
    }

    const project = await response.json();
    const validation = validateProject(project);
    if (!validation.isValid) {
        const errorSummary = getErrorSummary(validation.errors);
        console.error('[Project] Validation failed:', validation.errors);
        throw new Error(`Project validation failed:\n${errorSummary}`);
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
async function loadProjectAssets(runtimeProject, onProgress = null, progressText = null) {
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
            const loadingText = getTranslation('overlay.loading').replace('{progress}', percentage);
            progressText.textContent = loadingText;
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
        console.error('[Project] Audio loading error:', error);
        showNotification('Failed to load all project audio files. Some pads may be silent.', 'warning');
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

async function loadProjectInternal(configPath, button, onProgress = null) {
    await beginLoadingProject();

    const overlay = document.getElementById('audio-unlock-overlay');
    const progressText = overlay ? overlay.querySelector('p') : null;

    try {
        stopAnimationLoop();

        if (overlay) {
            overlay.classList.remove('hidden');
            if (progressText) {
                const loadingText = getTranslation('overlay.loading').replace('{progress}', '0');
                progressText.textContent = loadingText;
            }
        }

        // 1. Fetch & Validate
        const project = await fetchAndValidateProject(configPath);

        // 2. Normalize into the runtime shape
        const runtimeProject = normalizeProjectData(project, configPath);

        // 3. Load Assets into the new project (the active one keeps playing meanwhile)
        await loadProjectAssets(runtimeProject, onProgress, progressText);

        // 4. Commit: a single assignment swaps sounds, lights and timing together.
        commitProject(runtimeProject);
        selectProjectButton(button);

        debug(`Project "${project.name}" loaded.`);
        markProjectReady();
        resetPadStepCounters();
        changeSoundSet(0);
    } catch (error) {
        console.error('[Project] Failed to load project:', error);
        // The commit never happened, so the previous project (if any) is intact:
        // put its visuals back, since assets of the failed one may have been applied.
        const previousProjectActive = restoreProjectAppearance();
        markProjectLoadError(error, { previousProjectActive });

        let userMessage;
        if (error.message.includes('validation failed')) {
            userMessage = `Project configuration error: ${error.message}`;
        } else if (error.message.includes('HTTP Error')) {
            userMessage = 'Could not load project file. Check the file path and try again.';
        } else if (error.message.includes('JSON')) {
            userMessage = 'Project file is not valid JSON. Check the file format.';
        } else {
            userMessage = `Failed to load project: ${error.message}`;
        }

        showNotification(userMessage, 'error');
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
