/**
 * ANIMATION ENGINE (animationEngine.js)
 * 
 * Contains the core logic for scheduling and fading lights.
 */

import { setWebColor, getWebColor, LED_LEVELS } from './webInterface.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';

// Only the physical flush needs to be re-exported (used by lights.js);
// the other color helpers are imported directly from their source modules.
export { flushPhysicalColors };

/**
 * Handles delayed callbacks without creating new object instances for every call.
 * Uses a recycled pool of task objects.
 */
class AnimationScheduler {
    constructor() {
        this.tasks = [];
        this.pool = [];  
    }

    schedule(callback, delay) {
        // reuse an object from the pool if available, else create new
        const task = this.pool.pop() || { callback: null, triggerTime: 0 };
        task.callback = callback;
        task.triggerTime = performance.now() + delay;
        this.tasks.push(task);
    }

    update(now) {
        if (this.tasks.length === 0) return;

        // Iterate backwards to allow removal
        for (let i = this.tasks.length - 1; i >= 0; i--) {
            const task = this.tasks[i];
            if (now >= task.triggerTime) {
                // Run callback
                if (task.callback) task.callback();

                // Reset and recycle task object
                task.callback = null;
                task.triggerTime = 0;
                this.pool.push(task);

                // Remove from active list (swap with last for O(1) removal, then pop)
                const last = this.tasks[this.tasks.length - 1];
                this.tasks[i] = last;
                this.tasks.pop();
            }
        }
    }
}

/** Brightness of each third of a standard fade. */
const FADE_PHASE_LEVELS = ['full', 'medium', 'low'];

/**
 * Which third of a fade is running.
 * @param {number} elapsed - Ms since the fade started.
 * @param {number} duration - Total fade duration in ms.
 * @returns {0|1|2|null} The phase, or null once the fade is over.
 */
function fadePhase(elapsed, duration) {
    if (elapsed < duration * (1 / 3)) return 0;
    if (elapsed < duration * (2 / 3)) return 1;
    if (elapsed < duration) return 2;
    return null;
}

/**
 * Handles all fading logic in a single batched loop.
 * Eliminates the creation of separate animation objects for every single LED fade.
 */
class FadeSystem {
    constructor() {
        // Map allows sparse storage (only active pads) without iterating 100 empty slots
        // Key: Pad ID/Index (string or number), Value: FadeState object
        this.activeFades = new Map();
        this.pool = []; // Reuse state objects
    }

    /**
     * Start a fade on a specific pad.
     * @param {Object} p - The pad element (HTML Node) or [x, y] coordinates.
     * @param {string} colorName - Color name key.
     * @param {number} duration - Total duration in ms.
     * @param {string} mode - 'standard' or 'instant'.
     */
    add(p, colorName, duration, mode = 'standard', config = null) {
        const key = Array.isArray(p) ? `${p[0]},${p[1]}` : p;

        let state = this.activeFades.get(key);

        if (!state) {
            state = this.pool.pop() || { p: null, color: '', start: 0, dur: 0, mode: 'standard', base: null, off: null, config: null };
            this.activeFades.set(key, state);
        }

        state.p = p;
        state.color = colorName;
        state.start = performance.now();
        state.dur = duration || 300;
        state.mode = mode;
        state.config = config;

        state.base = getLpColor(colorName);
        state.off = getLpColor('off');
    }

    update(now) {
        if (this.activeFades.size === 0) return;
        for (const [key, state] of this.activeFades) {
            this._updateFade(key, state, now - state.start);
        }
    }

    /**
     * Paints one fade for the current frame, or ends it.
     * @param {string} key
     * @param {object} state
     * @param {number} elapsed - Ms since the fade started.
     */
    _updateFade(key, state, elapsed) {
        if (state.mode === 'multi' && state.config) {
            this._updateMultiFade(key, state, elapsed);
        } else if (state.color === 'off') {
            this._finish(key, state);
        } else if (!getWebColor(state.color)) {
            this._recycle(key, state); // Unknown colour: drop silently
        } else if (state.mode === 'instant') {
            this._updateInstantFade(key, state, elapsed);
        } else {
            this._updateStandardFade(key, state, elapsed);
        }
    }

    /** Multi-color sequence (e.g. Red -> Amber -> Green), one step per third. */
    _updateMultiFade(key, state, elapsed) {
        const phase = fadePhase(elapsed, state.dur);
        if (phase === null) {
            this._finish(key, state);
            return;
        }
        const step = state.config.sequence[phase];
        if (getWebColor(step.color)) setWebColor(step.color, state.p, step.level);
        setPhysicalColor(getLpColor(step.color, step.level), state.p);
    }

    /** Instant mode: full brightness for the whole duration, no fading. */
    _updateInstantFade(key, state, elapsed) {
        if (elapsed >= state.dur) {
            this._finish(key, state);
            return;
        }
        setWebColor(state.color, state.p, LED_LEVELS.full);
        setPhysicalColor(state.base?.full, state.p);
    }

    /** Standard fade: full -> medium -> low, one level per third, then off. */
    _updateStandardFade(key, state, elapsed) {
        const phase = fadePhase(elapsed, state.dur);
        if (phase === null) {
            this._finish(key, state);
            return;
        }
        const level = FADE_PHASE_LEVELS[phase];
        setWebColor(state.color, state.p, LED_LEVELS[level]);
        // Colours without brightness levels (e.g. some RGB entries) are a single value.
        setPhysicalColor(state.base?.[level] || state.base, state.p);
    }

    /** Turns the pad off and releases the fade. */
    _finish(key, state) {
        setWebColor('off', state.p);
        setPhysicalColor(state.off, state.p);
        this._recycle(key, state);
    }

    _recycle(key, state) {
        state.p = null; // unnecessary to hold ref
        state.config = null;
        this.activeFades.delete(key);
        this.pool.push(state);
    }
}

// Instantiate Global Managers
export const scheduler = new AnimationScheduler();
export const fader = new FadeSystem();
export const activeAnimations = new Set();
