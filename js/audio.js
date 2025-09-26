class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Crea l'analizzatore
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256; // Definisce la risoluzione dell'analisi
        this.analyser.smoothingTimeConstant = 0.3; // Abbassa il valore per maggiore reattività

        // Collega l'analizzatore alla destinazione finale (le casse)
        this.analyser.connect(this.audioContext.destination);

        this.soundBuffers = []; // Array per memorizzare i buffer audio caricati
    }

    // Metodo per caricare un singolo file audio
    async loadSound(url, index) {
        if (!url) {
            this.soundBuffers[index] = null;
            return;
        }
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers[index] = audioBuffer;
            console.log(`Sound loaded: ${url}`);
        } catch (error) {
            console.error(`Error loading sound ${url}:`, error);
        }
    }

    // Metodo per caricare tutti i suoni da un elenco
    async loadSounds(soundUrls) {
        this.soundBuffers = []; // Svuota i buffer esistenti
        const loadPromises = soundUrls.map((url, index) => this.loadSound(url, index));
        await Promise.all(loadPromises);
        console.log('All sounds loaded!');
    }

    // Metodo per riprodurre un suono specifico in base all'indice
    playPadSound(index) {
        const audioBuffer = this.soundBuffers[index];
        if (!audioBuffer) {
            console.warn(`No sound loaded for index ${index}`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.analyser); // Collega all'analizzatore
        source.start(0); // Riproduci immediatamente
    }

    // Questo metodo non è più usato per riprodurre suoni specifici, ma può rimanere per compatibilità o altri usi
    playSound() {
        console.warn("playSound() is deprecated. Use playPadSound(index) instead.");
    }

    // Metodo per accedere all'analizzatore dall'esterno
    getAnalyser() {
        return this.analyser;
    }
}

export const audioEngine = new AudioEngine();
