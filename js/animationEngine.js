/**
 * ANIMATION ENGINE (animationEngine.js)
 * 
 * Contains the core logic for scheduling and fading lights.
 */

import { setWebColor, webColorMap } from './webInterface.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';

export { setWebColor, webColorMap, setPhysicalColor, getLpColor, flushPhysicalColors };

/**
 * Handles delayed callbacks without creating new object instances for every call.
 * Uses a recycled pool of task objects.
 */
export class AnimationScheduler {
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

/**
 * Handles all fading logic in a single batched loop.
 * Eliminates the creation of separate animation objects for every single LED fade.
 */
export class FadeSystem {
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
            const elapsed = now - state.start;
            const p = state.p;

            if (state.mode === 'multi' && state.config) {
                // Multi-color sequence (Red -> Amber -> Green)
                const sequence = state.config.sequence;
                const s1Time = state.dur * (1 / 3);
                const s2Time = state.dur * (2 / 3);

                if (elapsed < s1Time) {
                    const step = sequence[0];
                    setWebColor(webColorMap[step.color][step.level], p);
                    setPhysicalColor(getLpColor(step.color, step.level), p);
                } else if (elapsed < s2Time) {
                    const step = sequence[1];
                    setWebColor(webColorMap[step.color][step.level], p);
                    setPhysicalColor(getLpColor(step.color, step.level), p);
                } else if (elapsed < state.dur) {
                    const step = sequence[2];
                    setWebColor(webColorMap[step.color][step.level], p);
                    setPhysicalColor(getLpColor(step.color, step.level), p);
                } else {
                    setWebColor('off', p);
                    setPhysicalColor(state.off, p);
                    this._recycle(key, state);
                }
                continue;
            }

            if (state.color === 'off') {
                setWebColor('off', p);
                setPhysicalColor(state.off, p);
                this._recycle(key, state);
                continue;
            }

            const webColors = webColorMap[state.color];
            if (!webColors) {
                this._recycle(key, state);
                continue;
            }

            if (state.mode === 'instant') {
                // Instant Mode: Full -> Off (No fading, strictly for duration)
                if (elapsed < state.dur) {
                    setWebColor(webColors.full, p);
                    setPhysicalColor(state.base?.full, p);
                } else {
                    setWebColor('off', p);
                    setPhysicalColor(state.off, p);
                    this._recycle(key, state);
                }
            } else {
                // Standard Fade: Full -> Medium -> Low -> Off
                const step1 = state.dur * (1 / 3);
                const step2 = state.dur * (2 / 3);
                if (elapsed < step1) {
                    setWebColor(webColors.full, p);
                    setPhysicalColor(state.base?.full || state.base, p);
                } else if (elapsed < step2) {
                    setWebColor(webColors.medium, p);
                    setPhysicalColor(state.base?.medium || state.base, p);
                } else if (elapsed < state.dur) {
                    setWebColor(webColors.low, p);
                    setPhysicalColor(state.base?.low || state.base, p);
                } else {
                    setWebColor('off', p);
                    setPhysicalColor(state.off, p);
                    this._recycle(key, state);
                }
            }
        }
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
