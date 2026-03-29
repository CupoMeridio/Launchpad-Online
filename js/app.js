/**
 * LAUNCHPAD PWA - JAVASCRIPT ENTRY POINT (app.js)
 */

// Main application modules
import { audioEngine } from './audio.js';
import { Visualizer } from './visualizer.js';
import { initMidi, isMidiConnected } from './midi.js';

// Initialization and management functions from separate modules
import { initializeVisualizerControls } from './visualizer-controls.js';
import { initializeVideoControls } from './video.js';
import { loadProject, initializeProjectMenu, initializeBackgroundMenu } from './project.js';
import { initializePersonalizeLaunchpadMenu, initializeLanguageControls, initializeModeMenu, getTranslation, bindStaticUIEvents } from './ui.js';
import { initInteraction, changeSoundSet, changeMode } from './interaction.js';
import { stopAnimationLoop, startAnimationLoop } from './lights.js';
import { setVisualizer } from './visualizerManager.js';
import { registerListener, cleanup, removeListener } from './eventCleanup.js';
import { initVisibilityManager, onVisibilityChange } from './visibilityManager.js';

// ----------------------------------------------------------------------------
// APPLICATION GLOBAL STATE
// ----------------------------------------------------------------------------
// Export of state variables and their respective modification functions.
// This approach allows other modules to import and modify state
// in a controlled manner, avoiding the use of unsafe global variables.

export let currentProject = null;
export let selectedProjectButton = null;
export let projectSounds = [];
export let projectLights = [];
export let currentPage = null; // Initialized as null to allow first "Page changed: 0" log
export let activePageButton = null;
export let currentMode = null; // Initialized as null to allow first "Mode changed: 5" log
export let activeModeButton = null;

export function setCurrentProject(p) { currentProject = p; }
export function setSelectedProjectButton(b) { selectedProjectButton = b; }
export function setProjectSounds(s) { projectSounds = s; }
export function setProjectLights(l) { projectLights = l; }
export function setCurrentPage(p) { currentPage = p; }
export function setActivePageButton(b) { activePageButton = b; }
export function setCurrentMode(m) { currentMode = m; }
export function setActiveModeButton(b) { activeModeButton = b; }

/**
 * Returns a consistent snapshot of current project state.
 * Use this in functions that need multiple interdependent variables
 * to avoid race conditions between pad presses and project loading.
 * 
 * @returns {Object} An object containing a coherent view of project state
 *   - project: currentProject
 *   - sounds: projectSounds array
 *   - lights: projectLights array
 *   - page: currentPage index
 *   - mode: currentMode index
 * @example
 * const state = getProjectStateSnapshot();
 * const soundIndex = state.page * 64 + padIndex;
 * if (state.sounds[soundIndex]) {
 *   // Now we know that state.page and state.sounds were read at the same moment
 * }
 */
export function getProjectStateSnapshot() {
    return {
        project: currentProject,
        sounds: projectSounds,
        lights: projectLights,
        page: currentPage,
        mode: currentMode
    };
}

// Initialize visibility manager early to catch all visibility changes
initVisibilityManager();

let midiInitialized = false;

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT (DOMContentLoaded)
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async function () {
    // --- 1. AudioContext Unlock ---
    const unlockOverlay = document.getElementById('audio-unlock-overlay');
    let audioUnlocked = false; // Flag to avoid double execution

    // --- 1. Interaction Setup ---
    initInteraction();
    bindStaticUIEvents();  // Bind all sidebar/menu listeners (replaces onclick HTML attributes)

    let projectsData = null;

    const loadStaticData = async () => {
        try {
            const response = await fetch('js/static-data.json');
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const data = await response.json();
            projectsData = data.projects;

            initializeBackgroundMenu(data.videos);
            initializeProjectMenu(data.projects);
            initializePersonalizeLaunchpadMenu(data.skins);
            initializeModeMenu();

            return projectsData;
        } catch (error) {
            console.error("Unable to load static data for menus:", error);
            return null;
        }
    };

    const projectsDataPromise = loadStaticData();

    const unlockAudioAndHideOverlay = async () => {
        if (audioUnlocked) return; // Exit if already unlocked
        audioUnlocked = true; // Set the flag

        // Set initial mode (User 1 - index 5) after user interaction
        // This ensures the mode is only set when the user actually interacts with the app
        changeMode(5);

        if (unlockOverlay) {
            const progressText = unlockOverlay.querySelector('p');
            if (progressText) {
                const loadingText = getTranslation('overlay.loading').replace('{progress}', '0');
                progressText.textContent = loadingText;
            }
        }

        // Initialize Audio Engine (Context & Analyser)
        try {
            await audioEngine.init();
        } catch (error) {
            console.error("Audio initialization failed:", error);
            // Show error message to user
            const errorMsg = audioEngine.getInitError() || "Audio system initialization failed. Some features may not work.";
            console.error("[App]", errorMsg);
            // Optionally show notification (if available)
            if (typeof showNotification === 'function') {
                showNotification(errorMsg, 'error');
            }
            // Continue without audio - app can still work with visual feedback only
            if (unlockOverlay) {
                unlockOverlay.classList.add('hidden');
            }
            return;
        }

        // The visualizer is initialized here because it depends on the AudioContext
        // created in audioEngine.init()
        try {
            const analyser = audioEngine.getAnalyser();
            const canvasTop = document.getElementById('visualizer-canvas-top');
            const canvasBottom = document.getElementById('visualizer-canvas-bottom');
            const visualizer = new Visualizer(analyser, canvasTop, canvasBottom);
            visualizer.draw();
            // Register visualizer with the manager instead of exposing globally
            setVisualizer(visualizer);

            initializeVisualizerControls();

        } catch (error) {
            console.error("Unable to initialize visualizer:", error);
        }

        const loadedProjects = await projectsDataPromise;
        if (!projectsData && loadedProjects) {
            projectsData = loadedProjects;
        }

        if (projectsData && projectsData.length > 0) {
            console.log("Loading initial project after interaction...");
            const firstProjectButton = document.querySelector('#project-menu .menu-option');

            // PARALLEL EXECUTION: loadProject() and initMidi() can run independently
            // This improves performance and ensures both systems initialize correctly
            // Promise.all() guarantees both complete before proceeding
            const promises = [
                loadProject(projectsData[0].configPath, firstProjectButton),
                initMidi().catch(error => console.error("Error during MIDI initialization:", error))
            ];
            
            try {
                await Promise.all(promises);
                console.log("Initial project and MIDI system loaded.");
                midiInitialized = true;
            } catch (error) {
                console.error("Error during parallel initialization:", error);
                midiInitialized = true; // Mark as initialized even if MIDI fails
            }
        } else {
            // No projects found, still initialize MIDI
            if (!midiInitialized) {
                await initMidi().catch(error => console.error("Error during MIDI initialization:", error));
                midiInitialized = true;
            }
        }

        // If NO MIDI is connected, a single call is required for the UI.
        // isMidiConnected from midi.js is used to check the actual hardware status.
        if (!isMidiConnected) {
            console.log("[App] No MIDI connected, initializing UI visuals manually.");
        }

        // Remove both event listeners to be safe
        removeListener(document, 'click', unlockAudioAndHideOverlay);
        removeListener(document, 'touchstart', unlockAudioAndHideOverlay);
    };

    // Add both event listeners but without { once: true }
    // to allow manual removal after the first execution
    registerListener(document, 'click', unlockAudioAndHideOverlay);
    registerListener(document, 'touchstart', unlockAudioAndHideOverlay);

    // --- 2. UI Controls Initialization ---
    initializeVideoControls();
    await initializeLanguageControls();

    // --- Handle Tab Visibility Changes ---
    // Stop animation loop when tab is hidden to reduce CPU/GPU usage
    // Resume when tab becomes visible again
    onVisibilityChange((isVisible) => {
        if (!isVisible) {
            stopAnimationLoop();
        } else {
            startAnimationLoop();
        }
    });

    // --- Handle Cleanup on Page Unload ---
    // Ensure animation loop is properly stopped before page unload
    registerListener(window, 'beforeunload', () => {
        stopAnimationLoop();
    });

    document.querySelectorAll('.menu-dropdown.open').forEach(dropdown => {
        const menuItem = dropdown.closest('.menu-item');
        const toggleButton = menuItem ? menuItem.querySelector('.menu-toggle') : null;
        if (toggleButton) toggleButton.classList.add('active');
    });

    await projectsDataPromise;

    // --- 7. Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        // Register Service Worker only once on page load
        // Use window.addEventListener with conditional to avoid multiple registrations
        if (!window.serviceWorkerRegistered) {
            window.serviceWorkerRegistered = true;
            registerListener(window, 'load', () => {
                // Use a relative path so the SW works regardless of the deployment subdirectory
                navigator.serviceWorker.register('./service-worker.js')
                    .then(registration => console.log('Service Worker registered: ', registration))
                    .catch(registrationError => console.log('Service Worker registration failed: ', registrationError));
            });
            
            // Trigger load event listener manually if already loaded
            if (document.readyState === 'complete') {
                window.dispatchEvent(new Event('load'));
            }
        }
    }
});
