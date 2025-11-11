/**
 * =============================================================================
 * AUDIO ENGINE (audio.js)
 * =============================================================================
 * 
 * This module encapsulates all audio-related logic using the Web Audio API.
 * It is structured as an `AudioEngine` class to maintain clean and organized state.
 * Its main responsibilities are:
 * 1. Create and manage the audio context (`AudioContext`).
 * 2. Load audio files asynchronously and decode them into `AudioBuffer`.
 * 3. Play sounds when requested.
 * 4. Provide an `AnalyserNode` to allow other modules (like the visualizer)
 *    to analyze audio data in real-time.
 */

class AudioEngine {
    /**
     * Constructor initializes the audio engine.
     */
    constructor() {
        // 1. AUDIO CONTEXT CREATION
        // `AudioContext` is the central access point for Web Audio API.
        // The construct `(window.AudioContext || window.webkitAudioContext)` ensures compatibility
        // with older browsers that used a prefixed version.
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 2. ANALYZER CREATION
        // `AnalyserNode` is a component that provides frequency and waveform data
        // of audio passing through it, without modifying it. Essential for the visualizer.
        this.analyser = this.audioContext.createAnalyser();

        /*
         * VISUALIZER CUSTOMIZATION:
         * - `fftSize`: Size of the Fast Fourier Transform. Must be a power of 2.
         *   Higher values (e.g., 2048) give more frequency details (more bars in visualizer),
         *   but require more processing power. Lower values (e.g., 256) are more performant.
         *   The number of available bars will be `fftSize / 2`.
         * - `smoothingTimeConstant`: A value between 0 and 1. Higher values (e.g., 0.8) create a
         *   more "fluid" and smoothed effect over time, while lower values (e.g., 0.1) make the
         *   visualizer extremely reactive and "jerky".
         */
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8; // Default value for smooth animation, synchronized with UI.

        // 3. AUDIO GRAPH CONNECTION
        // Connect the analyzer to the final destination (speakers).
        // This way, any sound we want to hear and visualize must be
        // connected to the analyzer, which then passes it to the speakers.
        // Graph: [Sound Source] -> [Analyser] -> [Destination (Speakers)]
        this.analyser.connect(this.audioContext.destination);

        // 4. SOUND BUFFERS
        // This array will contain decoded audio data (`AudioBuffer`) ready to be played.
        this.soundBuffers = [];
    }

    /**
     * Loads a single audio file from the specified URL.
     * @param {string|null} url - The URL of the audio file to load.
     * @param {number} index - The index to store the audio buffer in the `soundBuffers` array.
     */
    async loadSound(url, index) {
        // If URL is null or undefined (for empty pads), store `null` and exit.
        if (!url) {
            this.soundBuffers[index] = null;
            return;
        }
        try {
            // `fetch` downloads the audio file as raw data.
            const response = await fetch(url);
            // `arrayBuffer` converts the response to a format that Web Audio API can understand.
            const arrayBuffer = await response.arrayBuffer();
            // `decodeAudioData` converts raw data into an `AudioBuffer`, which is a
            // PCM (Pulse-Code Modulation) audio format optimized for playback.
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            // Store the decoded buffer in the array at the correct position.
            this.soundBuffers[index] = audioBuffer;
            console.log(`Sound loaded: ${url}`);
        } catch (error) {
            console.error(`Error loading sound ${url}:`, error);
            this.soundBuffers[index] = null; // Set to null on error.
        }
    }

    /**
     * Loads an entire array of sound URLs.
     * @param {string[]} soundUrls - An array of URLs to load.
     */
    async loadSounds(soundUrls) {
        this.soundBuffers = []; // Clear previous project buffers.
        // `map` creates an array of promises, where each promise represents loading a sound.
        const loadPromises = soundUrls.map((url, index) => this.loadSound(url, index));
        // `Promise.all` waits for all loading promises to complete.
        // This allows loading all sounds in parallel, speeding up the process.
        await Promise.all(loadPromises);
        console.log('All project sounds have been loaded!');
    }

    /**
     * Plays the sound associated with a specific pad.
     * @param {number} padIndex - The index of the pad (0-63) to play.
     */
    playPadSound(padIndex) {
        // Check if an audio buffer exists for the specified pad.
        if (!this.soundBuffers[padIndex]) {
            console.warn(`No sound loaded for pad ${padIndex}`);
            return;
        }
        // Create a new `AudioBufferSourceNode` for playback.
        // Each call creates a new independent "player".
        const source = this.audioContext.createBufferSource();
        // Connect the audio buffer to the source node.
        source.buffer = this.soundBuffers[padIndex];
        // Connect the source node to the analyzer and then to the final output (speakers).
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        // Start playback immediately.
        source.start();
    }

    /**
     * Getter to obtain the AnalyserNode. Used by the visualizer.
     * @returns {AnalyserNode} The audio engine's analyzer node.
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