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
        // 1. AUDIO CONTEXT (Lazy Initialization)
        // The AudioContext is NOT created here to avoid the "AudioContext was prevented from starting automatically" warning.
        // It is created in the `init()` method, which is called after a user gesture.
        this.audioContext = null;
        this.analyser = null;

        // 2. SOUND BUFFERS
        // Decoded audio data (`AudioBuffer`) ready for playback.
        this.soundBuffers = [];

        // 3. ACTIVE SOURCES
        // Map to keep track of currently playing source nodes by pad index.
        this.activeSources = new Map();
    }

    /**
     * Initializes the AudioContext and AnalyserNode.
     * Must be called after a user gesture (e.g., click/touch).
     */
    async init() {
        if (this.audioContext) return; // Already initialized

        // 1. AUDIO CONTEXT CREATION
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // 2. ANALYZER CREATION
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.8;

        // 3. AUDIO GRAPH CONNECTION
        this.analyser.connect(this.audioContext.destination);

        // 4. RESUME CONTEXT ON VISIBILITY CHANGE
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log("[AUDIO] AudioContext resumed after tab became visible.");
                });
            }
        });

        console.log("[AUDIO] AudioEngine initialized.");
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
     * @param {function} onProgress - Optional callback for loading progress (loadedCount, totalCount).
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
                const loadedCount = Math.min(i + BATCH_SIZE, total);
                onProgress(loadedCount, total);
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