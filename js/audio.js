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
    validateAudioBuffer,
    audioLoadingTracker,
    AUDIO_ERROR_TYPES
} from './audioErrorHandler.js';
import { showNotification } from './notifications.js';
import { translate } from './i18n.js';
import { AUDIO_LOAD_CONCURRENCY } from './constants.js';
import { mapWithConcurrency } from './concurrency.js';
import { onVisibilityChange } from './visibilityManager.js';
import { debug, logger } from './logger.js';

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

        // 2. ACTIVE SOURCES
        // Currently playing source nodes by playback key (see `playBuffer`).
        // Decoded buffers are owned by the caller (project or draft), not by the engine.
        this.activeSources = new Map();
    }

    /**
     * Initializes the AudioContext and AnalyserNode.
     * Must be called after a user gesture (e.g., click/touch).
     * @throws {Error} If Web Audio API is not supported or initialization fails.
     */
    async init() {
        if (this.isReady()) return; // Already initialized and ready
        
        // Clean up any partially initialized context from a previous failed attempt
        if (this.audioContext) {
            try {
                if (typeof this.audioContext.close === 'function') {
                    await this.audioContext.close();
                }
            } catch (_) {}
            this.audioContext = null;
        }
        this.analyser = null;

        // Check browser support
        if (!isWebAudioSupported()) {
            const errorMsg = "Web Audio API is not supported in this browser. Please use Chrome, Firefox, Edge, or Safari.";
            this.initError = errorMsg;
            logger.error("[AUDIO]", errorMsg);
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
                        debug("[AUDIO] AudioContext resumed after tab became visible.");
                    });
                }
            });

            this.initError = null;
            debug("[AUDIO] AudioEngine initialized successfully.");
        } catch (error) {
            const errorMsg = `[AUDIO] Failed to initialize AudioContext: ${error.message}`;
            this.initError = errorMsg;
            logger.error(errorMsg);
            if (this.audioContext) {
                try {
                    if (typeof this.audioContext.close === 'function') {
                        await this.audioContext.close();
                    }
                } catch (_) {}
                this.audioContext = null;
            }
            this.analyser = null;
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
     * Fetches and decodes a single audio file. Never touches the active buffers.
     * @param {string|null} url - The URL of the audio file to load.
     * @returns {Promise<AudioBuffer|null>} The decoded buffer or null on failure
     */
    async loadSound(url) {
        if (!url) return null;

        // Ensure audioContext is available
        if (!this.audioContext) {
            logger.warn(`[AUDIO] Cannot load sound: AudioContext not initialized.`);
            audioLoadingTracker.markFailure(url, AUDIO_ERROR_TYPES.CONTEXT_ERROR, new Error('AudioContext not initialized'));
            return null;
        }

        audioLoadingTracker.markPending(url);

        const handleLoadError = (errorType, errorObj) => {
            logger.error(`[AUDIO] Error (${errorType}) loading sound ${url}:`, errorObj);
            audioLoadingTracker.markFailure(url, errorType, errorObj);
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

            audioLoadingTracker.markSuccess(url);
            debug(`[AUDIO] Sound loaded successfully: ${url}`);
            return audioBuffer;

        } catch (error) {
            return handleLoadError(AUDIO_ERROR_TYPES.UNKNOWN_ERROR, error);
        }
    }

    /**
     * Fetches and decodes a set of sample URLs with bounded concurrency
     * (AUDIO_LOAD_CONCURRENCY), so one slow file never stalls the others.
     * Each URL is loaded once. Failed URLs are simply absent from the result.
     *
     * @param {string[]} urls - Distinct sample URLs.
     * @param {function(number, number): void} [onProgress] - Called with (loadedCount, totalCount).
     * @returns {Promise<{buffersByUrl: Map<string, AudioBuffer>, total: number, successful: number, failed: number, failureDetails: object}>}
     */
    async loadBuffers(urls, onProgress = null) {
        audioLoadingTracker.reset();

        const uniqueUrls = [...new Set(urls.filter(Boolean))];
        const total = uniqueUrls.length;
        const buffersByUrl = new Map();
        let loadedCount = 0;

        if (onProgress) onProgress(0, total);

        await mapWithConcurrency(uniqueUrls, AUDIO_LOAD_CONCURRENCY, async (url) => {
            const buffer = await this.loadSound(url);
            if (buffer) buffersByUrl.set(url, buffer);
            loadedCount++;
            if (onProgress) onProgress(loadedCount, total);
        });

        const stats = audioLoadingTracker.getFailureStats();
        debug(`[AUDIO] Sounds loaded. Success: ${stats.successful}, Failed: ${stats.failed}`);

        if (stats.failed > 0) {
            showNotification(translate('audio.loadFailures', { count: stats.failed }), 'warning');
            logger.warn('[AUDIO] Failed files:', stats.failureDetails);
        }

        return {
            buffersByUrl,
            total,
            successful: stats.successful,
            failed: stats.failed,
            failureDetails: stats.failureDetails
        };
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
                logger.warn(`[AUDIO] Cannot play sound: AudioContext not initialized.`);
                return 0;
            }

            // Ensure AudioContext is running (browsers suspend it if no user gesture)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch((error) => {
                    logger.warn('[AUDIO] Failed to resume AudioContext:', error);
                });
            }

            // Validate the buffer before attempting playback
            const validation = validateAudioBuffer(buffer);
            if (!validation.isValid) {
                logger.warn(`[AUDIO] Invalid audio buffer for key ${key}: ${validation.error}`);
                return 0;
            }

            // STOP PREVIOUS SOUND (RESTART LOGIC)
            if (this.activeSources.has(key)) {
                try {
                    const oldSource = this.activeSources.get(key);
                    oldSource.stop();
                } catch (_e) {
                    // Ignore errors if the source has already finished or hasn't started
                }
                this.activeSources.delete(key);
            }

            // Create a new AudioBufferSourceNode for playback
            let source;
            try {
                source = this.audioContext.createBufferSource();
            } catch (error) {
                logger.error('[AUDIO] Failed to create buffer source:', error);
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
                    logger.error(`[AUDIO] Playback error for key ${key}:`, error);
                    this.activeSources.delete(key);
                };

                source.start();
                return source.buffer.duration;

            } catch (error) {
                logger.error(`[AUDIO] Error during playback setup for key ${key}:`, error);
                this.activeSources.delete(key);
                try {
                    source.disconnect();
                } catch (_e) {}
                return 0;
            }

        } catch (error) {
            logger.error('[AUDIO] Unexpected error in playBuffer:', error);
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
            } catch (_e) {}
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
     * Stops all currently playing sounds across all keys.
     */
    stopAllSounds() {
        for (const key of Array.from(this.activeSources.keys())) {
            this.stopSound(key);
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