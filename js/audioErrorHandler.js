/**
 * AUDIO ERROR HANDLER (audioErrorHandler.js)
 *
 * Centralized error handling for Web Audio API operations.
 * Provides:
 * - Error categorization (network, decoding, unsupported codec, etc.)
 * - Detailed logging for debugging
 */

/**
 * Error types for audio operations
 */
export const AUDIO_ERROR_TYPES = {
    NETWORK_ERROR: 'NETWORK_ERROR',        // Failed to fetch audio file
    DECODE_ERROR: 'DECODE_ERROR',          // Failed to decode audio data
    UNSUPPORTED_CODEC: 'UNSUPPORTED_CODEC',// Codec not supported by browser
    CORRUPTED_FILE: 'CORRUPTED_FILE',      // Audio file is corrupted
    CONTEXT_ERROR: 'CONTEXT_ERROR',        // AudioContext not available
    PLAYBACK_ERROR: 'PLAYBACK_ERROR',      // Error during playback
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Categorizes an error from decodeAudioData failure
 * @param {Error} error - The error thrown by decodeAudioData
 * @returns {string} One of AUDIO_ERROR_TYPES
 */
export function categorizeDecodeError(error) {
    if (!error) return AUDIO_ERROR_TYPES.UNKNOWN_ERROR;
    
    const errorMsg = error.message || error.toString();
    
    // Check error message for specific issues
    if (errorMsg.includes('INVALID_STATE') || errorMsg.includes('InvalidStateError')) {
        return AUDIO_ERROR_TYPES.CORRUPTED_FILE;
    }
    if (errorMsg.includes('NOT_SUPPORTED') || errorMsg.includes('NotSupportedError')) {
        return AUDIO_ERROR_TYPES.UNSUPPORTED_CODEC;
    }
    if (errorMsg.includes('SYNTAX') || errorMsg.includes('SyntaxError')) {
        return AUDIO_ERROR_TYPES.CORRUPTED_FILE;
    }
    if (errorMsg.includes('TYPE') || errorMsg.includes('TypeError')) {
        return AUDIO_ERROR_TYPES.CORRUPTED_FILE;
    }
    
    return AUDIO_ERROR_TYPES.DECODE_ERROR;
}

/**
 * Validates an audio buffer before attempting playback
 * @param {AudioBuffer} buffer - The audio buffer to validate
 * @returns {object} {isValid, error}
 */
export function validateAudioBuffer(buffer) {
    if (!buffer) {
        return {
            isValid: false,
            error: 'Audio buffer is null or undefined'
        };
    }
    
    if (!(buffer instanceof AudioBuffer)) {
        return {
            isValid: false,
            error: 'Invalid audio buffer object'
        };
    }
    
    if (buffer.length === 0) {
        return {
            isValid: false,
            error: 'Audio buffer is empty'
        };
    }
    
    if (buffer.duration === 0) {
        return {
            isValid: false,
            error: 'Audio buffer has zero duration'
        };
    }
    
    return { isValid: true };
}

/**
 * Tracks which sounds failed to load and why
 */
class AudioLoadingTracker {
    constructor() {
        this.failedLoads = new Map(); // url -> {type, error, timestamp}
        this.successfulLoads = new Set();
        this.pendingLoads = new Set();
    }
    
    markPending(url) {
        this.pendingLoads.add(url);
    }
    
    markSuccess(url) {
        this.pendingLoads.delete(url);
        this.successfulLoads.add(url);
        this.failedLoads.delete(url);
    }
    
    markFailure(url, errorType, error) {
        this.pendingLoads.delete(url);
        this.failedLoads.set(url, {
            type: errorType,
            error: error.message || error.toString(),
            timestamp: new Date().toISOString()
        });
    }
    
    getFailureStats() {
        return {
            successful: this.successfulLoads.size,
            failed: this.failedLoads.size,
            pending: this.pendingLoads.size,
            failureDetails: Object.fromEntries(this.failedLoads)
        };
    }
    
    reset() {
        this.failedLoads.clear();
        this.successfulLoads.clear();
        this.pendingLoads.clear();
    }
}

export const audioLoadingTracker = new AudioLoadingTracker();
