/**
 * =============================================================================
 * LAUNCHPAD PWA - JAVASCRIPT ENTRY POINT (app.js)
 * =============================================================================
 * 
 * Questo è il file JavaScript principale dell'applicazione.
 * Si occupa di:
 * 1. Importare i moduli specializzati (audio, visualizzatore, MIDI).
 * 2. Inizializzare l'intera interfaccia utente (UI).
 * 3. Gestire la logica di interazione: click sui pad, cambio pagina, menu.
 * 4. Caricare i progetti e i campioni audio.
 * 5. Controllare gli effetti visivi come il background video e il visualizzatore.
 * 6. Registrare il Service Worker per le funzionalità PWA.
 *
 * L'esecuzione di questo script è posticipata (`defer`) fino al completo caricamento
 * del DOM, garantendo che tutti gli elementi HTML siano disponibili.
 */

/*
 * -----------------------------------------------------------------------------
 * 1. IMPORTAZIONE DEI MODULI
 * -----------------------------------------------------------------------------
 * L'applicazione è suddivisa in moduli per una migliore organizzazione del codice.
 */
import { audioEngine } from './audio.js'; // Gestisce tutto ciò che riguarda l'audio: caricamento e riproduzione dei suoni.
import { Visualizer } from './visualizer.js'; // Gestisce il visualizzatore audio su canvas.
import { initMidi, setActivePageLED, resetLaunchpadLEDs } from './midi.js'; // Gestisce l'interazione con controller MIDI fisici (es. Novation Launchpad).

/*
 * -----------------------------------------------------------------------------
 * 2. VARIABILI GLOBALI E STATO DELL'APPLICAZIONE
 * -----------------------------------------------------------------------------
 * Queste variabili mantengono lo stato corrente dell'applicazione, come il progetto
 * caricato, la pagina di suoni attiva, ecc.
 */

let currentProject = null; // Oggetto contenente le informazioni del progetto attualmente caricato (da file JSON).
let selectedProjectButton = null; // Riferimento all'elemento HTML del pulsante del progetto selezionato nel menu.
let projectSounds = []; // Array che conterrà tutti i percorsi dei suoni del progetto corrente.
window.currentPage = 0; // Indice della pagina di suoni attualmente visualizzata (0-7). Resa globale per accessibilità da altri moduli/HTML.
let activePageButton = null; // Riferimento al pulsante della pagina attiva (m1-m8).

/*
 * -----------------------------------------------------------------------------
 * 3. FUNZIONI CORE DI INTERAZIONE
 * -----------------------------------------------------------------------------
 * Funzioni esposte globalmente (attraverso `window.`) per essere chiamate
 * direttamente dall'HTML (es. `onclick="..."`).
 */

/**
 * Chiamata quando un pad della griglia 8x8 viene premuto.
 * @param {Event} event - L'oggetto evento del click.
 * @param {number} index - L'indice del pad (0-63) premuto.
 */
window.playSound = function(event, index) {
    const pad = event.target; // L'elemento <button> premuto.

    // Calcola l'indice globale del suono da riprodurre, considerando la pagina corrente.
    const soundIndex = window.currentPage * 64 + index;
    audioEngine.playPadSound(soundIndex); // Chiama il motore audio per riprodurre il suono.

    // Fornisce un feedback visivo immediato aggiungendo una classe CSS.
    pad.classList.add('active');
    // Rimuove la classe dopo un breve ritardo per creare un effetto "flash".
    setTimeout(() => pad.classList.remove('active'), 100);
}

/**
 * Attiva un pad programmaticamente (es. tramite input MIDI).
 * @param {number} index - L'indice del pad da attivare (0-63).
 */
window.triggerPad = function(index) {
    const pads = document.querySelectorAll('.grid-item');
    if (index >= 0 && index < pads.length) {
        const pad = pads[index];
        const soundIndex = window.currentPage * 64 + index;

        // 1. Riproduce il suono
        audioEngine.playPadSound(soundIndex);

        // 2. Fornisce il feedback visivo
        pad.classList.add('active');
        setTimeout(() => pad.classList.remove('active'), 100);
    }
}

/**
 * Cambia la pagina di suoni corrente.
 * @param {number} index - L'indice della pagina da caricare (0-7).
 */
window.changeSoundSet = function(index) {
    // Controlla se il progetto è caricato e se la pagina richiesta esiste.
    if (currentProject && index < currentProject.pages.length) {
        window.currentPage = index;
        console.log(`Cambiata pagina: ${index}`);

        // Aggiorna il feedback visivo per il pulsante della pagina selezionata.
        const pageButtons = document.querySelectorAll('.grid-item-menu[onclick^="changeSoundSet"]');
        if (activePageButton) {
            activePageButton.classList.remove('selected');
        }
        activePageButton = pageButtons[index];
        if (activePageButton) {
            activePageButton.classList.add('selected');
        }
        
        // Aggiorna il LED sul Launchpad fisico, se connesso.
        setActivePageLED(index);
    } else {
        // Se la pagina non esiste, fornisce un feedback di errore visivo (scuotimento).
        console.warn(`Tentativo di accesso a pagina non esistente: ${index}`);
        const launchpadElement = document.getElementById('Launchpad');
        if (launchpadElement) {
            launchpadElement.classList.add('error-shake');
            setTimeout(() => {
                launchpadElement.classList.remove('error-shake');
            }, 500); // La durata deve corrispondere a quella dell'animazione CSS.
        }
    }
}

/*
 * -----------------------------------------------------------------------------
 * 4. FUNZIONI DI GESTIONE DELLA UI (SIDEBAR E MENU)
 * -----------------------------------------------------------------------------
 */

/**
 * Mostra o nasconde la sidebar.
 */
window.toggleSidebar = function() {
    const layout = document.querySelector('.layout');
    layout.classList.toggle('sidebar-open'); // Aggiunge/rimuove la classe che controlla la visibilità.
}

/**
 * Apre o chiude un menu a tendina nella sidebar.
 * @param {string} menuId - L'ID dell'elemento del menu da aprire/chiudere.
 */
window.toggleMenu = function(menuId) {
    const menu = document.getElementById(menuId);
    menu.classList.toggle('open');

    // Caso speciale: se si apre/chiude il menu del background, aggiorna la visibilità dei controlli video.
    if (menuId === 'background-menu') {
        updateVideoControlsVisibility();
    }
};

/*
 * -----------------------------------------------------------------------------
 * 5. GESTIONE DEL BACKGROUND VIDEO
 * -----------------------------------------------------------------------------
 * Logica per impostare, rimuovere e personalizzare il video di sfondo.
 */

let currentVideo = null; // Riferimento all'elemento <video> attualmente in riproduzione.

// Definisce i valori di default per gli effetti video.
// Agisce come "single source of truth" per lo stato iniziale e il reset.
const VIDEO_EFFECT_DEFAULTS = {
    opacity: 0,
    blur: 0,
    brightness: 1
};

/**
 * Mostra o nasconde i controlli (slider) per il video di sfondo.
 * I controlli sono visibili solo se c'è un video attivo E il menu del background è aperto.
 */
function updateVideoControlsVisibility() {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = document.querySelector('.video-controls');
    if (!videoControls || !backgroundMenu) return;

    const isVideoActive = currentVideo !== null;
    const isMenuOpen = backgroundMenu.classList.contains('open');

    if (isVideoActive && isMenuOpen) {
        videoControls.classList.add('visible');
    } else {
        videoControls.classList.remove('visible');
    }
}

/**
 * Imposta o rimuove il video di sfondo.
 * @param {string|null} videoFile - Il nome del file video da caricare, o `null` per rimuoverlo.
 */
window.setBackgroundVideo = function(videoFile) {
    const overlay = document.querySelector('.video-overlay');
    
    // Rimuove qualsiasi video precedente.
    const existingVideo = document.querySelector('.background-video');
    if (existingVideo) {
        existingVideo.remove();
    }
    
    if (videoFile) {
        // Se viene fornito un file, crea un nuovo elemento <video>.
        const video = document.createElement('video');
        video.className = 'background-video';
        video.src = `assets/videos/${videoFile}?t=${new Date().getTime()}`; // Aggiungo un timestamp per evitare problemi di cache.
        video.autoplay = true;
        video.loop = true;
        video.muted = true; // I video di sfondo devono essere muti.
        
        document.body.appendChild(video);
        overlay.classList.add('active');
        currentVideo = video;
        
        applyVideoEffects(); // Applica subito gli effetti correnti (es. luminosità).
    } else {
        // Se `videoFile` è nullo, rimuoviamo lo sfondo.
        overlay.classList.remove('active');
        currentVideo = null;
        resetVideoControls(); // Resetta i valori degli slider.
    }

    updateVideoControlsVisibility(); // Aggiorna la visibilità dei controlli.
};

/**
 * Resetta i valori degli slider per gli effetti video ai loro default,
 * leggendoli dalla costante VIDEO_EFFECT_DEFAULTS.
 */
function resetVideoControls() {
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');
    
    if (opacitySlider && blurSlider && brightnessSlider) {
        opacitySlider.value = VIDEO_EFFECT_DEFAULTS.opacity;
        blurSlider.value = VIDEO_EFFECT_DEFAULTS.blur;
        brightnessSlider.value = VIDEO_EFFECT_DEFAULTS.brightness;
        
        if (opacityInput && blurInput && brightnessInput) {
            opacityInput.value = VIDEO_EFFECT_DEFAULTS.opacity;
            blurInput.value = VIDEO_EFFECT_DEFAULTS.blur;
            brightnessInput.value = VIDEO_EFFECT_DEFAULTS.brightness;
        }
        
        applyVideoEffects(); // Applica gli effetti resettati.
    }
}

/**
 * Applica gli effetti (opacità, sfocatura, luminosità) basandosi sui valori correnti degli slider.
 */
function applyVideoEffects() {
    const overlay = document.querySelector('.video-overlay');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');
    
    if (overlay && opacityInput && blurInput && brightnessInput) {
        // Applica l'opacità modificando il canale alpha del colore di sfondo dell'overlay.
        const opacity = opacityInput.value;
        overlay.style.backgroundColor = `rgba(18, 18, 18, ${opacity})`;
        
        // Applica sfocatura e luminosità direttamente al video tramite filtri CSS.
        const blur = blurInput.value;
        const brightness = brightnessInput.value;
        if (currentVideo) {
            currentVideo.style.filter = `blur(${blur}px) brightness(${brightness})`;
        }
    }
}

/**
 * Inizializza i controlli per gli effetti video, impostando i valori di default
 * e sincronizzando gli slider con i campi di input numerico.
 */
function initializeVideoControls() {
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');
    
    if (opacitySlider && blurSlider && brightnessSlider) {
        // Imposta i valori iniziali della UI leggendoli dalla costante dei default.
        opacitySlider.value = VIDEO_EFFECT_DEFAULTS.opacity;
        opacityInput.value = VIDEO_EFFECT_DEFAULTS.opacity;
        blurSlider.value = VIDEO_EFFECT_DEFAULTS.blur;
        blurInput.value = VIDEO_EFFECT_DEFAULTS.blur;
        brightnessSlider.value = VIDEO_EFFECT_DEFAULTS.brightness;
        brightnessInput.value = VIDEO_EFFECT_DEFAULTS.brightness;

        // Funzione helper per mantenere sincronizzati uno slider e un input.
        function syncSliderInput(slider, input) {
            // Quando lo slider si muove, aggiorna il valore dell'input.
            slider.addEventListener('input', function() {
                input.value = this.value;
                applyVideoEffects();
            });
            
            // Quando si scrive nell'input, aggiorna la posizione dello slider.
            input.addEventListener('input', function() {
                let value = parseFloat(this.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                
                // Assicura che il valore inserito sia nei limiti consentiti.
                value = Math.max(min, Math.min(max, value));
                this.value = value;
                slider.value = value;
                applyVideoEffects();
            });
        }
        
        syncSliderInput(opacitySlider, opacityInput);
        syncSliderInput(blurSlider, blurInput);
        syncSliderInput(brightnessSlider, brightnessInput);
    }
}

/*
 * -----------------------------------------------------------------------------
 * 6. GESTIONE DEL VISUALIZZATORE AUDIO
 * -----------------------------------------------------------------------------
 */

/**
 * Inizializza i controlli per il visualizzatore (es. slider della fluidità).
 * Questa funzione imposta anche il valore iniziale della UI in base al valore
 * predefinito nell'audio engine, che agisce come unica fonte di verità.
 */
function initializeVisualizerControls() {
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingInput = document.getElementById('smoothing-input');

    if (smoothingSlider && smoothingInput) {
        // Imposta il valore iniziale della UI leggendolo dall'AudioEngine.
        const initialValue = audioEngine.getAnalyser().smoothingTimeConstant;
        smoothingSlider.value = initialValue;
        smoothingInput.value = initialValue;

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

/*
 * -----------------------------------------------------------------------------
 * 7. CARICAMENTO DEI PROGETTI E INIZIALIZZAZIONE DEI MENU
 * -----------------------------------------------------------------------------
 */

/**
 * Popola dinamicamente il menu dei video di sfondo.
 * @param {string[]} videoFiles - Un array di nomi di file video.
 */
function initializeBackgroundMenu(videoFiles) {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = backgroundMenu.querySelector('.video-controls');

    videoFiles.forEach(videoFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = videoFile.replace('.mp4', ''); // Mostra il nome senza estensione.
        button.onclick = () => setBackgroundVideo(videoFile);
        backgroundMenu.insertBefore(button, videoControls); // Inserisce i pulsanti prima dei controlli.
    });
}

/**
 * Carica un progetto, i suoi suoni e imposta lo sfondo associato.
 * @param {string} configPath - Il percorso al file JSON di configurazione del progetto.
 * @param {HTMLElement} button - L'elemento pulsante cliccato, per aggiornare lo stato 'selected'.
 */
async function loadProject(configPath, button) {
    try {
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const project = await response.json();
        currentProject = project;

        // Estrae tutti i percorsi dei suoni da tutte le pagine del progetto.
        projectSounds = [];
        if (project.pages) {
            project.pages.forEach(page => {
                projectSounds.push(...page.sounds);
            });
        }
        // Passa l'intero array di suoni al motore audio per il caricamento.
        await audioEngine.loadSounds(projectSounds);

        // Imposta l'immagine di copertina del progetto come sfondo del Launchpad.
        setLaunchpadBackground(project.coverImage);

        // Aggiorna lo stato visivo del pulsante selezionato nel menu.
        if (selectedProjectButton) {
            selectedProjectButton.classList.remove('selected');
        }
        if (button) {
            button.classList.add('selected');
            selectedProjectButton = button;
        }

        // Torna alla prima pagina e seleziona il pulsante corrispondente.
        changeSoundSet(0);

        console.log(`Progetto "${project.name}" caricato.`);
    } catch (error) {
        console.error("Impossibile caricare il progetto:", error);
    }
}

/**
 * Popola dinamicamente il menu di selezione del progetto.
 * @param {object[]} projects - Array di oggetti progetto da `static-data.json`.
 */
function initializeProjectMenu(projects) {
    const projectMenu = document.getElementById('project-menu');
    if (!projectMenu) return;

    projects.forEach((project, index) => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = project.name;
        button.onclick = () => loadProject(project.configPath, button);
        projectMenu.appendChild(button);

        if (index === 0) {
            selectedProjectButton = button; // Pre-seleziona il primo progetto.
        }
    });
}

/*
 * -----------------------------------------------------------------------------
 * 8. PUNTO DI INGRESSO PRINCIPALE (DOMContentLoaded)
 * -----------------------------------------------------------------------------
 * Questo evento viene attivato quando l'HTML è stato completamente caricato e analizzato.
 * Da qui parte tutta l'inizializzazione dell'applicazione.
 */

document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. Sblocco dell'AudioContext ---
    // I browser moderni richiedono un'interazione dell'utente per avviare l'audio.
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
    // Lo sblocco avviene al primo click o tocco in qualsiasi punto della pagina.
    document.addEventListener('click', unlockAudioAndHideOverlay, { once: true });
    document.addEventListener('touchstart', unlockAudioAndHideOverlay, { once: true });

    // --- 2. Inizializzazione dei controlli UI ---
    initializeVideoControls();
    initializeVisualizerControls();

    // --- 3. Caricamento dei dati statici per i menu ---
    // Carichiamo un singolo file JSON che contiene gli elenchi di video, skin e progetti.
    // Questo riduce il numero di richieste di rete all'avvio.
    try {
        const response = await fetch('js/static-data.json');
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const data = await response.json();

        // Inizializza i vari menu con i dati caricati.
        initializeBackgroundMenu(data.videos);
        initializePersonalizeLaunchpadMenu(data.skins);
        initializeProjectMenu(data.projects);

        // --- 4. Caricamento del progetto di default ---
        if (data.projects && data.projects.length > 0) {
            try {
                const firstProjectButton = document.querySelector('#project-menu .menu-option');
                await loadProject(data.projects[0].configPath, firstProjectButton);
            } catch (projectError) {
                console.error("Impossibile caricare il progetto di default:", projectError);
            }
        }

    } catch (error) {
        console.error("Impossibile caricare i dati statici per i menu:", error);
    }

    // --- 5. Inizializzazione del visualizzatore audio ---
    try {
        const analyser = audioEngine.getAnalyser(); // Ottiene il nodo Analyser dal motore audio.
        const canvasTop = document.getElementById('visualizer-canvas-top');
        const canvasBottom = document.getElementById('visualizer-canvas-bottom');
        
        const visualizer = new Visualizer(analyser, canvasTop, canvasBottom);
        visualizer.draw(); // Avvia il ciclo di disegno.
        window.visualizer = visualizer; // Rende il visualizzatore accessibile globalmente.


    } catch (error) {
        console.error("Impossibile inizializzare il visualizzatore:", error);
    }

    // --- 6. Inizializzazione del supporto MIDI ---
    initMidi();
    
    // Spegne i LED del Launchpad quando la pagina viene chiusa o nascosta.
    window.addEventListener('pagehide', () => {
        resetLaunchpadLEDs();
    });

    // --- 7. Registrazione del Service Worker ---
    // Questo è il cuore della Progressive Web App (PWA).
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrato: ', registration);
                })
                .catch(registrationError => {
                    console.log('Registrazione Service Worker fallita: ', registrationError);
                });
        });
    }
});

/*
 * -----------------------------------------------------------------------------
 * 9. FUNZIONI DI PERSONALIZZAZIONE DEL LAUNCHPAD
 * -----------------------------------------------------------------------------
 */

/**
 * Imposta un'immagine di sfondo per il Launchpad.
 * @param {string|null} imageFile - Il nome del file immagine, o `null` per rimuoverlo.
 */
window.setLaunchpadBackground = function(imageFile) {
    const launchpad = document.getElementById('Launchpad');
    if (imageFile) {
        // PERSONALIZZAZIONE: Le immagini di sfondo sono caricate da qui.
        // Assicurati che il percorso sia corretto.
        launchpad.style.backgroundImage = `url('/assets/images/launchpad covers/${imageFile}?t=${new Date().getTime()}')`;
    } else {
        launchpad.style.backgroundImage = 'none';
    }
};

/**
 * Mostra o nasconde gli "adesivi" sui pad.
 * @param {boolean} isActive - `true` per mostrare gli adesivi, `false` per nasconderli.
 */
window.toggleLaunchpadStickers = function(isActive) {
    const launchpad = document.getElementById('Launchpad');
    if (isActive) {
        launchpad.classList.add('has-stickers');
    } else {
        launchpad.classList.remove('has-stickers');
    }
};

/**
 * Popola dinamicamente il menu per la personalizzazione dello sfondo del Launchpad.
 * @param {string[]} imageFiles - Un array di nomi di file immagine (skin).
 */
function initializePersonalizeLaunchpadMenu(imageFiles) {
    const menu = document.getElementById('personalize-launchpad-menu');
    
    imageFiles.forEach(imageFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = imageFile.split('.')[0].replace(/_/g, ' '); // Mostra un nome pulito.
        button.onclick = () => setLaunchpadBackground(imageFile);
        menu.appendChild(button);
    });
}
