/**
 * =============================================================================
 * MIDI MODULE (midi.js)
 * =============================================================================
 * 
 * Questo modulo gestisce l'interazione con controller MIDI fisici, in particolare
 * il Novation Launchpad. È una funzionalità avanzata che richiede:
 * 1. Un browser che supporti la Web MIDI API (es. Chrome, Edge, Opera).
 * 2. Un controller Launchpad (o compatibile) collegato al computer.
 *
 * Le sue responsabilità sono:
 * - Rilevare e connettersi al dispositivo Launchpad.
 * - Impostare il dispositivo in "User Mode" per permettere il controllo custom dei LED e dei pad.
 * - Mappare i segnali MIDI in ingresso (pressione dei pad) alle azioni dell'applicazione (riproduzione suoni, cambio pagina).
 * - Inviare segnali MIDI in uscita per controllare i LED del dispositivo (feedback visivo).
 */

// Array per contenere tutti i dispositivi di output MIDI disponibili.
let midiOutputs = [];
// Riferimento specifico alla porta di output del Launchpad, per inviare comandi.
let launchpadOutputPort = null;

/**
 * Invia un messaggio MIDI specifico (Control Change) al Launchpad per attivare la "User Mode".
 * Questa modalità è essenziale perché permette all'applicazione di definire liberamente
 * la mappatura dei pad e il colore dei LED, invece di usare le modalità predefinite del dispositivo.
 */
function setLaunchpadUserMode() {
    if (!launchpadOutputPort) {
        console.warn("[MIDI] Dispositivo Launchpad non trovato. Impossibile impostare la User Mode.");
        return;
    }
    try {
        // Messaggio MIDI: [Comando, Controller, Valore]
        // 176 (0xB0) = Control Change sul canale 1.
        // Controller 0 = Selezione Modalità.
        // Valore 1 = Attiva User Mode 1.
        launchpadOutputPort.send([176, 0, 1]);
        console.log(`[MIDI] Inviato comando User Mode 1 a ${launchpadOutputPort.name}`);

        // Come feedback, accendiamo il LED del pulsante "User 1" sul Launchpad.
        // Controller 109 corrisponde al pulsante "User 1".
        // Valore 127 = massima intensità.
        launchpadOutputPort.send([176, 109, 127]);
        console.log(`[MIDI] Acceso LED 'User 1' (CC 109) su ${launchpadOutputPort.name}`);
    } catch (error) {
        console.error("[MIDI] Errore nell'invio del comando per la User Mode:", error);
    }
}

// Traccia la nota MIDI dell'ultimo pulsante di pagina illuminato, per poterlo spegnere.
let activePageNote = -1;
// Funzione per mappare l'indice di pagina (0-7) alla nota MIDI corrispondente sul Launchpad.
// I pulsanti di pagina laterali corrispondono a note specifiche (8, 24, 40, ...).
const pageIndexToNote = (index) => (index * 16) + 8;

/**
 * Aggiorna i LED dei pulsanti di pagina sul Launchpad fisico per indicare la pagina attiva.
 * @param {number} pageIndex - L'indice della pagina da illuminare (0-7).
 */
export function setActivePageLED(pageIndex) {
    if (!launchpadOutputPort) return; // Non fare nulla se il Launchpad non è connesso.

    try {
        // Spegne il LED della pagina precedentemente attiva.
        if (activePageNote !== -1) {
            // Messaggio MIDI: [Comando, Nota, Velocity]
            // 144 (0x90) = Note On. Una velocity di 0 è interpretata come "Note Off" e spegne il LED.
            launchpadOutputPort.send([144, activePageNote, 0]);
            console.log(`[MIDI] Spento LED pagina precedente (Nota ${activePageNote})`);
        }

        // Accende il LED della nuova pagina attiva.
        const newNote = pageIndexToNote(pageIndex);
        // Usiamo una velocity di 127 (massima) per accendere il LED con la massima luminosità.
        // PERSONALIZZAZIONE: Si potrebbero usare valori di velocity diversi per ottenere colori diversi su alcuni modelli di Launchpad.
        launchpadOutputPort.send([144, newNote, 127]);
        console.log(`[MIDI] Acceso LED pagina ${pageIndex} (Nota ${newNote})`);
        activePageNote = newNote; // Memorizza la nota corrente per poterla spegnere al prossimo cambio.
    } catch (error) {
        console.error("[MIDI] Errore nell'invio del comando per il LED di pagina:", error);
    }
}

/**
 * Invia comandi di reset al Launchpad per spegnere tutti i LED.
 * Utile all'avvio o alla chiusura della pagina per lasciare il dispositivo in uno stato pulito.
 * Nota: Su alcuni browser, l'invio di messaggi MIDI durante l'evento `pagehide` può essere inaffidabile.
 */
export function resetLaunchpadLEDs() {
    if (!launchpadOutputPort) return;

    try {
        // Approccio "brute-force": invia un comando "Note Off" a ogni possibile nota (0-127).
        for (let i = 0; i < 128; i++) {
            launchpadOutputPort.send([128, i, 0]); // Comando Note Off (128 o 0x80).
            launchpadOutputPort.send([144, i, 0]); // Comando Note On con velocity 0.
        }
        // Spegne anche il LED del tasto "User 1".
        launchpadOutputPort.send([176, 109, 0]);

        console.log("[MIDI] Comando di reset LED inviato al Launchpad.");
        activePageNote = -1; // Resetta lo stato interno.
    } catch (error) {
        console.error("[MIDI] Errore nell'invio del comando di reset:", error);
    }
}

/**
 * Converte una nota MIDI ricevuta in un indice di pad (0-63) per la griglia 8x8.
 * Questa è la funzione di mappatura chiave per l'input.
 * @param {number} note - Il numero della nota MIDI (0-127).
 * @returns {number|undefined} L'indice del pad (0-63) o `undefined` se la nota non è sulla griglia 8x8.
 */
function noteToIndex(note) {
    const row = Math.floor(note / 16);
    const col = note % 16;

    // I pad della griglia 8x8 hanno un valore di colonna da 0 a 7.
    // I pulsanti laterali (per il cambio pagina) hanno un valore di colonna pari a 8.
    if (col < 8) {
        const padIndex = row * 8 + col;
        return padIndex;
    }
    return undefined; // La nota non corrisponde a un pad della griglia.
}

/**
 * Gestore principale per tutti i messaggi MIDI in arrivo.
 * @param {MIDIMessageEvent} message - L'evento contenente i dati MIDI.
 */
function handleMidiMessage(message) {
    const [command, note, velocity] = message.data;

    // Comando 144 (0x90) = Note On. Ignoriamo i messaggi con velocity 0 (che sono Note Off).
    if (command === 144 && velocity > 0) {
        console.log(`MIDI Note On: nota=${note}, velocity=${velocity}`);

        // Controlla se è stato premuto un pulsante laterale (colonna 8).
        if (note % 16 === 8) {
            const pageIndex = Math.floor(note / 16); // Calcola l'indice della pagina (0-7).
            if (pageIndex >= 0 && pageIndex < 8) {
                console.log(`Cambio a pagina ${pageIndex} via MIDI.`);
                window.changeSoundSet(pageIndex); // Chiama la funzione globale per cambiare pagina.
            }
            return;
        }

        // Se non è un pulsante laterale, è un pad della griglia.
        const padIndex = noteToIndex(note);
        if (padIndex !== undefined) {
            window.triggerPad(padIndex); // Chiama la funzione globale per riprodurre il suono.
        }
    }
}

/**
 * Inizializza la Web MIDI API.
 * Questo è il punto di ingresso del modulo, chiamato da `app.js`.
 */
export function initMidi() {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true }) // `sysex: true` è richiesto per alcuni messaggi di controllo avanzati.
            .then(onMidiSuccess, onMidiFailure);
    } else {
        console.warn("Web MIDI API non è supportata in questo browser.");
        // Potrebbe essere utile mostrare un messaggio all'utente nell'interfaccia.
    }
}

/**
 * Callback eseguita se l'accesso MIDI viene concesso con successo.
 * @param {MIDIAccess} midiAccess - L'oggetto che dà accesso ai dispositivi MIDI.
 */
function onMidiSuccess(midiAccess) {
    console.log("Accesso MIDI ottenuto.");
    
    // Salva i dispositivi di output.
    midiOutputs = Array.from(midiAccess.outputs.values());

    // Cerca un dispositivo Launchpad tra gli input e gli output.
    let launchpadFound = false;
    const inputs = midiAccess.inputs.values();
    for (let input of inputs) {
        console.log(`Dispositivo MIDI di input rilevato: ${input.name}`);
        input.onmidimessage = handleMidiMessage; // Collega il gestore di messaggi a ogni input.
        if (input.name.includes("Launchpad")) {
            launchpadFound = true;
        }
    }

    for (let output of midiAccess.outputs.values()) {
        if (output.name.includes("Launchpad")) {
            launchpadOutputPort = output; // Memorizza la porta di output del Launchpad.
            console.log(`[MIDI] Launchpad di output trovato: ${launchpadOutputPort.name}`);
            break;
        }
    }

    // Se un Launchpad è stato trovato, inizializzalo.
    if (launchpadFound) {
        resetLaunchpadLEDs(); // Pulisce i LED.
        setLaunchpadUserMode(); // Attiva la modalità utente.
        setActivePageLED(window.currentPage || 0); // Accende il LED della pagina corrente.
    }

    // Imposta un gestore per rilevare se un dispositivo viene collegato o scollegato
    // dopo che la pagina è già stata caricata.
    midiAccess.onstatechange = (event) => {
        console.log(`Cambiamento di stato MIDI: ${event.port.name}, ${event.port.state}`);
        // Aggiorna la lista degli output e il riferimento al Launchpad.
        midiOutputs = Array.from(midiAccess.outputs.values());
        launchpadOutputPort = midiOutputs.find(o => o.name.includes("Launchpad")) || null;

        if (event.port.type === "input" && event.port.state === "connected") {
            event.port.onmidimessage = handleMidiMessage;
            if (event.port.name.includes("Launchpad")) {
                console.log("[MIDI] Launchpad collegato a caldo, lo inizializzo.");
                resetLaunchpadLEDs();
                setLaunchpadUserMode();
                setActivePageLED(window.currentPage || 0);
            }
        }
    };
}

/**
 * Callback eseguita se l'accesso MIDI fallisce.
 * @param {Error} error - L'oggetto errore.
 */
function onMidiFailure(error) {
    console.error("Impossibile accedere ai dispositivi MIDI. L'utente potrebbe aver negato il permesso o il browser non è compatibile.", error);
}