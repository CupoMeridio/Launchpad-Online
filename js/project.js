/**
 * PROJECT MANAGEMENT (project.js)
 * Populates background and project menus and loads project configuration,
 * sounds, and associated Launchpad cover.
 */

import { audioEngine } from './audio.js';
import { setLaunchpadBackground, getTranslation, setTopRightIconFile, resetTopRightIcon, showNotification } from './ui.js';
import { setBackgroundVideo } from './video.js';
import { selectedProjectButton, setCurrentProject, setProjectSounds, setProjectLights, setSelectedProjectButton } from './app.js';
import { changeSoundSet } from './interaction.js';
import { stopAnimationLoop, startAnimationLoop } from './lights.js';
import { validateProject, getErrorSummary } from './projectValidator.js';
import { 
    beginLoadingProject, 
    markProjectReady, 
    markProjectLoadError,
    isProjectLoading,
    isProjectReady
} from './projectLoadingState.js';

/**
 * Dynamically populates the background video menu.
 * @param {string[]} videoFiles - An array of video file names.
 */
export function initializeBackgroundMenu(videoFiles) {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = backgroundMenu.querySelector('.video-controls');

    videoFiles.forEach(videoFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-video', videoFile);
        button.textContent = videoFile.replace('.mp4', '');
        button.onclick = () => {
            if (button.classList.contains('selected')) return;
            setBackgroundVideo(videoFile);
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
export async function loadProject(configPath, button, onProgress = null) {
    // Prevent multiple concurrent loads - wait for previous to complete
    if (isProjectLoading()) {
        console.log("[Project] Project loading already in progress, queueing...");
        return;
    }

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
        setCurrentProject(project);

        const baseUrl = configPath.substring(0, configPath.lastIndexOf('/') + 1);
        const resolvePath = (path) => {
            if (!path) return path;
            if (path.startsWith('http') || path.startsWith('/') || path.startsWith('assets/')) return path;
            return baseUrl + path;
        };

        const sounds = [];
        const lights = [];
        if (project.pages) {
            project.pages.forEach(page => {
                sounds.push(...page.sounds.map(s => resolvePath(s)));
                if (page.lights) {
                    lights.push(...page.lights);
                } else {
                    lights.push(...new Array(64).fill(""));
                }
            });
        }
        setProjectSounds(sounds);
        setProjectLights(lights);

        // --- PROGRESS TRACKING ---
        let audioLoaded = 0;
        let skinLoaded = 0;
        let iconLoaded = 0;
        let videoLoaded = 0;
        const hasSkin = !!project.coverImage;
        const hasIcon = !!project.iconImage;
        const hasVideo = !!project.backgroundVideo;
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
        const skinPromise = setLaunchpadBackground(resolvePath(project.coverImage)).then(() => {
            if (hasSkin) {
                skinLoaded = 1;
                updateOverallProgress();
            }
        });
        loadingPromises.push(skinPromise);

        //3. Icon loading
        let iconPromise;
        if (hasIcon) {
            iconPromise = setTopRightIconFile(resolvePath(project.iconImage)).then(() => {
                iconLoaded = 1;
                updateOverallProgress();
            });
        } else {
            // Se non c'è un'icona specifica per il progetto, ripristina quella di default
            iconPromise = resetTopRightIcon();
        }
        loadingPromises.push(iconPromise);


        // 4. Video Loading
        if (hasVideo) {
            console.log("Loading project background video:", project.backgroundVideo);
            const videoPromise = setBackgroundVideo(resolvePath(project.backgroundVideo)).then(() => {
                videoLoaded = 1;
                updateOverallProgress();
            });
            loadingPromises.push(videoPromise);
        } else {
            setBackgroundVideo(null);
        }

        // Wait for everything to finish
        await Promise.all(loadingPromises);

        // Ensure final UI update
        updateOverallProgress();

        // Visualizer Mode
        const visualizerMode = project.visualizerMode || 'off';
        window.dispatchEvent(new CustomEvent('visualizer:setMode', { detail: { mode: visualizerMode } }));

        if (selectedProjectButton) {
            selectedProjectButton.classList.remove('selected');
        }
        if (button) {
            button.classList.add('selected');
            setSelectedProjectButton(button);
        }

        console.log(`Project "${project.name}" loaded.`);
        
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
