class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    playSound() {
        // Play a simple test tone without needing an audio file
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1); // Play for 0.1 seconds
    }
}

export const audioEngine = new AudioEngine();
