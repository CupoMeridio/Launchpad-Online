/**
 * =============================================================================
 * LAUNCHPAD PWA - JAVASCRIPT ENTRY POINT (app.js)
 * =============================================================================
 */

// Moduli principali dell'applicazione
import { audioEngine } from './audio.js';
import { Visualizer } from './visualizer.js';
import { initMidi, resetLaunchpadLEDs } from './midi.js';

// Funzioni di inizializzazione e gestione dai moduli separati
import { initializeVisualizerControls } from './visualizer-controls.js';
import { initializeVideoControls } from './video.js';
import { loadProject, initializeProjectMenu, initializeBackgroundMenu } from './project.js';
import { initializePersonalizeLaunchpadMenu } from './ui.js';

// ----------------------------------------------------------------------------
// STATO GLOBALE DELL'APPLICAZIONE
// ----------------------------------------------------------------------------
// Esportiamo le variabili di stato e le funzioni per modificarle.
// In questo modo, gli altri moduli possono importare e modificare lo stato
// in modo controllato, senza usare variabili globali non sicure.

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
// PUNTO DI INGRESSO PRINCIPALE (DOMContentLoaded)
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. Sblocco dell'AudioContext ---
    const unlockOverlay = document.getElementById('audio-unlock-overlay');
    const unlockAudioAndHideOverlay = () => {
        if (unlockOverlay) {
            unlockOverlay.classList.add('hidden');
        }
        if (audioEngine.audioContext.state === 'suspended') {
            audioEngine.audioContext.resume().then(() => {
                console.log('AudioContext ripreso con successo.');
            });
        }
    };
    document.addEventListener('click', unlockAudioAndHideOverlay, { once: true });
    document.addEventListener('touchstart', unlockAudioAndHideOverlay, { once: true });

    // --- 2. Inizializzazione dei controlli UI ---
    initializeVideoControls();
    initializeVisualizerControls();

    // --- 3. Caricamento dei dati statici per i menu ---
    try {
        const response = await fetch('js/static-data.json');
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const data = await response.json();

        initializeBackgroundMenu(data.videos);
        initializePersonalizeLaunchpadMenu(data.skins);
        initializeProjectMenu(data.projects);

        // --- 4. Caricamento del progetto di default ---
        if (data.projects && data.projects.length > 0) {
            const firstProjectButton = document.querySelector('#project-menu .menu-option');
            await loadProject(data.projects[0].configPath, firstProjectButton);
        }

    } catch (error) {
        console.error("Impossibile caricare i dati statici per i menu:", error);
    }

    // --- 5. Inizializzazione del visualizzatore audio ---
    try {
        const analyser = audioEngine.getAnalyser();
        const canvasTop = document.getElementById('visualizer-canvas-top');
        const canvasBottom = document.getElementById('visualizer-canvas-bottom');
        
        const visualizer = new Visualizer(analyser, canvasTop, canvasBottom);
        visualizer.draw();
        // L'oggetto visualizer deve essere globale perché è usato dagli attributi onclick nell'HTML
        window.visualizer = visualizer;

    } catch (error) {
        console.error("Impossibile inizializzare il visualizzatore:", error);
    }

    // --- 6. Inizializzazione del supporto MIDI ---
    initMidi();
    
    window.addEventListener('pagehide', () => {
        resetLaunchpadLEDs();
    });

    // --- 7. Registrazione del Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => console.log('Service Worker registrato: ', registration))
                .catch(registrationError => console.log('Registrazione Service Worker fallita: ', registrationError));
        });
    }
});
