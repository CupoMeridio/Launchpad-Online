/**
 * AUDIO ERROR HANDLER (audioErrorHandler.js)
 *
 * Centralized error handling for Web Audio API operations.
 * Provides:
 * - Error categorization (network, decoding, unsupported codec, etc.)
 * - User-friendly error messages
 * - Detailed logging for debugging
 * - Recovery suggestions
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
 * Generates a user-friendly error message for UI display
 * @param {string} errorType - One of AUDIO_ERROR_TYPES
 * @param {string} url - The audio file URL that failed
 * @returns {object} {title, message, suggestion}
 */
export function getErrorMessage(errorType, url = null) {
    const urlDisplay = url ? url.split('/').pop() : 'unknown file';
    
    const messages = {
        [AUDIO_ERROR_TYPES.NETWORK_ERROR]: {
            title: 'Network Error',
            message: `Could not download audio file: ${urlDisplay}`,
            suggestion: 'Check your internet connection and try reloading the project.'
        },
        [AUDIO_ERROR_TYPES.DECODE_ERROR]: {
            title: 'Decoding Error',
            message: `Failed to decode audio file: ${urlDisplay}`,
            suggestion: 'The audio file may be corrupted. Try uploading a different file.'
        },
        [AUDIO_ERROR_TYPES.UNSUPPORTED_CODEC]: {
            title: 'Unsupported Format',
            message: `Audio codec not supported: ${urlDisplay}`,
            suggestion: 'Use MP3, WAV, or OGG format. Your browser may not support this codec.'
        },
        [AUDIO_ERROR_TYPES.CORRUPTED_FILE]: {
            title: 'Corrupted File',
            message: `Audio file appears to be corrupted: ${urlDisplay}`,
            suggestion: 'Try re-downloading or converting the audio file to a standard format.'
        },
        [AUDIO_ERROR_TYPES.CONTEXT_ERROR]: {
            title: 'Audio Context Error',
            message: 'Audio system is not initialized',
            suggestion: 'Click on the interface to activate the audio system.'
        },
        [AUDIO_ERROR_TYPES.PLAYBACK_ERROR]: {
            title: 'Playback Error',
            message: 'Failed to play audio',
            suggestion: 'Check that your audio output is connected and working.'
        },
        [AUDIO_ERROR_TYPES.UNKNOWN_ERROR]: {
            title: 'Unknown Error',
            message: `An unexpected error occurred: ${urlDisplay}`,
            suggestion: 'Reload the page and try again.'
        }
    };
    
    return messages[errorType] || messages[AUDIO_ERROR_TYPES.UNKNOWN_ERROR];
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
    
    getFailedUrls() {
        return Array.from(this.failedLoads.keys());
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
