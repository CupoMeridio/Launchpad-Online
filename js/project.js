/**
 * PROJECT MANAGEMENT (project.js)
 * Populates background and project menus and loads project configuration,
 * sounds, and associated Launchpad cover.
 */

import { audioEngine } from './audio.js';
import { getTranslation, showNotification } from './ui.js';
import { normalizeAppearance, createDefaultAppearance } from './appearanceModel.js';
import {
    applySkin,
    applyIcon,
    applyBackground,
    applyVisualizer,
    applyLayout,
    applyAppearance
} from './appearance.js';
import { selectedProjectButton, setCurrentProject, setProjectSounds, setProjectLights, setProjectLightSyncToSound, setProjectLightDurations, setSelectedProjectButton, currentProject } from './app.js';
import { changeSoundSet } from './interaction.js';
import { stopAnimationLoop, startAnimationLoop } from './lights.js';
import { validateProject, getErrorSummary } from './projectValidator.js';
import { 
    beginLoadingProject, 
    markProjectReady, 
    markProjectLoadError
} from './projectLoadingState.js';
import { LAUNCHPAD_PADS, DEFAULT_LIGHT_DURATION_SEC } from './constants.js';
import { debug } from './logger.js';

let activeProjectLoad = null;

/**
 * Builds a resolver that turns a project-relative asset path into a usable URL.
 * Absolute URLs, root paths and `assets/` refs are returned unchanged.
 * @param {string} configPath - Path of the project configuration JSON.
 * @returns {(path: string) => string}
 */
function createPathResolver(configPath) {
    const baseUrl = configPath ? configPath.substring(0, configPath.lastIndexOf('/') + 1) : '';
    return (path) => {
        if (!path) return path;
        if (path.startsWith('http') || path.startsWith('/') || path.startsWith('assets/')) return path;
        return baseUrl ? baseUrl + path : path;
    };
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
        debug("[Project] A project is already loading; ignoring the new request.");
        return activeProjectLoad;
    }

    activeProjectLoad = loadProjectInternal(configPath, button, onProgress)
        .finally(() => {
            activeProjectLoad = null;
        });
    return activeProjectLoad;
}

async function loadProjectInternal(configPath, button, onProgress = null) {
    // Mark loading as started
    await beginLoadingProject();

    const overlay = document.getElementById('audio-unlock-overlay');
    const progressText = overlay ? overlay.querySelector('p') : null;

    try {
        // Stop the animation loop to clean up previous animations before loading new project
        stopAnimationLoop();

        // Mostra l'overlay durante il caricamento del progetto
        if (overlay) {
            overlay.classList.remove('hidden');
            if (progressText) {
                const loadingText = getTranslation('overlay.loading').replace('{progress}', '0');
                progressText.textContent = loadingText;
            }
        }

        const response = await fetch(configPath);
        if (!response.ok) {
            // Gestione specifica per il caso offline restituito dal Service Worker
            if (response.status === 503) {
                let errData = null;
                try { errData = await response.json(); } catch (_) { /* parsing fallito, usa errore generico */ }

                if (errData?.error === "offline") {
                    const offlineMessage = getTranslation('error.offline');
                    showNotification(offlineMessage, "warning", 5000);
                    throw new Error(offlineMessage);
                }
            }
            throw new Error(`HTTP Error: ${response.status} - Failed to load project`);
        }
        const project = await response.json();

        // Validate project schema before processing
        const validation = validateProject(project);
        if (!validation.isValid) {
            const errorSummary = getErrorSummary(validation.errors);
            console.error('[Project] Validation failed:', validation.errors);
            throw new Error(`Project validation failed:\n${errorSummary}`);
        }

        // CRITICAL: Set current project BEFORE any operations that depend on it
        // This ensures MIDI and other modules see consistent state
        project.configPath = configPath;
        setCurrentProject(project);

        const resolvePath = createPathResolver(configPath);

        const sounds = [];
        const lights = [];
        const lightSyncToSound = [];
        const lightDurations = [];
        if (project.pages) {
            project.pages.forEach(page => {
                sounds.push(...page.sounds.map(s => resolvePath(s)));
                if (page.lights) {
                    lights.push(...page.lights);
                } else {
                    lights.push(...new Array(LAUNCHPAD_PADS).fill(""));
                }
                lightSyncToSound.push(...(page.lightSyncToSound || new Array(LAUNCHPAD_PADS).fill(true)));
                lightDurations.push(...(page.lightDurations || new Array(LAUNCHPAD_PADS).fill(DEFAULT_LIGHT_DURATION_SEC)));
            });
        }
        setProjectSounds(sounds);
        setProjectLights(lights);
        setProjectLightSyncToSound(lightSyncToSound);
        setProjectLightDurations(lightDurations);

        // --- PROGRESS TRACKING ---
        const appearance = normalizeAppearance(project, resolvePath);
        let audioLoaded = 0;
        let skinLoaded = 0;
        let iconLoaded = 0;
        let videoLoaded = 0;
        const hasSkin = !!appearance.skin;
        const hasIcon = !!appearance.icon;
        const hasVideo = !!appearance.background;
        const totalAssets = sounds.length + (hasSkin ? 1 : 0) + (hasIcon ? 1 : 0) + (hasVideo ? 1 : 0);

        const updateOverallProgress = () => {
            const totalLoaded = audioLoaded + skinLoaded + iconLoaded + videoLoaded;
            const percentage = Math.min(Math.round((totalLoaded / totalAssets) * 100), 100);
            if (progressText) {
                const loadingText = getTranslation('overlay.loading').replace('{progress}', percentage);
                progressText.textContent = loadingText;
            }
            if (onProgress) onProgress(percentage);
        };

        // Start all loading processes
        const loadingPromises = [];

        // 1. Audio Loading
        const audioPromise = audioEngine.loadSounds(sounds, (loadedSoundsCount) => {
            audioLoaded = loadedSoundsCount;
            updateOverallProgress();
        }).catch((error) => {
            console.error("[Project] Audio loading error:", error);
            showNotification('Failed to load all project audio files. Some pads may be silent.', 'warning');
        });
        loadingPromises.push(audioPromise);

        // 2. Skin Loading
        const skinPromise = Promise.resolve(applySkin(appearance.skin)).then(() => {
            if (hasSkin) {
                skinLoaded = 1;
                updateOverallProgress();
            }
        });
        loadingPromises.push(skinPromise);

        // 3. Icon Loading (falls back to the default icon when the project has none)
        const iconPromise = Promise.resolve(applyIcon(appearance.icon)).then(() => {
            if (hasIcon) {
                iconLoaded = 1;
                updateOverallProgress();
            }
        });
        loadingPromises.push(iconPromise);

        // 4. Background Media Loading
        if (hasVideo) {
            debug("Loading project background media:", appearance.background);
            const videoPromise = Promise.resolve(applyBackground(appearance.background)).then(() => {
                videoLoaded = 1;
                updateOverallProgress();
            });
            loadingPromises.push(videoPromise);
        } else {
            applyBackground(null);
        }

        // Wait for everything to finish
        await Promise.all(loadingPromises);

        // Ensure final UI update
        updateOverallProgress();

        // Visualizer styling and layout overrides
        applyVisualizer(appearance.visualizer);
        applyLayout(appearance.rotation, appearance.size);

        if (selectedProjectButton) {
            selectedProjectButton.classList.remove('selected');
        }
        if (button) {
            button.classList.add('selected');
            setSelectedProjectButton(button);
        }

        debug(`Project "${project.name}" loaded.`);
        
        // MARK PROJECT AS READY - Critical for MIDI and other systems
        // This signals that currentProject, projectSounds, and projectLights are all set
        markProjectReady();

        // Reset to first page ONLY AFTER the project is marked as ready
        changeSoundSet(0);
        
    } catch (error) {
        console.error("[Project] Failed to load project:", error);
        
        // Mark loading as failed - prevents MIDI and other systems from using incomplete state
        markProjectLoadError(error);
        
        // Extract meaningful error message
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

        // Show notification to user
        if (typeof showNotification === 'function') {
            showNotification(userMessage, 'error');
        }
    } finally {
        if (overlay) {
            overlay.classList.add('hidden');
        }
        // Resume animation loop after project loading completes (success or failure)
        startAnimationLoop();
    }
}

/**
 * Dynamically populates the project selection menu.
 * @param {object[]} projects - Array of project objects from `static-data.json`.
 */
export function initializeProjectMenu(projects) {
    const projectMenu = document.getElementById('project-menu');
    if (!projectMenu) return;

    projects.forEach((project, index) => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = project.name;
        button.onclick = () => {
            if (button.classList.contains('selected')) return;
            loadProject(project.configPath, button);
        };
        projectMenu.appendChild(button);

        if (index === 0) {
            // Pre-select the first project.
            // Selected button handling logic is in loadProject
        }
    });
}

/**
 * Restores the active project's original visual appearance (background, skin, icon, visualizer).
 * Used when the user clicks "Ripristina aspetto progetto" or exits the editor.
 * @returns {boolean} True if a project appearance was restored, false if reset to defaults.
 */
export function restoreProjectAppearance() {
    if (!currentProject) {
        // No project: clear the visuals but leave rotation/size to the user preference.
        applyAppearance(createDefaultAppearance());
        return false;
    }

    const resolvePath = createPathResolver(currentProject.configPath);

    applyAppearance(normalizeAppearance(currentProject, resolvePath));
    return true;
}