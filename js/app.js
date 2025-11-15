/**
 * =============================================================================
 * LAUNCHPAD PWA - JAVASCRIPT ENTRY POINT (app.js)
 * =============================================================================
 */

// Moduli principali dell'applicazione
import { audioEngine } from './audio.js';
import { Visualizer } from './visualizer.js';
import { initMidi } from './midi.js';

// Funzioni di inizializzazione e gestione dai moduli separati
import { initializeVisualizerControls } from './visualizer-controls.js';
import { initializeVideoControls } from './video.js';
import { loadProject, initializeProjectMenu, initializeBackgroundMenu } from './project.js';
import { initializePersonalizeLaunchpadMenu } from './ui.js';

// ----------------------------------------------------------------------------
// APPLICATION GLOBAL STATE
// ----------------------------------------------------------------------------
// Export state variables and functions to modify them.
// This way, other modules can import and modify state
// in a controlled manner, without using unsafe global variables.

export let currentProject = null;
export let selectedProjectButton = null;
export let projectSounds = [];
export let currentPage = 0;
export let activePageButton = null;

export function setCurrentProject(p) { currentProject = p; }
export function setSelectedProjectButton(b) { selectedProjectButton = b; }
export function setProjectSounds(s) { projectSounds = s; }
export function setCurrentPage(p) { currentPage = p; }
export function setActivePageButton(b) { activePageButton = b; }

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT (DOMContentLoaded)
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. AudioContext Unlock ---
    const unlockOverlay = document.getElementById('audio-unlock-overlay');
    let audioUnlocked = false; // Flag per evitare doppie esecuzioni
    
    const unlockAudioAndHideOverlay = () => {
        if (audioUnlocked) return; // Esci se già sbloccato
        audioUnlocked = true; // Imposta il flag
        
        if (unlockOverlay) {
            unlockOverlay.classList.add('hidden');
        }
        if (audioEngine.audioContext.state === 'suspended') {
            audioEngine.audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully.');
            });
        }
        
        // Rimuovi entrambi gli event listeners per essere sicuri
        document.removeEventListener('click', unlockAudioAndHideOverlay);
        document.removeEventListener('touchstart', unlockAudioAndHideOverlay);
    };
    
    // Aggiungi entrambi gli event listeners ma senza { once: true }
    // così possiamo rimuoverli manualmente dopo la prima esecuzione
    document.addEventListener('click', unlockAudioAndHideOverlay);
    document.addEventListener('touchstart', unlockAudioAndHideOverlay);

    // --- 2. UI Controls Initialization ---
    initializeVideoControls();
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

    // --- 6. MIDI Support Initialization ---
    try {
        await initMidi();
    } catch (error) {
        console.error("Error during MIDI initialization:", error);
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
