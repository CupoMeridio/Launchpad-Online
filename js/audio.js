/**
 * AUDIO ENGINE (audio.js)
 *
 * Encapsulates all audio-related logic using the Web Audio API.
 * Structured as an `AudioEngine` class to maintain clean and organized state.
 * Responsibilities:
 * 1. Create and manage the audio context (`AudioContext`).
 * 2. Load audio files asynchronously and decode them into `AudioBuffer`.
 * 3. Play sounds when requested with robust error handling.
 * 4. Provide an `AnalyserNode` for real-time audio analysis.
 */

import { 
    categorizeDecodeError, 
    getErrorMessage, 
    validateAudioBuffer,
    audioLoadingTracker,
    AUDIO_ERROR_TYPES
} from './audioErrorHandler.js';
import { showNotification } from './ui.js';
import { registerListener } from './eventCleanup.js';
import { onVisibilityChange } from './visibilityManager.js';

/**
 * Checks if the Web Audio API is supported in the current browser.
 * @returns {boolean} True if Web Audio API is supported.
 */
function isWebAudioSupported() {
    return typeof AudioContext !== 'undefined';
}

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
        this.initError = null;

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
     * @throws {Error} If Web Audio API is not supported or initialization fails.
     */
    async init() {
        if (this.audioContext) return; // Already initialized
        
        // Check browser support
        if (!isWebAudioSupported()) {
            const errorMsg = "Web Audio API is not supported in this browser. Please use Chrome, Firefox, Edge, or Safari.";
            this.initError = errorMsg;
            console.error("[AUDIO]", errorMsg);
            throw new Error(errorMsg);
        }

        try {
            // 1. AUDIO CONTEXT CREATION
            // Using only AudioContext (no deprecated webkit fallback)
            this.audioContext = new AudioContext();

            // 2. ANALYZER CREATION
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.8;

            // 3. AUDIO GRAPH CONNECTION
            this.analyser.connect(this.audioContext.destination);

            // 4. RESUME CONTEXT ON VISIBILITY CHANGE
            onVisibilityChange((isVisible) => {
                if (isVisible && this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log("[AUDIO] AudioContext resumed after tab became visible.");
                    });
                }
            });

            console.log("[AUDIO] AudioEngine initialized successfully.");
        } catch (error) {
            const errorMsg = `[AUDIO] Failed to initialize AudioContext: ${error.message}`;
            this.initError = errorMsg;
            console.error(errorMsg);
            throw error;
        }
    }

    /**
     * Returns true if the audio engine is ready to use.
     * @returns {boolean} True if audioContext and analyser are initialized.
     */
    isReady() {
        return this.audioContext !== null && this.analyser !== null;
    }

    /**
     * Gets any initialization error that occurred.
     * @returns {string|null} Error message if initialization failed, null otherwise.
     */
    getInitError() {
        return this.initError;
    }

    /**
     * Loads a single audio file from the specified URL.
     * @param {string|null} url - The URL of the audio file to load.
     * @param {number} index - The index to store the audio buffer in the `soundBuffers` array.
     * @param {boolean} notifyUser - Whether to show error notification to user (default: false for batch operations)
     * @returns {Promise<AudioBuffer|null>} The decoded buffer or null on failure
     */
    async loadSound(url, index, notifyUser = false) {
        // If URL is null or undefined (for empty pads), store `null` and exit.
        if (!url) {
            this.soundBuffers[index] = null;
            return null;
        }

        // Ensure audioContext is available
        if (!this.audioContext) {
            console.warn(`[AUDIO] Cannot load sound at index ${index}: AudioContext not initialized.`);
            this.soundBuffers[index] = null;
            audioLoadingTracker.markFailure(url, AUDIO_ERROR_TYPES.CONTEXT_ERROR, new Error('AudioContext not initialized'));
            return null;
        }

        audioLoadingTracker.markPending(url);

        const handleLoadError = (errorType, errorObj) => {
            const errorInfo = getErrorMessage(errorType, url);
            console.error(`[AUDIO] Error (${errorType}) loading sound ${url}:`, errorObj);
            audioLoadingTracker.markFailure(url, errorType, errorObj);
            if (notifyUser) {
                showNotification(`${errorInfo.title}: ${errorInfo.message}`, 'error');
            }
            this.soundBuffers[index] = null;
            return null;
        };

        try {
            // `fetch` downloads the audio file as raw data.
            let response;
            try {
                response = await fetch(url);
            } catch (fetchError) {
                return handleLoadError(AUDIO_ERROR_TYPES.NETWORK_ERROR, fetchError);
            }

            if (!response.ok) {
                return handleLoadError(AUDIO_ERROR_TYPES.NETWORK_ERROR, new Error(`HTTP ${response.status}`));
            }

            // `arrayBuffer` converts the response to a format that Web Audio API can understand.
            let arrayBuffer;
            try {
                arrayBuffer = await response.arrayBuffer();
            } catch (bufferError) {
                return handleLoadError(AUDIO_ERROR_TYPES.NETWORK_ERROR, bufferError);
            }

            // `decodeAudioData` converts raw data into an `AudioBuffer`, which is a
            // PCM (Pulse-Code Modulation) audio format optimized for playback.
            let audioBuffer;
            try {
                audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            } catch (decodeError) {
                return handleLoadError(categorizeDecodeError(decodeError), decodeError);
            }

            // Validate the decoded buffer before storing
            const validation = validateAudioBuffer(audioBuffer);
            if (!validation.isValid) {
                return handleLoadError(AUDIO_ERROR_TYPES.CORRUPTED_FILE, new Error(validation.error));
            }

            // Store the decoded buffer in the array at the correct position.
            this.soundBuffers[index] = audioBuffer;
            audioLoadingTracker.markSuccess(url);
            console.log(`[AUDIO] Sound loaded successfully: ${url}`);
            return audioBuffer;

        } catch (error) {
            return handleLoadError(AUDIO_ERROR_TYPES.UNKNOWN_ERROR, error);
        }
    }

    /**
     * Loads an entire array of sound URLs in batches to avoid saturating connections.
     * @param {string[]} soundUrls - An array of URLs to load.
     * @param {function} onProgress - Optional callback for loading progress (loadedCount, totalCount).
     * @returns {Promise<object>} Loading summary with success/failure stats
     */
    async loadSounds(soundUrls, onProgress = null) {
        this.soundBuffers = []; // Clear previous project buffers.
        audioLoadingTracker.reset(); // Reset loading tracker for new project
        
        const total = soundUrls.length;
        const BATCH_SIZE = 10; // Load 10 sounds at a time

        let successCount = 0;
        let failureCount = 0;

        try {
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = soundUrls.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map((url, index) => 
                    this.loadSound(url, i + index, false) // Don't notify for each sound in batch
                        .then(() => {
                            successCount++;
                        })
                        .catch((error) => {
                            failureCount++;
                            console.error(`[AUDIO] Batch load error for index ${i + index}:`, error);
                        })
                );

                // Wait for batch to complete, but don't let one failure stop the whole batch
                await Promise.allSettled(batchPromises);

                if (onProgress) {
                    const loadedCount = Math.min(i + BATCH_SIZE, total);
                    onProgress(loadedCount, total);
                }
            }

            const stats = audioLoadingTracker.getFailureStats();
            console.log(`[AUDIO] Project sounds loaded. Success: ${stats.successful}, Failed: ${stats.failed}`);

            // Notify user if there were failures
            if (stats.failed > 0) {
                const failureMessage = `${stats.failed} audio file(s) failed to load. They will be silent.`;
                showNotification(failureMessage, 'warning');
                console.warn(`[AUDIO] Failed files:`, stats.failureDetails);
            }

            return {
                total,
                successful: stats.successful,
                failed: stats.failed,
                failureDetails: stats.failureDetails
            };

        } catch (error) {
            console.error('[AUDIO] Critical error during batch loading:', error);
            throw error;
        }
    }

    /**
     * Plays an AudioBuffer connected to the AnalyserNode with restart logic.
     * @param {AudioBuffer|null} buffer - The buffer to play.
     * @param {string|number} key - Identifier to track and restart previous playback on the same slot.
     * @returns {number} Duration of the sound in seconds, or 0 if playback failed.
     */
    playBuffer(buffer, key = 'default') {
        try {
            if (!buffer) return 0;

            // Ensure AudioContext exists
            if (!this.audioContext) {
                console.warn(`[AUDIO] Cannot play sound: AudioContext not initialized.`);
                return 0;
            }

            // Ensure AudioContext is running (browsers suspend it if no user gesture)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch((error) => {
                    console.warn('[AUDIO] Failed to resume AudioContext:', error);
                });
            }

            // Validate the buffer before attempting playback
            const validation = validateAudioBuffer(buffer);
            if (!validation.isValid) {
                console.warn(`[AUDIO] Invalid audio buffer for key ${key}: ${validation.error}`);
                return 0;
            }

            // STOP PREVIOUS SOUND (RESTART LOGIC)
            if (this.activeSources.has(key)) {
                try {
                    const oldSource = this.activeSources.get(key);
                    oldSource.stop();
                } catch (e) {
                    // Ignore errors if the source has already finished or hasn't started
                }
                this.activeSources.delete(key);
            }

            // Create a new AudioBufferSourceNode for playback
            let source;
            try {
                source = this.audioContext.createBufferSource();
            } catch (error) {
                console.error('[AUDIO] Failed to create buffer source:', error);
                return 0;
            }

            try {
                source.buffer = buffer;
                source.connect(this.analyser);
                this.activeSources.set(key, source);

                source.onended = () => {
                    if (this.activeSources.get(key) === source) {
                        this.activeSources.delete(key);
                    }
                };

                source.onerror = (error) => {
                    console.error(`[AUDIO] Playback error for key ${key}:`, error);
                    this.activeSources.delete(key);
                };

                source.start();
                return source.buffer.duration;

            } catch (error) {
                console.error(`[AUDIO] Error during playback setup for key ${key}:`, error);
                this.activeSources.delete(key);
                try {
                    source.disconnect();
                } catch (e) {}
                return 0;
            }

        } catch (error) {
            console.error('[AUDIO] Unexpected error in playBuffer:', error);
            return 0;
        }
    }

    /**
     * Stops any currently playing sound for the specified key.
     * @param {string|number} key
     */
    stopSound(key) {
        if (this.activeSources.has(key)) {
            try {
                this.activeSources.get(key).stop();
            } catch (e) {}
            this.activeSources.delete(key);
        }
    }

    /**
     * Stops all currently playing sounds whose key starts with the specified prefix (e.g. 'draft:').
     * @param {string} prefix
     */
    stopSoundsWithPrefix(prefix) {
        for (const key of Array.from(this.activeSources.keys())) {
            if (typeof key === 'string' && key.startsWith(prefix)) {
                this.stopSound(key);
            }
        }
    }

    /**
     * Decodes an audio File or Blob into an AudioBuffer using the active AudioContext.
     * Initializes AudioContext if not already initialized.
     * @param {Blob|File} file - The file/blob to decode.
     * @returns {Promise<AudioBuffer>}
     */
    async decodeAudioFile(file) {
        if (!this.audioContext) {
            await this.init();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(() => {});
        }
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        const validation = validateAudioBuffer(audioBuffer);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }
        return audioBuffer;
    }

    /**
     * Plays the sound associated with a specific pad.
     * @param {number} padIndex - The index of the pad (0-63) to play.
     * @returns {number} Duration of the sound in seconds, or 0 if no sound was played.
     */
    playPadSound(padIndex) {
        return this.playBuffer(this.soundBuffers[padIndex], padIndex);
    }

    /**
     * Getter to obtain the AnalyserNode. Used by the visualizer.
     * @returns {AnalyserNode} The audio engine's analyzer node.
     */
    getAnalyser() {
        return this.analyser;
    }

    /**
     * Gets loading statistics for debugging and monitoring
     * @returns {object} Stats including successes, failures, and detailed failure info
     */
    getLoadingStats() {
        return audioLoadingTracker.getFailureStats();
    }

    /**
     * Attempts to reload a previously failed audio file
     * @param {string} url - The URL of the file to retry
     * @param {number} index - The pad index where it should be stored
     * @returns {Promise<AudioBuffer|null>} The loaded buffer or null on failure
     */
    async retryFailedSound(url, index) {
        console.log(`[AUDIO] Retrying failed sound: ${url}`);
        return await this.loadSound(url, index, true); // Notify user on retry
    }
}

// SINGLETON EXPORT
// Singleton instance of the `AudioEngine` class.
// Pattern ensures a single audio engine instance throughout
// the application, preventing conflicts and optimizing resource usage.
export const audioEngine = new AudioEngine();