/**
 * AUDIO ENGINE (audio.js)
 *
 * Encapsulates all audio-related logic using the Web Audio API.
 * Structured as an `AudioEngine` class to maintain clean and organized state.
 * Responsibilities:
 * 1. Create and manage the audio context (`AudioContext`).
 * 2. Load audio files asynchronously and decode them into `AudioBuffer`.
 * 3. Play sounds when requested.
 * 4. Provide an `AnalyserNode` for real-time audio analysis.
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
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.8; // Default value for smooth animation, synchronized with UI.

        // 3. AUDIO GRAPH CONNECTION
        // Connect the analyzer to the final destination (speakers).
        // This way, any sound that must be heard and visualized must be
        // connected to the analyzer, which then passes it to the speakers.
        // Graph: [Sound Source] -> [Analyser] -> [Destination (Speakers)]
        this.analyser.connect(this.audioContext.destination);

        // 4. SOUND BUFFERS
        // Decoded audio data (`AudioBuffer`) ready for playback.
        this.soundBuffers = [];

        // 5. ACTIVE SOURCES
        // Map to keep track of currently playing source nodes by pad index.
        // Used to stop sounds before restarting them if the pad is pressed again.
        this.activeSources = new Map();

        // 6. RESUME CONTEXT ON VISIBILITY CHANGE
        // Browsers often suspend AudioContext when the tab is backgrounded.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log("[AUDIO] AudioContext resumed after tab became visible.");
                });
            }
        });
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
     * Loads an entire array of sound URLs in batches to avoid saturating connections.
     * @param {string[]} soundUrls - An array of URLs to load.
     * @param {function} onProgress - Optional callback for loading progress.
     */
    async loadSounds(soundUrls, onProgress = null) {
        this.soundBuffers = []; // Clear previous project buffers.
        const total = soundUrls.length;
        const BATCH_SIZE = 10; // Load 10 sounds at a time

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = soundUrls.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map((url, index) => this.loadSound(url, i + index));
            await Promise.all(batchPromises);

            if (onProgress) {
                const progress = Math.min(((i + BATCH_SIZE) / total) * 100, 100);
                onProgress(progress);
            }
        }
        console.log('All project sounds have been loaded!');
    }

    /**
     * Plays the sound associated with a specific pad.
     * @param {number} padIndex - The index of the pad (0-63) to play.
     */
    playPadSound(padIndex) {
        // Ensure AudioContext is running (browsers suspend it if no user gesture)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Check if an audio buffer exists for the specified pad.
        if (!this.soundBuffers[padIndex]) {
            return 0;
        }

        // STOP PREVIOUS SOUND (RESTART LOGIC)
        // If a sound is already playing for this pad, stop it before starting a new one.
        if (this.activeSources.has(padIndex)) {
            try {
                const oldSource = this.activeSources.get(padIndex);
                oldSource.stop();
            } catch (e) {
                // Ignore errors if the source has already finished or hasn't started
            }
            this.activeSources.delete(padIndex);
        }

        // Create a new `AudioBufferSourceNode` for playback.
        // Each call creates a new independent "player".
        const source = this.audioContext.createBufferSource();
        // Connect the audio buffer to the source node.
        source.buffer = this.soundBuffers[padIndex];
        // Connect the source node to the analyser only.
        // The analyser is already connected to the destination in the constructor:
        // [Source] -> [Analyser] -> [Destination (Speakers)]
        source.connect(this.analyser);

        // Store the source node to manage its lifecycle
        this.activeSources.set(padIndex, source);

        // Clean up the source from activeSources once it finished naturally
        source.onended = () => {
            if (this.activeSources.get(padIndex) === source) {
                this.activeSources.delete(padIndex);
            }
        };

        // Start playback immediately.
        source.start();
        return source.buffer.duration;
    }

    /**
     * Getter to obtain the AnalyserNode. Used by the visualizer.
     * @returns {AnalyserNode} The audio engine's analyzer node.
     */
    getAnalyser() {
        return this.analyser;
    }
}

// SINGLETON EXPORT
// Singleton instance of the `AudioEngine` class.
// Pattern ensures a single audio engine instance throughout
// the application, preventing conflicts and optimizing resource usage.
export const audioEngine = new AudioEngine();