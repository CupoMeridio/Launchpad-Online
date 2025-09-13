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

/* ---------------------------------------------
 * 2. Definiamo le funzioni globali
 * --------------------------------------------- */

window.playSound = function(event, index) {
    // Ottiene l'elemento pad che ha scatenato l'evento
    const pad = event.target;

    /* -------------------------------------
     * 3a. Suono
     * ------------------------------------- */
    audioEngine.playSound();

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

window.changeSoundSet = function(index) {
    // Logga il cambio del set di suoni (funzionalità da implementare)
    console.log(`Changing sound set to ${index}`);
}

window.toggleSidebar = function() {
    // Seleziona l'elemento del layout principale
    const layout = document.querySelector('.layout');
    // Alterna la classe 'sidebar-open' per mostrare/nascondere la sidebar
    layout.classList.toggle('sidebar-open');
}

window.toggleMenu = function(menuId) {
    const menu = document.getElementById(menuId);
    const isOpen = menu.classList.toggle('open');

    // Se il menu è quello del background, gestisci la visibilità dei controlli video
    if (menuId === 'background-menu') {
        const videoControls = document.querySelector('.video-controls');
        if (videoControls) {
            videoControls.style.display = isOpen ? 'block' : 'none';
        }
    }
};

// Variabili globali per i controlli video
let currentVideo = null;

// Funzione per caricare e applicare i video background
window.setBackgroundVideo = function(videoFile) {
    // Seleziona l'overlay video e i controlli video
    const overlay = document.querySelector('.video-overlay');
    const videoControls = document.querySelector('.video-controls');
    
    // Rimuovi eventuale video precedente presente nel DOM
    const existingVideo = document.querySelector('.background-video');
    if (existingVideo) {
        existingVideo.remove();
    }
    
    // Se è stato fornito un file video, crea e aggiungi il nuovo video
    if (videoFile) {
        // Crea il nuovo elemento video
        const video = document.createElement('video');
        video.className = 'background-video'; // Assegna la classe CSS
        video.src = `assets/videos/${videoFile}?t=${new Date().getTime()}`; // Imposta la sorgente del video
        video.autoplay = true; // Avvia automaticamente il video
        video.loop = true;     // Ripeti il video in loop
        video.muted = true;    // Muta l'audio del video
        
        // Aggiunge il video al corpo del documento
        document.body.appendChild(video);
        // Attiva l'overlay (per effetti come l'opacità)
        overlay.classList.add('active');
        // Imposta il video corrente
        currentVideo = video;
        
        // Mostra i controlli video se esistono
        if (videoControls) {
            videoControls.style.display = 'block';
        }
        
        // Applica gli effetti video (opacità, sfocatura, luminosità)
        applyVideoEffects();
    } else {
        // Se nessun file video è fornito (es. "Nessun background")
        // Disattiva l'overlay
        overlay.classList.remove('active');
        // Resetta il video corrente
        currentVideo = null;
        
        // Nascondi i controlli video e resetta i loro valori
        if (videoControls) {
            videoControls.style.display = 'none';
        }
        resetVideoControls();
    }
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

// Inizializzazione: carica i video nella sidebar
async function initializeBackgroundMenu() {
    // Seleziona il menu a discesa per i background
    const backgroundMenu = document.getElementById('background-menu');
    // Seleziona il contenitore dei controlli video all'interno del menu background
    const videoControls = backgroundMenu.querySelector('.video-controls');
    
    try {
        const response = await fetch('/api/videos');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const videoFiles = await response.json();

        // Per ogni file video, crea un pulsante nel menu
        videoFiles.forEach(videoFile => {
            const button = document.createElement('button');
            button.className = 'menu-option'; // Assegna la classe CSS per lo stile
            button.textContent = videoFile.replace('.mp4', ''); // Imposta il testo del pulsante (nome del file senza estensione)
            button.onclick = () => setBackgroundVideo(videoFile); // Assegna la funzione da chiamare al click
            
            // Inserisce i pulsanti dei video prima del blocco dei controlli video
            backgroundMenu.insertBefore(button, videoControls);
        });
    } catch (error) {
        console.error("Failed to load videos:", error);
    }
}

// Inizializza le funzioni quando il DOM è completamente caricato
// Inizializza le funzioni quando il DOM è completamente caricato
document.addEventListener('DOMContentLoaded', async function() {
    // Inizializza i menu e i controlli
    await initializeBackgroundMenu();
    initializeVideoControls();
    await initializePersonalizeLaunchpadMenu();

    // Registra il Service Worker
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

async function initializePersonalizeLaunchpadMenu() {
    const menu = document.getElementById('personalize-launchpad-menu');
    
    try {
        const response = await fetch('/api/skins');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const imageFiles = await response.json();

        imageFiles.forEach(imageFile => {
            const button = document.createElement('button');
            button.className = 'menu-option';
            button.textContent = imageFile.split('.')[0];
            button.onclick = () => setLaunchpadBackground(imageFile);
            menu.appendChild(button);
        });
    } catch (error) {
        console.error("Failed to load skins:", error);
    }
}