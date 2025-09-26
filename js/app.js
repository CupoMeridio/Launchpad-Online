/**
 * Launchpad PWA – entry point
 * ===========================
 * Questo modulo inizializza l’interfaccia (griglia 8×8 di pad) e collega
 * l’audio al click di ogni pad.  Viene eseguito solo dopo che il DOM è
 * completamente costruito (grazie a `defer` o `DOMContentLoaded`).
 */

/* ---------------------------------------------
 * 1. Importiamo i moduli necessari
 * --------------------------------------------- */
import { audioEngine } from './audio.js'; // gestisce i suoni
import { Visualizer } from './visualizer.js'; // gestisce il visualizzatore
import { initMidi, setActivePageLED, resetLaunchpadLEDs } from './midi.js'; // gestisce l'input da MIDI controller

/* ---------------------------------------------
 * 2. Definiamo le funzioni globali
 * --------------------------------------------- */

let currentProject = null;
let selectedProjectButton = null;
let projectSounds = [];
window.currentPage = 0;
let activePageButton = null;

window.playSound = function(event, index) {
    // Ottiene l'elemento pad che ha scatenato l'evento
    const pad = event.target;

    /* -------------------------------------
     * 3a. Suono
     * ------------------------------------- */
    const soundIndex = currentPage * 64 + index;
    audioEngine.playPadSound(soundIndex);

    /* -------------------------------------
     * 3b. Feedback visivo istantaneo
     *     (classe CSS `active` → colore
     *      diverso, scala, ombre…)
     * ------------------------------------- */
    // Aggiunge la classe 'active' per il feedback visivo
    pad.classList.add('active');

    // Rimuove la classe 'active' dopo un breve ritardo per l'animazione
    setTimeout(() => pad.classList.remove('active'), 100);
}

window.triggerPad = function(index) {
    const pads = document.querySelectorAll('.grid-item');
    if (index >= 0 && index < pads.length) {
        const pad = pads[index];
        const soundIndex = currentPage * 64 + index;

        // 1. Suono
        audioEngine.playPadSound(soundIndex);

        // 2. Feedback visivo
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    }
}

window.changeSoundSet = function(index) {
    if (currentProject && index < currentProject.pages.length) {
        currentPage = index;
        console.log(`Changed to page ${index}`);

        const pageButtons = document.querySelectorAll('.grid-item-menu[onclick^="changeSoundSet"]');
        if (activePageButton) {
            activePageButton.classList.remove('selected');
        }
        activePageButton = pageButtons[index];
                    if (activePageButton) {
                        activePageButton.classList.add('selected');
                    }
        
                    // Aggiorna il LED sul Launchpad fisico
                    setActivePageLED(index);    } else {
        // Feedback visivo per azione non valida
        console.warn(`Tentativo di accesso a pagina non esistente: ${index}`);
        const launchpadElement = document.getElementById('Launchpad');
        if (launchpadElement) {
            launchpadElement.classList.add('error-shake');
            setTimeout(() => {
                launchpadElement.classList.remove('error-shake');
            }, 500); // Corrisponde alla durata dell'animazione
        }
    }
}

window.toggleSidebar = function() {
    // Seleziona l'elemento del layout principale
    const layout = document.querySelector('.layout');
    // Alterna la classe 'sidebar-open' per mostrare/nascondere la sidebar
    layout.classList.toggle('sidebar-open');
}

window.toggleMenu = function(menuId) {
    const menu = document.getElementById(menuId);
    menu.classList.toggle('open');

    // Se il menu è quello del background, aggiorna la visibilità dei controlli
    if (menuId === 'background-menu') {
        updateVideoControlsVisibility();
    }
};

// Variabili globali per i controlli video
let currentVideo = null;

// Funzione unificata per gestire la visibilità dei controlli video
function updateVideoControlsVisibility() {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = document.querySelector('.video-controls');
    if (!videoControls || !backgroundMenu) return;

    const isVideoActive = currentVideo !== null;
    const isMenuOpen = backgroundMenu.classList.contains('open');

    // Mostra i controlli solo se ENTRAMBE le condizioni sono vere
    if (isVideoActive && isMenuOpen) {
        videoControls.classList.add('visible');
    } else {
        videoControls.classList.remove('visible');
    }
}

// Funzione per caricare e applicare i video background
window.setBackgroundVideo = function(videoFile) {
    const overlay = document.querySelector('.video-overlay');
    
    // Rimuovi eventuale video precedente presente nel DOM
    const existingVideo = document.querySelector('.background-video');
    if (existingVideo) {
        existingVideo.remove();
    }
    
    // Se è stato fornito un file video, crea e aggiungi il nuovo video
    if (videoFile) {
        const video = document.createElement('video');
        video.className = 'background-video';
        video.src = `assets/videos/${videoFile}?t=${new Date().getTime()}`;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        
        document.body.appendChild(video);
        overlay.classList.add('active');
        currentVideo = video;
        
        applyVideoEffects();
    } else {
        // Se nessun file video è fornito (es. "Nessun background")
        overlay.classList.remove('active');
        currentVideo = null;
        resetVideoControls();
    }

    // Alla fine, chiama sempre la funzione unificata per aggiornare la visibilità
    updateVideoControlsVisibility();
};

// Funzione per resettare i controlli video ai valori di default
function resetVideoControls() {
    // Seleziona tutti gli slider e gli input numerici dei controlli video
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');
    
    // Se gli slider esistono, resetta i loro valori ai default
    if (opacitySlider && blurSlider && brightnessSlider) {
        opacitySlider.value = 0;
        blurSlider.value = 0;
        brightnessSlider.value = 1;
        
        // Se gli input numerici esistono, resetta anche i loro valori
        if (opacityInput && blurInput && brightnessInput) {
            opacityInput.value = 0;
            blurInput.value = 0;
            brightnessInput.value = 1;
        }
        
        // Applica gli effetti con i valori resettati
        applyVideoEffects();
    }
}

// Funzione per applicare gli effetti ai video
function applyVideoEffects() {
    // Seleziona l'overlay video e gli input dei controlli
    const overlay = document.querySelector('.video-overlay');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');
    
    // Applica gli effetti solo se tutti gli elementi necessari esistono
    if (overlay && opacityInput && blurInput && brightnessInput) {
        // Opacità overlay: imposta il colore di sfondo dell'overlay con l'opacità desiderata
        const opacity = opacityInput.value;
        overlay.style.backgroundColor = `rgba(18, 18, 18, ${opacity})`;
        
        // Sfocatura e luminosità del video (se un video è attualmente in riproduzione)
        const blur = blurInput.value;
        const brightness = brightnessInput.value;
        if (currentVideo) {
            currentVideo.style.filter = `blur(${blur}px) brightness(${brightness})`;
        }
    }
}

// Inizializza i controlli video (slider e input numerici)
function initializeVideoControls() {
    // Seleziona tutti gli slider e gli input numerici dei controlli video
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');
    
    // Se gli slider esistono, aggiungi i listener per la sincronizzazione
    if (opacitySlider && blurSlider && brightnessSlider) {
        // Funzione helper per sincronizzare lo slider e l'input numerico associato
        function syncSliderInput(slider, input) {
            // Aggiorna l'input numerico e applica gli effetti quando lo slider cambia
            slider.addEventListener('input', function() {
                input.value = this.value;
                applyVideoEffects();
            });
            
            // Aggiorna lo slider e applica gli effetti quando l'input numerico cambia
            input.addEventListener('input', function() {
                let value = parseFloat(this.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                
                // Limita il valore entro i range definiti dallo slider
                value = Math.max(min, Math.min(max, value));
                this.value = value;
                slider.value = value;
                applyVideoEffects();
            });
        }
        
        // Sincronizza tutti i controlli video
        syncSliderInput(opacitySlider, opacityInput);
        syncSliderInput(blurSlider, blurInput);
        syncSliderInput(brightnessSlider, brightnessInput);
    }
}

// Inizializza i controlli del visualizzatore (es. fluidità)
function initializeVisualizerControls() {
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');

    if (smoothingSlider && smoothingInput) {
        function syncSmoothingControls(slider, input) {
            slider.addEventListener('input', function() {
                input.value = this.value;
                if (window.visualizer) {
                    window.visualizer.setSmoothing(this.value);
                }
            });

            input.addEventListener('input', function() {
                let value = parseFloat(this.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                
                value = Math.max(min, Math.min(max, value));
                this.value = value;
                slider.value = value;
                if (window.visualizer) {
                    window.visualizer.setSmoothing(this.value);
                }
            });
        }
        syncSmoothingControls(smoothingSlider, smoothingInput);
    }
}

// Inizializzazione: carica i video nella sidebar
function initializeBackgroundMenu(videoFiles) {
    // Seleziona il menu a discesa per i background
    const backgroundMenu = document.getElementById('background-menu');
    // Seleziona il contenitore dei controlli video all'interno del menu background
    const videoControls = backgroundMenu.querySelector('.video-controls');

    // Per ogni file video, crea un pulsante nel menu
    videoFiles.forEach(videoFile => {
        const button = document.createElement('button');
        button.className = 'menu-option'; // Assegna la classe CSS per lo stile
        button.textContent = videoFile.replace('.mp4', ''); // Imposta il testo del pulsante (nome del file senza estensione)
        button.onclick = () => setBackgroundVideo(videoFile); // Assegna la funzione da chiamare al click
        
        // Inserisce i pulsanti dei video prima del blocco dei controlli video
        backgroundMenu.insertBefore(button, videoControls);
    });
}

async function loadProject(configPath, button) {
    try {
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const project = await response.json();
        currentProject = project;

        // Load all sounds from all pages
        projectSounds = [];
        if (project.pages) {
            project.pages.forEach(page => {
                projectSounds.push(...page.sounds);
            });
        }
        await audioEngine.loadSounds(projectSounds);

        setLaunchpadBackground(project.coverImage);

        if (selectedProjectButton) {
            selectedProjectButton.classList.remove('selected');
        }
        if (button) {
            button.classList.add('selected');
            selectedProjectButton = button;
        }

        // Reset to the first page and select the first page button
        changeSoundSet(0);

        console.log(`Project "${project.name}" loaded.`);
    } catch (error) {
        console.error("Failed to load project:", error);
    }
}

function initializeProjectMenu(projects) {
    const projectMenu = document.getElementById('project-menu');
    if (!projectMenu) return;

    projects.forEach((project, index) => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = project.name;
        button.onclick = () => loadProject(project.configPath, button);
        projectMenu.appendChild(button);

        // Automatically select the first project
        if (index === 0) {
            selectedProjectButton = button;
        }
    });
}

// Inizializza le funzioni quando il DOM è completamente caricato
document.addEventListener('DOMContentLoaded', async function() {
    // Gestisce lo sblocco dell'AudioContext e l'overlay di avviso
    const unlockOverlay = document.getElementById('audio-unlock-overlay');
    const unlockAudioAndHideOverlay = () => {
        if (unlockOverlay) {
            unlockOverlay.classList.add('hidden');
        }
        if (audioEngine.audioContext.state === 'suspended') {
            audioEngine.audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully.');
            });
        }
    };
    document.addEventListener('click', unlockAudioAndHideOverlay, { once: true });
    document.addEventListener('touchstart', unlockAudioAndHideOverlay, { once: true });
    // Inizializza i controlli che non dipendono da dati esterni
    initializeVideoControls();
    initializeVisualizerControls();

    // Carica i dati statici e inizializza i moduli dipendenti
    try {
        const response = await fetch('js/static-data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Inizializza i menu con i dati caricati
        initializeBackgroundMenu(data.videos);
        initializePersonalizeLaunchpadMenu(data.skins);
        initializeProjectMenu(data.projects);

        // Carica il primo progetto di default, con un suo blocco try-catch
        if (data.projects && data.projects.length > 0) {
            try {
                const firstProjectButton = document.querySelector('#project-menu .menu-option');
                await loadProject(data.projects[0].configPath, firstProjectButton);
            } catch (projectError) {
                console.error("Failed to load the default project:", projectError);
            }
        }

    } catch (error) {
        console.error("Failed to load static data for menus:", error);
    }

    // Inizializzazione visualizzatore (indipendente dai dati statici)
    try {
        const analyser = audioEngine.getAnalyser();
        const canvasTop = document.getElementById('visualizer-canvas-top');
        const canvasBottom = document.getElementById('visualizer-canvas-bottom');
        
        const visualizer = new Visualizer(analyser, canvasTop, canvasBottom);
        visualizer.draw();
        window.visualizer = visualizer;

    } catch (error) {
        console.error("Failed to initialize visualizer:", error);
    }

            // Inizializza il supporto MIDI
            initMidi();
    
            // Registra la funzione di pulizia per spegnere i LED del Launchpad alla chiusura della pagina
        window.addEventListener('pagehide', () => {
            resetLaunchpadLEDs();
        });    // Registra il Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('Service Worker registration failed: ', registrationError);
                });
        });
    }
});

window.setLaunchpadBackground = function(imageFile) {
    const launchpad = document.getElementById('Launchpad');
    if (imageFile) {
        launchpad.style.backgroundImage = `url('/assets/images/launchpad covers/${imageFile}?t=${new Date().getTime()}')`;
    } else {
        launchpad.style.backgroundImage = 'none';
    }
};

window.toggleLaunchpadStickers = function(isActive) {
    const launchpad = document.getElementById('Launchpad');
    if (isActive) {
        launchpad.classList.add('has-stickers');
    } else {
        launchpad.classList.remove('has-stickers');
    }
};

function initializePersonalizeLaunchpadMenu(imageFiles) {
    const menu = document.getElementById('personalize-launchpad-menu');
    
    imageFiles.forEach(imageFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = imageFile.split('.')[0];
        button.onclick = () => setLaunchpadBackground(imageFile);
        menu.appendChild(button);
    });
}