/**
 * Launchpad PWA - MIDI Module (Corrected)
 * =========================================
 * Questo modulo gestisce l'interazione con i controller MIDI fisici.
 * Include la logica per attivare la "User Mode" e la mappatura corretta dei pad
 * basata su uno script di riferimento funzionante.
 */

let midiOutputs = [];
let launchpadOutputPort = null; // Riferimento diretto al Launchpad di output

/**
 * Invia un messaggio MIDI al Launchpad per attivare la "User Mode",
 * che abilita la mappatura delle note attesa.
 */
function setLaunchpadUserMode() {
    if (!launchpadOutputPort) {
        console.warn("[MIDI] Dispositivo di output Launchpad non trovato per impostare la User Mode.");
        return;
    }
    try {
        // Messaggio Control Change (176) sul canale 1 (0), controller 0, valore 1 per attivare la User Mode 1
        launchpadOutputPort.send([176, 0, 1]);
        console.log(`[MIDI] Inviato comando User Mode 1 a ${launchpadOutputPort.name}`);

        // Accende il LED del tasto 'User 1' (Controller 109) con intensità massima
        launchpadOutputPort.send([176, 109, 127]);
        console.log(`[MIDI] Inviato comando accensione LED User 1 (CC 109) a ${launchpadOutputPort.name}`);
    } catch (error) {
        console.error("[MIDI] Errore nell'invio del comando MIDI per User Mode o LED User 1:", error);
    }
}

let activePageNote = -1;
const pageIndexToNote = (index) => (index * 16) + 8;

/**
 * Aggiorna i LED dei pulsanti di pagina sul Launchpad fisico.
 * @param {number} pageIndex L'indice della pagina da illuminare.
 */
export function setActivePageLED(pageIndex) {
    if (!launchpadOutputPort) return;

    try {
        // Spegne il pulsante precedentemente illuminato
        if (activePageNote !== -1) {
            launchpadOutputPort.send([144, activePageNote, 0]); // Note On con velocity 0 = LED off
            console.log(`[MIDI] Spento LED pagina precedente (Nota ${activePageNote})`);
        }

        // Accende il nuovo pulsante
        const newNote = pageIndexToNote(pageIndex);
        // Usiamo un colore per il LED, es. 127 per massima intensità
        launchpadOutputPort.send([144, newNote, 127]);
        console.log(`[MIDI] Acceso LED pagina ${pageIndex} (Nota ${newNote})`);
        activePageNote = newNote;
    } catch (error) {
        console.error("[MIDI] Errore nell'invio del comando MIDI per LED pagina:", error);
    }
}

/**
 * Invia un comando di reset al Launchpad per spegnere tutti i LED.
 */
/**
 * Invia un comando di reset al Launchpad per spegnere tutti i LED.
 * Nota: Su Firefox, il messaggio Control Change per il tasto User 1 potrebbe non essere inviato
 * a causa delle restrizioni del browser durante l'evento pagehide/unload.
 */
export function resetLaunchpadLEDs() {
    if (!launchpadOutputPort) return;

    try {
        // Invia Note Off per tutti i possibili pad (0-127)
        for (let i = 0; i < 128; i++) {
            launchpadOutputPort.send([128, i, 0]); // Note Off (comando 128)
            launchpadOutputPort.send([144, i, 0]); // Note On con velocity 0 (spesso usato per spegnere)
        }
        // Spegni anche il tasto User 1 (Controller 109)
        launchpadOutputPort.send([176, 109, 0]); // Control Change con valore 0

        console.log("[MIDI] Comando di reset LED (brute-force) inviato al Launchpad.");
        activePageNote = -1; // Resetta lo stato interno
    } catch (error) {
        console.error("[MIDI] Errore nell'invio del comando MIDI di reset:", error);
    }
}

/**
 * Converte una nota MIDI in un indice di pad (0-63) usando la mappatura a blocchi.
 * @param {number} note - Il numero della nota MIDI.
 * @returns {number|undefined} L'indice del pad o undefined se non è un pad della griglia 8x8.
 */
function noteToIndex(note) {
    const row = Math.floor(note / 16);
    const col = note % 16;

    // I pad della griglia 8x8 hanno un valore di colonna da 0 a 7.
    // I pulsanti laterali hanno un valore di colonna pari a 8.
    if (col < 8) {
        const padIndex = row * 8 + col;
        return padIndex;
    }
    return undefined; // È un pulsante laterale o non valido
}

/**
 * Gestisce i messaggi MIDI in arrivo da un dispositivo.
 * @param {MIDIMessageEvent} message - L'evento del messaggio MIDI.
 */
function handleMidiMessage(message) {
    const [command, note, velocity] = message.data;

    // Comando 144 (0x90) = Note On
    if (command === 144 && velocity > 0) {
        console.log(`MIDI Note On: note=${note}, velocity=${velocity}`);

        // I pulsanti laterali (colonna 8) cambiano pagina
        if (note % 16 === 8) {
            const pageIndex = note / 16 - 0.5;
            if (pageIndex >= 0 && pageIndex < 8) { // Assumendo 8 pagine
                console.log(`Changing to page ${pageIndex}`);
                window.changeSoundSet(pageIndex);
            }
            return;
        }

        // Altri pulsanti sono pad della griglia
        const padIndex = noteToIndex(note);
        if (padIndex !== undefined) {
            window.triggerPad(padIndex);
        }
    }
}

/**
 * Inizializza la Web MIDI API e collega i gestori di eventi.
 */
export function initMidi() {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true }) // sysex richiesto per alcuni messaggi di controllo
            .then(onMidiSuccess, onMidiFailure);
    } else {
        console.warn("Web MIDI API non è supportata in questo browser.");
    }
}

/**
 * Callback eseguita in caso di successo nell'accesso MIDI.
 * @param {MIDIAccess} midiAccess - L'oggetto di accesso MIDI.
 */
function onMidiSuccess(midiAccess) {
    console.log("Accesso MIDI ottenuto.");
    
    // Salva i dispositivi di output
    midiOutputs = Array.from(midiAccess.outputs.values());

            // Cerca il Launchpad e imposta la modalità
            let launchpadFound = false;
            const inputs = midiAccess.inputs.values();
            for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                console.log(`Dispositivo MIDI rilevato: ${input.value.name}`);
                input.value.onmidimessage = handleMidiMessage;
                if (input.value.name.includes("Launchpad")) {
                    launchpadFound = true;
                }
            }
    
            // Trova e memorizza il Launchpad di output
            for (let output of midiAccess.outputs.values()) {
                if (output.name.includes("Launchpad")) {
                    launchpadOutputPort = output;
                    console.log(`[MIDI] Launchpad di output trovato: ${launchpadOutputPort.name}`);
                    break;
                }
            }
    if (launchpadFound) {
        // Resetta tutti i LED all'avvio per uno stato pulito
        resetLaunchpadLEDs();
        setLaunchpadUserMode();
        // Accende il LED della pagina iniziale dopo che il MIDI è pronto
        setActivePageLED(window.currentPage || 0);
    }

    // Gestisce collegamenti futuri
    midiAccess.onstatechange = (event) => {
        console.log(`State change: ${event.port.name}, ${event.port.state}`);
        midiOutputs = Array.from(midiAccess.outputs.values()); // Aggiorna output
        // Aggiorna il riferimento al Launchpad di output
        launchpadOutputPort = midiOutputs.find(o => o.name.includes("Launchpad")) || null;

        if (event.port.type === "input" && event.port.state === "connected") {
            event.port.onmidimessage = handleMidiMessage;
            if (event.port.name.includes("Launchpad")) {
                console.log("[MIDI] Launchpad collegato, imposto la User Mode.");
                setLaunchpadUserMode();
            }
        }
    };
}

/**
 * Callback eseguita in caso di fallimento nell'accesso MIDI.
 * @param {Error} error - L'errore restituito.
 */
function onMidiFailure(error) {
    console.error("Impossibile accedere ai dispositivi MIDI.", error);
}
