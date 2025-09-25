class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Crea l'analizzatore
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256; // Definisce la risoluzione dell'analisi
        this.analyser.smoothingTimeConstant = 0.3; // Abbassa il valore per maggiore reattività

        // Collega l'analizzatore alla destinazione finale (le casse)
        this.analyser.connect(this.audioContext.destination);
    }

    playSound() {
        // Play a simple test tone without needing an audio file
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        
        // Collega il suono all'analizzatore invece che direttamente alle casse
        gainNode.connect(this.analyser);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1); // Play for 0.1 seconds
    }

    // Metodo per accedere all'analizzatore dall'esterno
    getAnalyser() {
        return this.analyser;
    }
}

export const audioEngine = new AudioEngine();
