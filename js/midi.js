/**
 * =============================================================================
 * MIDI MODULE (midi.js)
 * =============================================================================
 * 
 * Questo modulo gestisce l'interazione con controller MIDI fisici, in particolare
 * il Novation Launchpad, utilizzando la libreria launchpad-webmidi.
 * È una funzionalità avanzata che richiede:
 * 1. Un browser che supporti la Web MIDI API (es. Chrome, Edge, Opera).
 * 2. Un controller Launchpad (o compatibile) collegato al computer.
 *
 * Le sue responsabilità sono:
 * - Rilevare e connettersi al dispositivo Launchpad tramite launchpad-webmidi.
 * - Mappare i segnali MIDI in ingresso (pressione dei pad) alle azioni dell'applicazione.
 */

// Importa la libreria launchpad-webmidi
import Launchpad from './vendor/launchpad-webmidi.js';

// Istanza del Launchpad
let launchpad = null;

/**
 * Aggiorna l'indicatore visivo dello stato MIDI nell'interfaccia.
 * @param {boolean} connected - True se il Launchpad è connesso, false altrimenti.
 */
function updateMidiStatus(connected) {
    // Cerca di trovare o creare un indicatore di stato MIDI
    let statusIndicator = document.getElementById('midi-status');
    
    if (!statusIndicator) {
        // Se non esiste, creane uno temporaneo
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'midi-status';
        statusIndicator.style.position = 'fixed';
        statusIndicator.style.top = '10px';
        statusIndicator.style.right = '10px';
        statusIndicator.style.padding = '5px 10px';
        statusIndicator.style.borderRadius = '5px';
        statusIndicator.style.fontSize = '12px';
        statusIndicator.style.fontFamily = 'Arial, sans-serif';
        statusIndicator.style.zIndex = '1000';
        document.body.appendChild(statusIndicator);
    }
    
    if (connected) {
        statusIndicator.textContent = 'Launchpad Connesso ✓';
        statusIndicator.style.backgroundColor = '#4CAF50';
        statusIndicator.style.color = 'white';
    } else {
        statusIndicator.textContent = 'Launchpad Non Connesso ✗';
        statusIndicator.style.backgroundColor = '#f44336';
        statusIndicator.style.color = 'white';
    }
}

/**
 * Configura i gestori eventi per il Launchpad utilizzando la libreria.
 */
function setupLaunchpadEvents() {
    if (!launchpad) return;
    
    // Gestore per gli eventi dei tasti (pressione e rilascio)
    launchpad.on('key', (event) => {
        const { x, y, pressed } = event;
        
        // Solo quando il tasto viene premuto (non quando viene rilasciato)
        if (!pressed) return;
        
        // I pulsanti laterali (Scene) hanno x=8
        if (x === 8 && y < 8) {
            // Cambio pagina
            const pageIndex = y + 1;
            window.changeSoundSet(pageIndex);
        } else if (x < 8 && y < 8) {
            // Pad della griglia 8x8 (escludiamo gli Automap che hanno y=8)
            const padIndex = y * 8 + x;
            window.triggerPad(padIndex);
        }
        // Gestore per i tasti automap in alto (y=8)
        else if (y === 8 && x < 8) {
            // Tasti automap - funzionalità future
        }
    });
}

/**
 * Inizializza la connessione con il Launchpad tramite launchpad-webmidi.
 * Questo è il punto di ingresso del modulo, chiamato da `app.js`.
 */
export async function initMidi() {
    console.log("[MIDI] Inizializzazione connessione Launchpad...");
    
    try {
        // Controlla se la libreria è disponibile
        if (!Launchpad) {
            throw new Error("Libreria launchpad-webmidi non caricata correttamente");
        }

        // Crea l'istanza Launchpad
        launchpad = new Launchpad(''); // Nome vuoto per trovare qualsiasi Launchpad
        
        // Connettiti al Launchpad
        await launchpad.connect();
        console.log(`[MIDI] Launchpad ${launchpad.name || ''} connesso`);
        
        // Aggiungi indicatore visivo di connessione
        updateMidiStatus(true);
        
        // Imposta i gestori eventi per i pad
        setupLaunchpadEvents();
        
        // Gestisci la disconnessione
        if (launchpad && launchpad.on) {
            launchpad.on('disconnect', () => {
                console.log("[MIDI] Launchpad disconnesso");
                updateMidiStatus(false);
                launchpad = null;
            });
        }
        
    } catch (error) {
        console.log("[MIDI] Launchpad non trovato");
        updateMidiStatus(false);
    }
}