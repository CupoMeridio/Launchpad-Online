/**
 * =============================================================================
 * LAUNCHPAD PWA - JAVASCRIPT ENTRY POINT (app.js)
 * =============================================================================
 */

// Main application modules
import { audioEngine } from './audio.js';
import { Visualizer } from './visualizer.js';
import { initMidi } from './midi.js';

// Initialization and management functions from separate modules
import { initializeVisualizerControls } from './visualizer-controls.js';
import { initializeVideoControls } from './video.js';
import { loadProject, initializeProjectMenu, initializeBackgroundMenu } from './project.js';
import { initializePersonalizeLaunchpadMenu, initializeLanguageControls } from './ui.js';
import { initInteraction, changeSoundSet } from './interaction.js';

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
export let currentPage = 0;
export let activePageButton = null;

export function setCurrentProject(p) { currentProject = p; }
export function setSelectedProjectButton(b) { selectedProjectButton = b; }
export function setProjectSounds(s) { projectSounds = s; }
export function setProjectLights(l) { projectLights = l; }
export function setCurrentPage(p) { currentPage = p; }
export function setActivePageButton(b) { activePageButton = b; }
let midiInitialized = false;

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT (DOMContentLoaded)
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. AudioContext Unlock ---
    const unlockOverlay = document.getElementById('audio-unlock-overlay');
    let audioUnlocked = false; // Flag to avoid double execution

    // Initialize UI interactions
    initInteraction();
    
    const unlockAudioAndHideOverlay = () => {
        if (audioUnlocked) return; // Exit if already unlocked
        audioUnlocked = true; // Set the flag
        
        if (unlockOverlay) {
            unlockOverlay.classList.add('hidden');
        }
        if (audioEngine.audioContext.state === 'suspended') {
            audioEngine.audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully.');
                // Trigger visual update for the current page once audio is unlocked
                changeSoundSet(currentPage);
            });
        } else {
            // If already running, just update visuals
            changeSoundSet(currentPage);
        }
        if (!midiInitialized) {
            initMidi().catch(error => console.error("Error during MIDI initialization:", error));
            midiInitialized = true;
        }
        
        // Remove both event listeners to be safe
        document.removeEventListener('click', unlockAudioAndHideOverlay);
        document.removeEventListener('touchstart', unlockAudioAndHideOverlay);
    };
    
    // Add both event listeners but without { once: true }
    // so we can remove them manually after the first execution
    document.addEventListener('click', unlockAudioAndHideOverlay);
    document.addEventListener('touchstart', unlockAudioAndHideOverlay);

    // --- 2. UI Controls Initialization ---
    initializeVideoControls();
    initializeLanguageControls();
    initializeVisualizerControls();

    document.querySelectorAll('.menu-dropdown.open').forEach(dropdown => {
        const menuItem = dropdown.closest('.menu-item');
        const toggleButton = menuItem ? menuItem.querySelector('.menu-toggle') : null;
        if (toggleButton) toggleButton.classList.add('active');
    });

    // --- 3. Static Data Loading for Menus ---
    try {
        const response = await fetch('js/static-data.json');
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        const data = await response.json();

        initializeBackgroundMenu(data.videos);
        initializeProjectMenu(data.projects);
        initializePersonalizeLaunchpadMenu(data.skins);

        // --- 4. Default Project Loading ---
        if (data.projects && data.projects.length > 0) {
            const firstProjectButton = document.querySelector('#project-menu .menu-option');
            await loadProject(data.projects[0].configPath, firstProjectButton);
        }

    } catch (error) {
        console.error("Unable to load static data for menus:", error);
    }

    // --- 5. Audio Visualizer Initialization ---
    try {
        const analyser = audioEngine.getAnalyser();
        const canvasTop = document.getElementById('visualizer-canvas-top');
        const canvasBottom = document.getElementById('visualizer-canvas-bottom');
        
        const visualizer = new Visualizer(analyser, canvasTop, canvasBottom);
        visualizer.draw();
        // The visualizer object must be global as it's used by onclick attributes in HTML
        window.visualizer = visualizer;

    } catch (error) {
        console.error("Unable to initialize visualizer:", error);
    }

    

    // --- 7. Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => console.log('Service Worker registered: ', registration))
                .catch(registrationError => console.log('Service Worker registration failed: ', registrationError));
        });
    }
});
