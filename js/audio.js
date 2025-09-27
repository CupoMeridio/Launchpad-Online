/**
 * =============================================================================
 * AUDIO ENGINE (audio.js)
 * =============================================================================
 * 
 * Questo modulo incapsula tutta la logica relativa all'audio utilizzando la Web Audio API.
 * È strutturato come una classe `AudioEngine` per mantenere uno stato pulito e organizzato.
 * Le sue responsabilità principali sono:
 * 1. Creare e gestire il contesto audio (`AudioContext`).
 * 2. Caricare i file audio in modo asincrono e decodificarli in `AudioBuffer`.
 * 3. Riprodurre i suoni quando richiesto.
 * 4. Fornire un `AnalyserNode` per permettere ad altri moduli (come il visualizzatore)
 *    di analizzare i dati audio in tempo reale.
 */

class AudioEngine {
    /**
     * Il costruttore inizializza il motore audio.
     */
    constructor() {
        // 1. CREAZIONE DEL CONTESTO AUDIO
        // `AudioContext` è il punto di accesso centrale per la Web Audio API.
        // Il costrutto `(window.AudioContext || window.webkitAudioContext)` garantisce la compatibilità
        // con browser più vecchi che usavano una versione prefissata.
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 2. CREAZIONE DELL'ANALIZZATORE
        // `AnalyserNode` è un componente che fornisce dati sulla frequenza e sulla forma d'onda
        // dell'audio che lo attraversa, senza modificarlo. È fondamentale per il visualizzatore.
        this.analyser = this.audioContext.createAnalyser();

        /*
         * PERSONALIZZAZIONE DEL VISUALIZZATORE:
         * - `fftSize`: Dimensione della Fast Fourier Transform. Deve essere una potenza di 2.
         *   Un valore più alto (es. 2048) dà più dettagli sulle frequenze (più barre nel visualizzatore),
         *   ma richiede più potenza di calcolo. Un valore più basso (es. 256) è più performante.
         *   Il numero di barre disponibili sarà `fftSize / 2`.
         * - `smoothingTimeConstant`: Un valore tra 0 e 1. Valori più alti (es. 0.8) creano un effetto
         *   più "fluido" e smussato nel tempo, mentre valori più bassi (es. 0.1) rendono il visualizzatore
         *   estremamente reattivo e "scattoso".
         */
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8; // Valore di default per un'animazione fluida, sincronizzato con la UI.

        // 3. COLLEGAMENTO DEL GRAFO AUDIO
        // Colleghiamo l'analizzatore alla destinazione finale (gli altoparlanti).
        // In questo modo, qualsiasi suono che vogliamo sentire e visualizzare dovrà essere
        // collegato all'analizzatore, che poi lo passerà agli altoparlanti.
        // Grafo: [Suono Sorgente] -> [Analyser] -> [Destination (Altoparlanti)]
        this.analyser.connect(this.audioContext.destination);

        // 4. BUFFER DEI SUONI
        // Questo array conterrà i dati audio decodificati (`AudioBuffer`) pronti per essere riprodotti.
        this.soundBuffers = [];
    }

    /**
     * Carica un singolo file audio dall'URL specificato.
     * @param {string|null} url - L'URL del file audio da caricare.
     * @param {number} index - L'indice a cui memorizzare il buffer audio nell'array `soundBuffers`.
     */
    async loadSound(url, index) {
        // Se l'URL è nullo o non definito (per pad vuoti), memorizza `null` e termina.
        if (!url) {
            this.soundBuffers[index] = null;
            return;
        }
        try {
            // `fetch` scarica il file audio come dato grezzo.
            const response = await fetch(url);
            // `arrayBuffer` converte la risposta in un formato che la Web Audio API può capire.
            const arrayBuffer = await response.arrayBuffer();
            // `decodeAudioData` converte i dati grezzi in un `AudioBuffer`, che è un formato audio
            // PCM (Pulse-Code Modulation) ottimizzato per la riproduzione.
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            // Memorizza il buffer decodificato nell'array alla posizione corretta.
            this.soundBuffers[index] = audioBuffer;
            console.log(`Suono caricato: ${url}`);
        } catch (error) {
            console.error(`Errore durante il caricamento del suono ${url}:`, error);
            this.soundBuffers[index] = null; // Imposta a null in caso di errore.
        }
    }

    /**
     * Carica un intero array di URL di suoni.
     * @param {string[]} soundUrls - Un array di URL da caricare.
     */
    async loadSounds(soundUrls) {
        this.soundBuffers = []; // Svuota i buffer del progetto precedente.
        // `map` crea un array di promesse, dove ogni promessa rappresenta il caricamento di un suono.
        const loadPromises = soundUrls.map((url, index) => this.loadSound(url, index));
        // `Promise.all` attende che tutte le promesse di caricamento siano completate.
        // Questo permette di caricare tutti i suoni in parallelo, accelerando il processo.
        await Promise.all(loadPromises);
        console.log('Tutti i suoni del progetto sono stati caricati!');
    }

    /**
     * Riproduce un suono basandosi sul suo indice nell'array dei buffer.
     * @param {number} index - L'indice del suono da riprodurre.
     */
    playPadSound(index) {
        const audioBuffer = this.soundBuffers[index];
        // Se non c'è un buffer per questo indice (pad vuoto o errore di caricamento), non fare nulla.
        if (!audioBuffer) {
            console.warn(`Nessun suono caricato per l'indice ${index}`);
            return;
        }

        // Crea un `BufferSourceNode`. Questo è un oggetto sorgente audio che può riprodurre
        // i dati contenuti in un `AudioBuffer`.
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer; // Assegna il buffer alla sorgente.
        
        // Collega la sorgente all'analizzatore. Questo è il passaggio cruciale che permette
        // al visualizzatore di "vedere" i dati di questo suono.
        source.connect(this.analyser);
        
        // Avvia la riproduzione immediatamente.
        source.start(0);
    }

    /**
     * Metodo getter per esporre l'analizzatore ad altri moduli.
     * @returns {AnalyserNode} L'istanza dell'analizzatore del motore audio.
     */
    getAnalyser() {
        return this.analyser;
    }
}

// ESPORTAZIONE SINGLETON
// Creiamo e esportiamo una singola istanza della classe `AudioEngine`.
// Questo pattern (singleton) assicura che ci sia un solo motore audio in tutta
// l'applicazione, evitando conflitti e spreco di risorse.
export const audioEngine = new AudioEngine();