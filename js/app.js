/**
 * LAUNCHPAD PWA - APPLICATION ENTRY POINT (app.js)
 *
 * Composition root: wires modules together and runs the startup sequence.
 * It holds no application state and exports nothing; runtime state lives in
 * projectState.js, so no module ever needs to import the entry point.
 */

import { audioEngine } from './audio.js';
import { Visualizer } from './visualizer.js';
import { initMidi } from './midi.js';
import { initializeVisualizerControls } from './visualizer-controls.js';
import { initializeBackgroundControls } from './background.js';
import { loadProject, initializeProjectMenu, initializeBackgroundMenu, restoreProjectAppearance } from './project.js';
import { initializePersonalizeLaunchpadMenu, initializeModeMenu, bindStaticUIEvents } from './ui.js';
import { getTranslation, initializeLanguageControls } from './i18n.js';
import { showNotification } from './notifications.js';
import { initInteraction, changeMode } from './interaction.js';
import { stopAnimationLoop, startAnimationLoop } from './lights.js';
import { setVisualizer } from './visualizerManager.js';
import { registerListener, removeListener } from './eventCleanup.js';
import { initVisibilityManager, onVisibilityChange } from './visibilityManager.js';
import { initLaunchpadView } from './launchpadView.js';
import { loadStaticCatalog } from './staticCatalog.js';
import { loadProjectCreator } from './creatorLoader.js';
import { DEFAULT_MODE_INDEX } from './constants.js';
import { debug, logger } from './logger.js';
import { isDebugSettingEnabled } from './settings.js';

// Initialize visibility manager early to catch all visibility changes
initVisibilityManager();

// ----------------------------------------------------------------------------
// STARTUP STEPS
// ----------------------------------------------------------------------------

function initCoreUi() {
    initInteraction();
    bindStaticUIEvents({
        onResetProjectAppearance: () => {
            restoreProjectAppearance();
            showNotification(getTranslation('notification.appearanceReset'), 'success');
        }
    });
    initLaunchpadView();
    initializeBackgroundControls();

    document.getElementById('toggle-project-creator')?.addEventListener('click', async () => {
        try {
            const creator = await loadProjectCreator();
            creator.openCreator();
        } catch (error) {
            logger.error('[App] Failed to load Studio Creator module:', error);
            showNotification(getTranslation('creator.loadError'), 'error');
        }
    });

    // Reflect dropdowns that start open in the markup on their toggle buttons.
    document.querySelectorAll('.menu-dropdown.open').forEach(dropdown => {
        const toggleButton = dropdown.closest('.menu-item')?.querySelector('.menu-toggle');
        if (toggleButton) toggleButton.classList.add('active');
    });
}

/**
 * Loads the static catalog and builds the menus that depend on it.
 * @returns {Promise<object|null>} The catalog, or null if it could not be loaded.
 */
async function initCatalogMenus() {
    try {
        const catalog = await loadStaticCatalog();
        initializeBackgroundMenu(catalog.videos);
        initializeProjectMenu(catalog.projects);
        initializePersonalizeLaunchpadMenu(catalog.skins);
        initializeModeMenu(changeMode);
        return catalog;
    } catch (error) {
        logger.error('[App] Unable to load static data for menus:', error);
        return null;
    }
}

function initAnimationLifecycle() {
    // Stop the animation loop while the tab is hidden to save CPU/GPU.
    onVisibilityChange((isVisible) => {
        if (isVisible) {
            startAnimationLoop();
        } else {
            stopAnimationLoop();
        }
    });
    registerListener(window, 'beforeunload', stopAnimationLoop);
}

/**
 * Creates the AudioContext. Must run inside a user gesture.
 * @returns {Promise<boolean>} True on success.
 */
async function initAudioEngine() {
    try {
        await audioEngine.init();
        return true;
    } catch (error) {
        logger.error('[App] Audio initialization failed:', audioEngine.getInitError() || error);
        showNotification(getTranslation('audio.initError'), 'error');
        return false;
    }
}

/**
 * The visualizer depends on the AnalyserNode created by `audioEngine.init()`.
 */
function initVisualizer() {
    try {
        const visualizer = new Visualizer(
            audioEngine.getAnalyser(),
            document.getElementById('visualizer-canvas-top'),
            document.getElementById('visualizer-canvas-bottom')
        );
        visualizer.draw();
        setVisualizer(visualizer);
        initializeVisualizerControls();
    } catch (error) {
        logger.error('[App] Unable to initialize visualizer:', error);
    }
}

/**
 * Loads the first catalog project and the MIDI system in parallel.
 * @param {Promise<object|null>} catalogPromise
 */
async function loadInitialProjectAndMidi(catalogPromise) {
    const midiPromise = initMidi().catch(error => logger.error('[App] MIDI initialization failed:', error));
    const catalog = await catalogPromise;
    const firstProject = catalog?.projects?.[0];

    if (firstProject) {
        debug('Loading initial project after interaction...');
        const firstProjectButton = document.querySelector('#project-menu .menu-option');
        await Promise.all([loadProject(firstProject.configPath, firstProjectButton), midiPromise]);
        debug('Initial project and MIDI system loaded.');
    } else {
        await midiPromise;
    }
}

/**
 * Browsers only allow audio after a user gesture, so the first click/touch
 * unlocks audio and then loads the initial content. If audio fails, the
 * listeners stay registered so the next interaction retries the unlock; the
 * initial content is requested only once either way.
 * @param {Promise<object|null>} catalogPromise
 */
function initFirstInteractionUnlock(catalogPromise) {
    const overlay = document.getElementById('audio-unlock-overlay');
    let audioUnlocked = false;
    let unlockInProgress = false;
    let initialContentRequested = false;

    const handleGesture = async () => {
        if (audioUnlocked || unlockInProgress) return;
        unlockInProgress = true;

        changeMode(DEFAULT_MODE_INDEX);
        const progressText = overlay?.querySelector('p');
        if (progressText) {
            progressText.textContent = getTranslation('overlay.loading').replace('{progress}', '0');
        }

        try {
            audioUnlocked = await initAudioEngine();
        } finally {
            unlockInProgress = false;
        }

        // Hide the overlay so the app stays usable even if audio failed.
        overlay?.classList.add('hidden');

        if (audioUnlocked) {
            removeListener(document, 'click', handleGesture);
            removeListener(document, 'touchstart', handleGesture);
            initVisualizer();
        }

        if (!initialContentRequested) {
            initialContentRequested = true;
            await loadInitialProjectAndMidi(catalogPromise);
        }
    };

    registerListener(document, 'click', handleGesture);
    registerListener(document, 'touchstart', handleGesture);
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Relative URL so the SW works regardless of the deployment subdirectory.
    const swUrl = isDebugSettingEnabled() ? './service-worker.js?debug=1' : './service-worker.js';
    const register = () => {
        navigator.serviceWorker.register(swUrl)
            .then(registration => debug('Service Worker registered: ', registration))
            .catch(error => logger.error('[App] Service Worker registration failed: ', error));
    };

    if (document.readyState === 'complete') {
        register();
    } else {
        registerListener(window, 'load', register);
    }
}

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    initCoreUi();
    const catalogPromise = initCatalogMenus();
    initFirstInteractionUnlock(catalogPromise);
    initAnimationLifecycle();
    await initializeLanguageControls();

    await catalogPromise;
    registerServiceWorker();
});
