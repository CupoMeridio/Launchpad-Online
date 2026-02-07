/**
 * LIGHTS MODULE (lights.js)
 * 
 * This module orchestrates light animations for both the physical Launchpad
 * and the web UI (digital Launchpad). It uses the respective interface modules
 * to perform the actual updates.
 */

import { setWebColor, webColorMap } from './webInterface.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';

/**
 * Registry of available animations.
 */
export const animations = {};

let animationFrameId = null;
let lastTickTime = 0;

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
     * @param {string} mode - 'standard', 'short', or 'instant'.
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
        state.dur = duration || (mode === 'short' ? 140 : 300);
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
            } else if (state.mode === 'short') {
                // Short Fade: Full -> Low -> Off
                const step1 = state.dur / 2;
                if (elapsed < step1) {
                    setWebColor(webColors.full, p);
                    setPhysicalColor(state.base?.full, p);
                } else if (elapsed < state.dur) {
                    setWebColor(webColors.low, p);
                    setPhysicalColor(state.base?.low, p);
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
                    setPhysicalColor(state.base?.full, p);
                } else if (elapsed < step2) {
                    setWebColor(webColors.medium, p);
                    setPhysicalColor(state.base?.medium, p);
                } else if (elapsed < state.dur) {
                    setWebColor(webColors.low, p);
                    setPhysicalColor(state.base?.low, p);
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
const scheduler = new AnimationScheduler();
const fader = new FadeSystem();
const activeAnimations = new Set();

// ============================================================================
// STATE-BASED ANIMATION CLASSES (Advanced Optimization)
// ============================================================================

class MatrixRainAnimation {
    constructor(colorName, duration) {
        this.startTime = performance.now();
        this.colorName = colorName;
        this.baseDuration = 1340;
        this.factor = duration ? duration / this.baseDuration : 1;

        // Pre-calculate per-column physics
        this.columns = [];
        for (let x = 0; x < 8; x++) {
            this.columns.push({
                delay: Math.random() * 500 * this.factor,
                speed: (70 + Math.random() * 50) * this.factor,
                lastRow: -1 // Track which row we last triggered
            });
        }
    }

    update(now) {
        let activeCount = 0;
        const elapsed = now - this.startTime;

        for (let x = 0; x < 8; x++) {
            const col = this.columns[x];
            const colTime = elapsed - col.delay;

            if (colTime > 0) {
                // Determine which row should be active at this time
                const currentRow = Math.floor(colTime / col.speed);

                if (currentRow < 8) {
                    activeCount++;
                    // Only trigger fade if we entered a new row
                    if (currentRow > col.lastRow) {
                        const fadeDuration = col.speed * 2;
                        fader.add([x, currentRow], this.colorName, fadeDuration, 'short');
                        col.lastRow = currentRow;
                    }
                }
            } else {
                activeCount++; // Waiting to start
            }
        }

        return activeCount === 0; // Finished when all columns are done
    }
}

class StrobeBurstAnimation {
    constructor(colorName, duration) {
        this.startTime = performance.now();
        this.colorName = colorName;
        this.totalDuration = duration || 480;
        this.flashInterval = this.totalDuration / 4;
        this.flashDuration = this.flashInterval * 0.4;

        this.flashes = [0, 1, 2, 3]; // 4 flashes
        this.currentFlashIdx = 0;
        this.state = 'waiting'; // waiting, on, off
        this.flashEndTime = 0;

        this.baseColor = getLpColor(colorName);
        this.lpOff = getLpColor('off');
        this.webColors = webColorMap[colorName];
    }

    update(now) {
        const elapsed = now - this.startTime;
        const targetFlashIdx = Math.floor(elapsed / this.flashInterval);

        if (targetFlashIdx >= 4) return true; // Finished

        // Check if we entered a new flash cycle
        if (targetFlashIdx > this.currentFlashIdx) {
            this.currentFlashIdx = targetFlashIdx;
            this.state = 'waiting';
        }

        const flashLocalTime = elapsed % this.flashInterval;

        if (this.state === 'waiting') {
            if (flashLocalTime < this.flashDuration) {
                // TRIGGER FLASH ONCE
                this._triggerFlash();
                this.state = 'on';
            }
        }

        return false;
    }

    _triggerFlash() {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                fader.add([x, y], this.colorName, this.flashDuration, 'instant');
            }
        }
    }
}

class StrobeBurstMultiAnimation {
    constructor(config, duration) {
        this.startTime = performance.now();
        this.config = config;
        this.totalDuration = duration || 480;
        this.flashInterval = this.totalDuration / 4;
        this.flashDuration = this.flashInterval * 0.4;

        this.currentFlashIdx = 0;
        this.state = 'waiting'; // waiting, on, off
        this.lpOff = getLpColor('off');
    }

    update(now) {
        const elapsed = now - this.startTime;
        const targetFlashIdx = Math.floor(elapsed / this.flashInterval);

        if (targetFlashIdx >= 4) return true; // Finished

        if (targetFlashIdx > this.currentFlashIdx) {
            this.currentFlashIdx = targetFlashIdx;
            this.state = 'waiting';
        }

        const flashLocalTime = elapsed % this.flashInterval;

        if (this.state === 'waiting') {
            if (flashLocalTime < this.flashDuration) {
                // TRIGGER FLASH
                const colorConfig = this.config.sequence[Math.min(this.currentFlashIdx, this.config.sequence.length - 1)];
                this._triggerFlash(colorConfig.color);
                this.state = 'on';
            }
        }

        return false;
    }

    _triggerFlash(colorName) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                fader.add([x, y], colorName, this.flashDuration, 'instant');
            }
        }
    }
}

/**
 * Generic class for animations that can be pre-calculated.
 * Instead of scheduling reliable timeouts, we sort events by time and trigger them
 * when the elapsed time catches up.
 */
class PrecomputedAnimation {
    constructor(colorName, duration, generatorFn, onTrigger) {
        this.startTime = performance.now();
        this.colorName = colorName;
        // Check if generatorFn returns the events array directly or is a function
        if (typeof generatorFn === 'function') {
            this.events = generatorFn(duration);
        } else {
            this.events = generatorFn;
        }
        this.events.sort((a, b) => a.time - b.time);
        this.cursor = 0;
        this.onTrigger = onTrigger;
    }

    update(now) {
        const elapsed = now - this.startTime;

        while (this.cursor < this.events.length) {
            const event = this.events[this.cursor];
            if (elapsed >= event.time) {
                // Trigger event
                if (this.onTrigger) {
                    this.onTrigger(event, this.colorName);
                } else {
                    // Default behavior: FadeSystem
                    // Supports 'mode' property in events, or falls back to 'short' if event.short is true
                    let mode = event.mode || (event.short ? 'short' : 'standard');
                    fader.add(event.p, this.colorName, event.dur, mode);
                }
                this.cursor++;
            } else {
                break; // Next event is in the future
            }
        }

        return this.cursor >= this.events.length;
    }
}


// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animationLoop(timestamp) {
    if (!lastTickTime) lastTickTime = timestamp;
    // const deltaTime = timestamp - lastTickTime; // Unused for now, but good for physics
    lastTickTime = timestamp;

    // 1. Update Scheduler (Delayed tasks)
    scheduler.update(timestamp);

    // 2. Update Fades (Batched lighting updates)
    fader.update(timestamp);

    if (activeAnimations.size > 0) {
        activeAnimations.forEach(anim => {
            if (anim.update) {
                const isFinished = anim.update(timestamp);
                if (isFinished) activeAnimations.delete(anim);
            }
        });
    }

    // 4. Flush Hardware Messages
    flushPhysicalColors();

    animationFrameId = requestAnimationFrame(animationLoop);
}

// Start the loop
animationFrameId = requestAnimationFrame(animationLoop);

// ============================================================================
// PUBLIC UTILITIES (Mapped to new engines)
// ============================================================================

/**
 * Schedule a One-Shot callback.
 * Optimized: Uses AnimationScheduler to avoid closure/object creation overhead.
 */
const setLoopTimeout = (callback, delay) => {
    scheduler.schedule(callback, delay);
};

/**
 * Apply Standard Fade (Full->Med->Low->Off).
 * Optimized: Uses FadeSystem batching.
 */
const applyFade = (p, colorName, duration) => {
    fader.add(p, colorName, duration, 'standard');
};

/**
 * Apply Short Fade (Full->Low->Off).
 * Optimized: Uses FadeSystem batching.
 */
const applyFadeShort = (p, colorName, duration) => {
    fader.add(p, colorName, duration, 'short');
};

/**
 * Animation Factory
 */
const createAnimationLibrary = () => {
    const alphabetCoords = {
        'a': [[3, 0], [4, 0], [2, 1], [5, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'b': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        'c': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'd': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        'e': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [1, 5], [1, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        'f': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [1, 5], [1, 6], [1, 7]],
        'g': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [1, 3], [4, 3], [5, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'h': [[1, 0], [6, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'i': [[2, 0], [3, 0], [4, 0], [5, 0], [3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [3, 6], [4, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'j': [[4, 0], [5, 0], [6, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [1, 6], [5, 6], [2, 7], [3, 7], [4, 7]],
        'k': [[1, 0], [6, 0], [1, 1], [5, 1], [1, 2], [4, 2], [1, 3], [2, 3], [3, 3], [1, 4], [4, 4], [1, 5], [5, 5], [1, 6], [6, 6], [1, 7], [7, 7]],
        'l': [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'm': [[1, 0], [6, 0], [1, 1], [2, 1], [5, 1], [6, 1], [1, 2], [3, 2], [4, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'n': [[1, 0], [6, 0], [1, 1], [2, 1], [6, 1], [1, 2], [3, 2], [6, 2], [1, 3], [4, 2], [6, 3], [1, 4], [5, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'o': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'p': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [1, 5], [1, 6], [1, 7]],
        'q': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [4, 4], [6, 4], [1, 5], [5, 5], [6, 5], [2, 6], [3, 6], [4, 6], [5, 6], [1, 7], [6, 7], [7, 7]],
        'r': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [4, 4], [1, 5], [5, 5], [1, 6], [6, 6], [1, 7], [7, 7]],
        's': [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        't': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [3, 6], [4, 6], [3, 7], [4, 7]],
        'u': [[1, 0], [6, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'v': [[1, 0], [6, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [2, 5], [5, 5], [3, 6], [4, 6], [3, 7], [4, 7]],
        'w': [[1, 0], [7, 0], [1, 1], [7, 1], [1, 2], [7, 2], [1, 3], [4, 3], [7, 3], [1, 4], [3, 4], [5, 4], [7, 4], [1, 5], [2, 5], [6, 5], [7, 5], [1, 6], [7, 6], [1, 7], [7, 7]],
        'x': [[1, 0], [6, 0], [1, 1], [6, 1], [2, 2], [5, 2], [3, 3], [4, 3], [3, 4], [4, 4], [2, 5], [5, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'y': [[1, 0], [6, 0], [1, 1], [6, 1], [2, 2], [5, 2], [3, 3], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7]],
        'z': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [6, 1], [5, 2], [4, 3], [3, 4], [2, 5], [1, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]]
    };

    const numberCoords = {
        '0': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '1': [[4, 0], [3, 1], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        '2': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [6, 2], [6, 3], [5, 4], [4, 5], [3, 6], [2, 7], [1, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        '3': [[2, 0], [3, 0], [4, 0], [5, 0], [6, 1], [6, 2], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '4': [[1, 0], [1, 1], [1, 2], [1, 3], [6, 0], [6, 1], [6, 2], [6, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [6, 7]],
        '5': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        '6': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '7': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [6, 1], [5, 2], [4, 3], [3, 4], [2, 5], [1, 6], [1, 7]],
        '8': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '9': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [6, 4], [6, 5], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]]
    };

    const symbolCoords = {
        'question': [[3, 0], [4, 0], [5, 0], [2, 1], [6, 1], [6, 2], [4, 3], [5, 3], [4, 4], [4, 5], [4, 7]],
        'exclamation': [[3, 0], [4, 0], [3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [3, 7], [4, 7]]
    };

    const colors = ['red', 'green', 'amber'];

    colors.forEach(colorName => {
        // 1. PULSE
        animations[`pulse_${colorName}`] = {
            on: (x, y) => {
                setWebColor(webColorMap[colorName].full, [x, y]);
                setPhysicalColor(getLpColor(colorName), [x, y]);
            },
            off: (x, y) => {
                setWebColor('off', [x, y]);
                setPhysicalColor(getLpColor('off'), [x, y]);
            },
            type: 'momentary'
        };

        // 2. CROSS
        animations[`cross_${colorName}`] = {
            on: (x, y) => {
                const color = webColorMap[colorName].full;
                const lpColor = getLpColor(colorName);
                for (let i = 0; i < 8; i++) {
                    setWebColor(color, [i, y]);
                    setWebColor(color, [x, i]);
                    setPhysicalColor(lpColor, [i, y]);
                    setPhysicalColor(lpColor, [x, i]);
                }
            },
            off: (x, y) => {
                const lpOff = getLpColor('off');
                for (let i = 0; i < 8; i++) {
                    setWebColor('off', [i, y]);
                    setWebColor('off', [x, i]);
                    setPhysicalColor(lpOff, [i, y]);
                    setPhysicalColor(lpOff, [x, i]);
                }
            },
            type: 'momentary'
        };


        // 3. EXPAND
        animations[`expand_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 10 : 60;
                    const fadeDuration = dur ? stepDelay * 3 : 300;
                    const events = [];
                    // Center
                    events.push({ p: [x, y], time: 0, dur: fadeDuration });
                    // Rings
                    for (let dist = 1; dist < 8; dist++) {
                        const time = dist * stepDelay;
                        const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                        directions.forEach(p => {
                            if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) {
                                events.push({ p, time, dur: fadeDuration });
                            }
                        });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 3.1 EXPAND_REVERSE
        animations[`expand_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDist = Math.max(x, 7 - x, y, 7 - y);
                    const stepDelay = dur ? dur / (maxDist + 3) : 60;
                    const fadeDuration = dur ? stepDelay * 3 : 300;
                    const events = [];
                    for (let dist = maxDist; dist >= 0; dist--) {
                        const time = (maxDist - dist) * stepDelay;
                        if (dist === 0) {
                            events.push({ p: [x, y], time, dur: fadeDuration });
                        } else {
                            const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                            directions.forEach(p => {
                                if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) {
                                    events.push({ p, time, dur: fadeDuration });
                                }
                            });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 4. WAVE
        animations[`wave_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 13 : 60;
                    const fadeDuration = dur ? stepDelay * 3 : 300;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - x;
                            const dy = targetY - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 4.1 WAVE_REVERSE
        animations[`wave_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDistance = Math.max(
                        Math.sqrt(x * x + y * y),
                        Math.sqrt(Math.pow(7 - x, 2) + y * y),
                        Math.sqrt(x * x + Math.pow(7 - y, 2)),
                        Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                    );
                    const stepDelay = dur ? dur / (maxDistance + 3) : 60;
                    const fadeDuration = dur ? stepDelay * 3 : 300;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - x;
                            const dy = targetY - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: (maxDistance - distance) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 5. WAVE_CENTER
        animations[`wave_center_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const stepDelay = dur ? dur / 8 : 60;
                    const fadeDuration = dur ? stepDelay * 3 : 300;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 5.1 WAVE_CENTER_REVERSE
        animations[`wave_center_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const stepDelay = dur ? dur / 8 : 60;
                    const fadeDuration = dur ? stepDelay * 3 : 300;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: (5 - distance) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 6. ROTATE: Rotating beam (radar sweep) with directional variants
        const rotationStarts = {
            'top': -Math.PI / 2,
            'right': 0,
            'bottom': Math.PI / 2,
            'left': Math.PI
        };

        Object.entries(rotationStarts).forEach(([dirName, startAngle]) => {
            // Clockwise (CW)
            animations[`rotate_cw_${dirName}_${colorName}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        const centerX = 3.5;
                        const centerY = 3.5;
                        const totalDuration = dur || 600;
                        const delayFactor = dur ? 0.75 : 1;
                        const fadeDuration = dur ? totalDuration * 0.25 : totalDuration / 2;
                        const events = [];

                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                const dx = targetX - centerX;
                                const dy = targetY - centerY;
                                const angle = Math.atan2(dy, dx);
                                let shiftedAngle = angle - startAngle;
                                while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                                const normalizedAngle = shiftedAngle / (2 * Math.PI);
                                const delay = normalizedAngle * (totalDuration * delayFactor);
                                events.push({ p: [targetX, targetY], time: delay, dur: fadeDuration });
                            }
                        }
                        return events;
                    }));
                },
                type: 'fixed'
            };

            // Counter-Clockwise (CCW)
            animations[`rotate_ccw_${dirName}_${colorName}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        const centerX = 3.5;
                        const centerY = 3.5;
                        const totalDuration = dur || 600;
                        const delayFactor = dur ? 0.75 : 1;
                        const fadeDuration = dur ? totalDuration * 0.25 : totalDuration / 2;
                        const events = [];

                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                const dx = targetX - centerX;
                                const dy = targetY - centerY;
                                const angle = Math.atan2(dy, dx);
                                let shiftedAngle = startAngle - angle;
                                while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                                const normalizedAngle = shiftedAngle / (2 * Math.PI);
                                const delay = normalizedAngle * (totalDuration * delayFactor);
                                events.push({ p: [targetX, targetY], time: delay, dur: fadeDuration });
                            }
                        }
                        return events;
                    }));
                },
                type: 'fixed'
            };
        });

        // 7. DIAGONAL: Straight diagonal wave from corners
        const corners = {
            'top_left': (x, y) => x + y,
            'top_right': (x, y) => (7 - x) + y,
            'bottom_left': (x, y) => x + (7 - y),
            'bottom_right': (x, y) => (7 - x) + (7 - y)
        };

        Object.entries(corners).forEach(([cornerName, distFn]) => {
            animations[`diagonal_${cornerName}_${colorName}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        const stepDelay = dur ? dur / 17 : 60;
                        const fadeDuration = dur ? stepDelay * 3 : 300;
                        const events = [];
                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                const distance = distFn(targetX, targetY);
                                events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                            }
                        }
                        return events;
                    }));
                },
                type: 'fixed'
            };
        });

        // 8. RING: Expanding shockwave (only the edge)
        animations[`ring_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 12 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - x;
                            const dy = targetY - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 8b. RING_CENTER: Expanding shockwave from the center
        animations[`ring_center_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const cx = 3.5, cy = 3.5;
                    const stepDelay = dur ? dur / 7 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - cx;
                            const dy = targetY - cy;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`ring_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDistance = Math.max(
                        Math.sqrt(x * x + y * y),
                        Math.sqrt(Math.pow(7 - x, 2) + y * y),
                        Math.sqrt(x * x + Math.pow(7 - y, 2)),
                        Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                    );
                    const stepDelay = dur ? dur / (maxDistance + 2) : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - x;
                            const dy = targetY - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: (maxDistance - distance) * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 9. SCANLINE
        animations[`scan_h_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let ty = 0; ty < 8; ty++) {
                        const delay = Math.abs(ty - y) * stepDelay;
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: delay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scan_v_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        const delay = Math.abs(tx - x) * stepDelay;
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: delay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 10. RAIN
        animations[`rain_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let ty = y; ty < 8; ty++) {
                        events.push({ p: [x, ty], time: (ty - y) * stepDelay, dur: fadeDuration, short: true });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // Matrix Rain is already updated to MatrixRainAnimation class
        animations[`matrix_rain_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration));
            },
            type: 'fixed'
        };

        animations[`rain_up_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 80;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let ty = y; ty >= 0; ty--) {
                        events.push({ p: [x, ty], time: (y - ty) * stepDelay, dur: fadeDuration, short: true });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`rain_left_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 80;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = x; tx >= 0; tx--) {
                        events.push({ p: [tx, y], time: (x - tx) * stepDelay, dur: fadeDuration, short: true });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`rain_right_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 80;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = x; tx < 8; tx++) {
                        events.push({ p: [tx, y], time: (tx - x) * stepDelay, dur: fadeDuration, short: true });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 12. SPARKLE
        animations[`sparkle_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const baseDur = 600;
                    const fadeDuration = dur ? (dur * 0.2) : 140;
                    const events = [];
                    for (let i = 0; i < 20; i++) {
                        const delay = Math.random() * (dur ? dur * 0.8 : 600);
                        const tx = Math.floor(Math.random() * 8);
                        const ty = Math.floor(Math.random() * 8);
                        events.push({ p: [tx, ty], time: delay, dur: fadeDuration, short: true });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 13. BOUNCE
        animations[`bounce_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 18 : 50;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                    directions.forEach(([dx, dy]) => {
                        for (let step = 0; step < 8; step++) {
                            const tx = x + dx * step;
                            const ty = y + dy * step;
                            if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration, short: true });
                            } else {
                                const lastValidStep = step - 1;
                                for (let bStep = 1; bStep <= lastValidStep; bStep++) {
                                    const bx = x + dx * (lastValidStep - bStep);
                                    const by = y + dy * (lastValidStep - bStep);
                                    events.push({ p: [bx, by], time: (step + bStep) * stepDelay, dur: fadeDuration, short: true });
                                }
                                break;
                            }
                        }
                    });
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 14. SNAKE: Spiral pattern covering the grid
        animations[`snake_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 66 : 30;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    let tx = 3, ty = 3;
                    let delay = 0;

                    // Starting point
                    events.push({ p: [tx, ty], time: delay, dur: fadeDuration, short: true });

                    const move = (dx, dy, steps) => {
                        for (let i = 0; i < steps; i++) {
                            tx += dx;
                            ty += dy;
                            if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                delay += stepDelay;
                                events.push({ p: [tx, ty], time: delay, dur: fadeDuration, short: true });
                            }
                        }
                    };

                    for (let s = 1; s < 8; s++) {
                        move(1, 0, s);
                        move(0, 1, s);
                        s++;
                        move(-1, 0, s);
                        move(0, -1, s);
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 16. WARP_SPEED
        animations[`warp_speed_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 6 : 80;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    const centers = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                    centers.forEach((c, i) => {
                        const [dx, dy] = directions[i];
                        for (let step = 0; step < 4; step++) {
                            const tx = c[0] + dx * step;
                            const ty = c[1] + dy * step;
                            events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration, short: true });
                        }
                    });
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 17. SNAKE_COLLISION
        animations[`snake_collision_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 10 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
                    const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];

                    path1.forEach((p, i) => {
                        events.push({ p, time: i * stepDelay, dur: fadeDuration, short: true });
                    });
                    path2.forEach((p, i) => {
                        events.push({ p, time: i * stepDelay, dur: fadeDuration, short: true });
                    });

                    // Explosion
                    const explosionDelay = path1.length * stepDelay;
                    const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    flash.forEach(p => {
                        events.push({ p, time: explosionDelay, dur: fadeDuration, short: true });
                    });

                    return events;
                }));
            },
            type: 'fixed'
        };

        // 18. EQ_SPECTRUM
        animations[`eq_spectrum_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 40;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        const height = Math.floor(Math.random() * 7) + 1;
                        for (let ty = 7; ty >= 8 - height; ty--) {
                            events.push({ p: [tx, ty], time: (7 - ty) * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 19. STROBE_BURST (Optimized State-Based)
        animations[`strobe_burst_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new StrobeBurstAnimation(colorName, duration));
            },
            type: 'fixed'
        };

        // 20. EQ_BOUNCE
        animations[`eq_bounce_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const baseSteps = 16;
                    const speed = dur ? dur / baseSteps : 40;
                    const hold = speed * 2;
                    const events = [];

                    for (let tx = 0; tx < 8; tx++) {
                        const height = Math.floor(Math.random() * 7) + 1;
                        const peakRow = 8 - height;

                        // Rise
                        for (let ty = 7; ty >= peakRow; ty--) {
                            const turnOnTime = (7 - ty) * speed;
                            const turnOffTime = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                            const activeDur = turnOffTime - turnOnTime;

                            // Use fader with this duration and 'instant' mode to maintain the "choppy" feel.
                            events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, mode: 'instant' });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 21. EQ_PEAK_HOLD
        animations[`eq_peak_hold_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const baseSteps = 20;
                    const speed = dur ? dur / baseSteps : 30;
                    const peakHold = dur ? dur * 0.5 : 400;
                    const events = [];

                    for (let tx = 0; tx < 8; tx++) {
                        const height = Math.floor(Math.random() * 7) + 1;
                        const peakRow = 8 - height;

                        // Rise
                        for (let ty = 7; ty >= peakRow; ty--) {
                            const turnOnTime = (7 - ty) * speed;
                            // Calculate when this specific pixel turns off
                            let turnOffTime;
                            if (ty === peakRow) {
                                // Peak
                                turnOffTime = (7 - peakRow) * speed + peakHold;
                            } else {
                                // Body
                                turnOffTime = (7 - peakRow) * speed + (ty - peakRow) * speed; // Fast fall
                            }
                            // If turnOffTime < turnOnTime (fast fall logic might overlap), clamp?
                            // In legacy: Fall loop starts at peakRow+1.
                            // So body pixels turn off.

                            if (ty > peakRow) {
                                // Body pixel
                                turnOffTime = (7 - peakRow) * speed + (ty - peakRow) * speed;
                            }

                            const activeDur = turnOffTime - turnOnTime;
                            if (activeDur > 0) {
                                events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, mode: 'instant' });
                            }
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // Legacy / Default aliases (Left-starting)
        animations[`rotate_cw_${colorName}`] = animations[`rotate_cw_left_${colorName}`];
        animations[`rotate_ccw_${colorName}`] = animations[`rotate_ccw_left_${colorName}`];
    });

    // 8. CROSS_MULTI: Color transitioning cross (Red -> Amber -> Green and vice-versa)
    const multiColorConfigs = [
        {
            name: 'red_to_green',
            sequence: [
                { color: 'red', level: 'full' },
                { color: 'amber', level: 'low' },
                { color: 'green', level: 'low' }
            ]
        },
        {
            name: 'green_to_red',
            sequence: [
                { color: 'green', level: 'full' },
                { color: 'amber', level: 'low' },
                { color: 'red', level: 'low' }
            ]
        }
    ];

    multiColorConfigs.forEach(config => {
        // HELPER: triggerMultiFade
        const triggerMultiFade = (event, _ignoreName) => {
            fader.add(event.p, null, event.dur, 'multi', config);
        };


        // 8. CROSS_MULTI: Color transitioning cross
        animations[`cross_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    // Center
                    events.push({ p: [x, y], time: 0, dur: fadeDuration });
                    // Arms
                    for (let dist = 1; dist < 8; dist++) {
                        const time = dist * stepDelay;
                        const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                        directions.forEach(p => {
                            if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) {
                                events.push({ p, time, dur: fadeDuration });
                            }
                        });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 8.1 CROSS_MULTI_REVERSE
        animations[`cross_multi_reverse_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const maxDist = Math.max(x, 7 - x, y, 7 - y);
                    const stepDelay = dur ? dur / (maxDist + 1) : 70;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let dist = maxDist; dist >= 0; dist--) {
                        const time = (maxDist - dist) * stepDelay;
                        if (dist === 0) {
                            events.push({ p: [x, y], time, dur: fadeDuration });
                        } else {
                            const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                            directions.forEach(p => {
                                if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) {
                                    events.push({ p, time, dur: fadeDuration });
                                }
                            });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 9. EXPAND_MULTI
        animations[`expand_multi_${config.name}`] = animations[`cross_multi_${config.name}`];
        animations[`expand_multi_reverse_${config.name}`] = animations[`cross_multi_reverse_${config.name}`];

        // 10. WAVE_MULTI
        animations[`wave_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 10 : 60;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - x;
                            const dy = targetY - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 10.1 WAVE_MULTI_REVERSE
        animations[`wave_multi_reverse_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const maxDistance = Math.max(
                        Math.sqrt(x * x + y * y),
                        Math.sqrt(Math.pow(7 - x, 2) + y * y),
                        Math.sqrt(x * x + Math.pow(7 - y, 2)),
                        Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                    );
                    const stepDelay = dur ? dur / (maxDistance || 1) : 60;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - x;
                            const dy = targetY - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: (maxDistance - distance) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 11. WAVE_CENTER_MULTI
        animations[`wave_center_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const stepDelay = dur ? dur / 5 : 60;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 11.1 WAVE_CENTER_MULTI_REVERSE
        animations[`wave_center_multi_reverse_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const stepDelay = dur ? dur / 5 : 60;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: (5 - distance) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 11.2 DIAGONAL_MULTI
        const corners = {
            'top_left': (x, y) => x + y,
            'top_right': (x, y) => (7 - x) + y,
            'bottom_left': (x, y) => x + (7 - y),
            'bottom_right': (x, y) => (7 - x) + (7 - y)
        };

        Object.entries(corners).forEach(([cornerName, distFn]) => {
            animations[`diagonal_multi_${cornerName}_${config.name}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                        const stepDelay = dur ? dur / 15 : 60;
                        const fadeDuration = dur ? stepDelay * 4.5 : 450;
                        const events = [];
                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                const distance = distFn(targetX, targetY);
                                events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                            }
                        }
                        return events;
                    }, triggerMultiFade));
                },
                type: 'fixed'
            };
        });

        // 12. ROTATE_MULTI
        const rotationStarts = { 'top': -Math.PI / 2, 'right': 0, 'bottom': Math.PI / 2, 'left': Math.PI };
        Object.entries(rotationStarts).forEach(([dirName, startAngle]) => {
            // CW
            animations[`rotate_cw_${dirName}_multi_${config.name}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                        const totalDuration = dur || 600;
                        const fadeDuration = totalDuration / 2;
                        const events = [];
                        const centerX = 3.5;
                        const centerY = 3.5;

                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                const dx = targetX - centerX;
                                const dy = targetY - centerY;
                                const angle = Math.atan2(dy, dx);
                                let shiftedAngle = angle - startAngle;
                                while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                                const normalizedAngle = shiftedAngle / (2 * Math.PI);
                                events.push({ p: [targetX, targetY], time: normalizedAngle * totalDuration, dur: fadeDuration });
                            }
                        }
                        return events;
                    }, triggerMultiFade));
                },
                type: 'fixed'
            };
            // CCW
            animations[`rotate_ccw_${dirName}_multi_${config.name}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                        const totalDuration = dur || 600;
                        const fadeDuration = totalDuration / 2;
                        const events = [];
                        const centerX = 3.5;
                        const centerY = 3.5;

                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                const dx = targetX - centerX;
                                const dy = targetY - centerY;
                                const angle = Math.atan2(dy, dx);
                                let shiftedAngle = startAngle - angle;
                                while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                                const normalizedAngle = shiftedAngle / (2 * Math.PI);
                                events.push({ p: [targetX, targetY], time: normalizedAngle * totalDuration, dur: fadeDuration });
                            }
                        }
                        return events;
                    }, triggerMultiFade));
                },
                type: 'fixed'
            };
        });

        // 13. RING_MULTI
        animations[`ring_center_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const cx = 3.5, cy = 3.5;
                    const stepDelay = dur ? dur / 6 : 70;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) {
                            const dist = Math.sqrt(Math.pow(tx - cx, 2) + Math.pow(ty - cy, 2));
                            events.push({ p: [tx, ty], time: dist * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 14. SCANLINE_MULTI
        animations[`scan_h_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let ty = 0; ty < 8; ty++) {
                        const delay = Math.abs(ty - y) * stepDelay;
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: delay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`scan_v_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        const delay = Math.abs(tx - x) * stepDelay;
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: delay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 15. RAIN_MULTI: Multi-color falling pixels
        // 15. RAIN_MULTI
        animations[`rain_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 100;
                    const fadeDuration = dur ? stepDelay * 4 : 450;
                    const events = [];
                    for (let ty = y; ty < 8; ty++) {
                        events.push({ p: [x, ty], time: (ty - y) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`rain_multi_up_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 100;
                    const fadeDuration = dur ? stepDelay * 4 : 450;
                    const events = [];
                    for (let ty = y; ty >= 0; ty--) {
                        events.push({ p: [x, ty], time: (y - ty) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`rain_multi_left_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 100;
                    const fadeDuration = dur ? stepDelay * 4 : 450;
                    const events = [];
                    for (let tx = x; tx >= 0; tx--) {
                        events.push({ p: [tx, y], time: (x - tx) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`rain_multi_right_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 100;
                    const fadeDuration = dur ? stepDelay * 4 : 450;
                    const events = [];
                    for (let tx = x; tx < 8; tx++) {
                        events.push({ p: [tx, y], time: (tx - x) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 15b. MATRIX_RAIN_MULTI: Global falling rain on all columns
        // 15b. MATRIX_RAIN_MULTI
        animations[`matrix_rain_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const factor = dur ? dur / 1400 : 1;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        const startDelay = Math.random() * 300 * factor;
                        const speed = (60 + Math.random() * 40) * factor;
                        const fadeDuration = speed * 4;
                        for (let ty = 0; ty < 8; ty++) {
                            const stepDelay = ty * speed;
                            events.push({ p: [tx, ty], time: startDelay + stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_multi_up_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const factor = dur ? dur / 1400 : 1;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        const startDelay = Math.random() * 300 * factor;
                        const speed = (60 + Math.random() * 40) * factor;
                        const fadeDuration = speed * 4;
                        for (let ty = 7; ty >= 0; ty--) {
                            const stepDelay = (7 - ty) * speed;
                            events.push({ p: [tx, ty], time: startDelay + stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 16. SPARKLE_MULTI: Multi-color random pixels across the grid
        // 16. SPARKLE_MULTI
        animations[`sparkle_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const baseDuration = 800;
                    const factor = dur ? dur / baseDuration : 1;
                    const fadeDuration = dur ? 450 * factor : 450;
                    const events = [];
                    for (let i = 0; i < 20; i++) {
                        const delay = Math.random() * 800 * factor;
                        const tx = Math.floor(Math.random() * 8);
                        const ty = Math.floor(Math.random() * 8);
                        events.push({ p: [tx, ty], time: delay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 17. BOUNCE_MULTI: Multi-color border bounce
        // 17. BOUNCE_MULTI
        animations[`bounce_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 16 : 60;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                    directions.forEach(([dx, dy]) => {
                        for (let step = 0; step < 8; step++) {
                            const tx = x + dx * step;
                            const ty = y + dy * step;
                            if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration });
                            } else {
                                const lastValidStep = step - 1;
                                for (let bStep = 1; bStep <= lastValidStep; bStep++) {
                                    const bx = x + dx * (lastValidStep - bStep);
                                    const by = y + dy * (lastValidStep - bStep);
                                    events.push({ p: [bx, by], time: (step + bStep) * stepDelay, dur: fadeDuration });
                                }
                                break;
                            }
                        }
                    });
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 18. SNAKE_MULTI
        animations[`snake_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    let tx = 3, ty = 3;
                    let delay = 0;
                    const stepDelay = dur ? dur / 64 : 40;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    // Center start
                    events.push({ p: [tx, ty], time: delay, dur: fadeDuration });

                    const move = (dx, dy, steps) => {
                        for (let i = 0; i < steps; i++) {
                            tx += dx;
                            ty += dy;
                            if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                delay += stepDelay;
                                events.push({ p: [tx, ty], time: delay, dur: fadeDuration });
                            }
                        }
                    };

                    for (let s = 1; s < 8; s++) {
                        move(1, 0, s);
                        move(0, 1, s);
                        s++;
                        move(-1, 0, s);
                        move(0, -1, s);
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 20. WARP_SPEED_MULTI
        animations[`warp_speed_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const centers = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                    const stepDelay = dur ? dur / 4 : 80;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    centers.forEach((c, i) => {
                        const [dx, dy] = directions[i];
                        for (let step = 0; step < 4; step++) {
                            const tx = c[0] + dx * step;
                            const ty = c[1] + dy * step;
                            events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration });
                        }
                    });
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 21. SNAKE_COLLISION_MULTI
        animations[`snake_collision_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
                    const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];
                    const stepDelay = dur ? dur / 8 : 100;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];

                    path1.forEach((p, i) => {
                        events.push({ p, time: i * stepDelay, dur: fadeDuration });
                    });
                    path2.forEach((p, i) => {
                        events.push({ p, time: i * stepDelay, dur: fadeDuration });
                    });

                    // Collision flash
                    const explosionDelay = path1.length * stepDelay;
                    const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    flash.forEach(p => events.push({ p, time: explosionDelay, dur: fadeDuration }));

                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 22. EQ_SPECTRUM_MULTI
        animations[`eq_spectrum_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 40;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        const height = Math.floor(Math.random() * 7) + 1;
                        for (let ty = 7; ty >= 8 - height; ty--) {
                            events.push({ p: [tx, ty], time: (7 - ty) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        // 23. STROBE_BURST_MULTI
        animations[`strobe_burst_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new StrobeBurstMultiAnimation(config, duration));
            },
            type: 'fixed'
        };



        // 24. EQ_BOUNCE_MULTI
        animations[`eq_bounce_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const baseSteps = 16;
                    const speed = dur ? dur / baseSteps : 40;
                    const hold = speed * 2;
                    const events = [];

                    const getGradientColor = (row) => {
                        if (row >= 6) return 'green';
                        if (row >= 3) return 'amber';
                        return 'red';
                    };

                    for (let tx = 0; tx < 8; tx++) {
                        const height = Math.floor(Math.random() * 7) + 1;
                        const peakRow = 8 - height;

                        // Rise
                        for (let ty = 7; ty >= peakRow; ty--) {
                            const colorName = getGradientColor(ty);
                            const turnOnTime = (7 - ty) * speed;
                            const turnOffTime = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                            const activeDur = turnOffTime - turnOnTime;

                            events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, color: colorName, mode: 'instant' });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 25. EQ_PEAK_HOLD_MULTI
        animations[`eq_peak_hold_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const baseSteps = 20;
                    const speed = dur ? dur / baseSteps : 30;
                    const peakHold = dur ? dur * 0.5 : 400;
                    const events = [];

                    const getGradientColor = (row) => {
                        if (row >= 6) return 'green';
                        if (row >= 3) return 'amber';
                        return 'red';
                    };

                    for (let tx = 0; tx < 8; tx++) {
                        const height = Math.floor(Math.random() * 7) + 1;
                        const peakRow = 8 - height;

                        // Rise
                        for (let ty = 7; ty >= peakRow; ty--) {
                            const colorName = getGradientColor(ty);
                            const turnOnTime = (7 - ty) * speed;
                            const turnOffTime = (7 - peakRow) * speed + (ty - peakRow) * speed; // Fall time
                            const activeDur = (ty === peakRow) ? (speed + peakHold) : (turnOffTime - turnOnTime);

                            events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, color: colorName, mode: 'instant' });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // Default aliases for rotate_multi
        animations[`rotate_cw_multi_${config.name}`] = animations[`rotate_cw_left_multi_${config.name}`];
        animations[`rotate_ccw_multi_${config.name}`] = animations[`rotate_ccw_left_multi_${config.name}`];
    });

    // 26. TETRIS_FALLING
    animations['tetris_falling'] = {
        on: (x, y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const colors = ['red', 'green', 'amber'];
                const colorName = colors[Math.floor(Math.random() * colors.length)];

                const shapes = [
                    [[0, 0], [1, 0], [2, 0], [3, 0]], // I
                    [[0, 0], [1, 0], [0, 1], [1, 1]], // O
                    [[1, 0], [0, 1], [1, 1], [2, 1]], // T
                    [[1, 0], [2, 0], [0, 1], [1, 1]], // S
                    [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
                    [[0, 0], [0, 1], [1, 1], [2, 1]], // J
                    [[2, 0], [0, 1], [1, 1], [2, 1]]  // L
                ];

                let shape = shapes[Math.floor(Math.random() * shapes.length)];
                // Randomize rotation
                const rotations = Math.floor(Math.random() * 4);
                for (let i = 0; i < rotations; i++) {
                    shape = shape.map(([x, y]) => [-y, x]);
                }
                // Normalize
                const minX = Math.min(...shape.map(p => p[0]));
                const minY = Math.min(...shape.map(p => p[1]));
                shape = shape.map(([x, y]) => [x - minX, y - minY]);

                const shapeWidth = Math.max(...shape.map(p => p[0])) + 1;
                let curX = Math.floor(Math.random() * (8 - shapeWidth + 1));
                const speed = dur ? dur / 12 : 150;

                const events = [];

                // We simulate the falling process to generate events
                for (let curY = -2; curY < 10; curY++) {
                    const time = (curY + 2) * speed;

                    // Determine next X (random wiggle)
                    let nextX = curX;
                    if (curY >= 0 && curY < 7 && Math.random() > 0.8) {
                        const move = Math.random() > 0.5 ? 1 : -1;
                        if (curX + move >= 0 && curX + move + shapeWidth <= 8) {
                            nextX += move;
                        }
                    }

                    // Calculate new positions
                    shape.forEach(([dx, dy]) => {
                        const tx = curX + dx;
                        const ty = curY + dy;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            // Draw Current for the duration of one step
                            events.push({
                                p: [tx, ty],
                                time,
                                dur: speed,
                                color: colorName,
                                mode: 'instant'
                            });
                        }
                    });

                    curX = nextX;
                }

                return events;
            }));
        },
        type: 'fixed'
    };

    // 27. FIREWORK
    animations['firework'] = {
        on: (x, y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const colors = ['red', 'green', 'amber'];
                const colorName = colors[Math.floor(Math.random() * colors.length)];

                const startX = Math.floor(Math.random() * 8);
                const explodeY = 1 + Math.floor(Math.random() * 3);

                const totalSteps = 10;
                const stepDelay = dur ? dur / totalSteps : 80;
                const climbSpeed = stepDelay;
                const explosionDuration = stepDelay * 4;
                const events = [];

                // Phase 1: Climb
                for (let curY = 7; curY >= explodeY; curY--) {
                    const time = (7 - curY) * climbSpeed;
                    // Draw Current for climbSpeed duration
                    events.push({ p: [startX, curY], time, dur: climbSpeed, color: colorName, mode: 'instant' });
                }

                // Phase 2: Explode
                const explosionTime = (7 - explodeY) * climbSpeed;

                const particles = [
                    [0, -1], [0, 1], [-1, 0], [1, 0], // Cross
                    [-1, -1], [1, -1], [-1, 1], [1, 1] // Diagonals
                ];

                particles.forEach(([dx, dy]) => {
                    const tx = startX + dx;
                    const ty = explodeY + dy;
                    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                        events.push({ p: [tx, ty], time: explosionTime, dur: explosionDuration, color: colorName, mode: 'instant' });
                    }
                });

                // Secondary Pop
                const secPopTime = explosionTime + 150;
                particles.forEach(([dx, dy]) => {
                    const tx2 = startX + dx * 2;
                    const ty2 = explodeY + dy * 2;
                    if (tx2 >= 0 && tx2 < 8 && ty2 >= 0 && ty2 < 8) {
                        events.push({ p: [tx2, ty2], time: secPopTime, dur: 200, color: colorName, mode: 'instant' });
                    }
                });

                return events;
            }));
        },
        type: 'fixed'
    };

    const getHeartPoints = () => [
        [1, 0], [2, 0], [5, 0], [6, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
        [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
        [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
        [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
        [2, 6], [3, 6], [4, 6], [5, 6],
        [3, 7], [4, 7]
    ];

    // 28. HEART_FILL
    animations['heart_fill'] = {
        on: (x, y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const heartPoints = getHeartPoints();
                const baseDuration = 1350;
                const factor = dur ? dur / baseDuration : 1;
                const holdTime = 1000 * factor;
                const events = [];

                heartPoints.forEach(([tx, ty]) => {
                    const delay = (ty * 40 + (tx * 10)) * factor;
                    events.push({ p: [tx, ty], time: delay, dur: holdTime, color: 'red', mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed'
    };

    // 29. HEART_SIMPLE
    animations['heart_simple'] = {
        on: (x, y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const heartPoints = getHeartPoints();
                const holdTime = dur || 1000;
                const events = [];

                heartPoints.forEach(([tx, ty]) => {
                    events.push({ p: [tx, ty], time: 0, dur: holdTime, color: 'red', mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed'
    };

    // 30. HEART_WAVE
    animations['heart_wave'] = {
        on: (x, y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const heartPoints = getHeartPoints();
                const centerX = 3.5, centerY = 3.5;
                const baseDuration = 1400;
                const factor = dur ? dur / baseDuration : 1;
                const events = [];

                heartPoints.forEach(([tx, ty]) => {
                    const dist = Math.sqrt(Math.pow(tx - centerX, 2) + Math.pow(ty - centerY, 2));
                    const appearDelay = (dist * 80) * factor;
                    const disappearDelay = (1000 + ((5 - dist) * 80)) * factor;

                    events.push({ p: [tx, ty], time: appearDelay, dur: (disappearDelay - appearDelay), color: 'red', mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed'
    };

    // 31. ALPHABET: Displays letters A-Z
    colors.forEach(colorName => {
        Object.entries(alphabetCoords).forEach(([letter, coords]) => {
            animations[`letter_${letter}_${colorName}`] = {
                on: () => {
                    coords.forEach(([tx, ty]) => {
                        fader.add([tx, ty], colorName, 999999, 'instant');
                    });
                },
                off: () => {
                    coords.forEach(([tx, ty]) => {
                        fader.add([tx, ty], 'off', 0, 'instant');
                    });
                },
                type: 'momentary'
            };
        });
    });

    // 32. NUMBERS: Displays numbers 0-9
    colors.forEach(colorName => {
        Object.entries(numberCoords).forEach(([number, coords]) => {
            animations[`number_${number}_${colorName}`] = {
                on: () => {
                    coords.forEach(([tx, ty]) => {
                        fader.add([tx, ty], colorName, 999999, 'instant');
                    });
                },
                off: () => {
                    coords.forEach(([tx, ty]) => {
                        fader.add([tx, ty], 'off', 0, 'instant');
                    });
                },
                type: 'momentary'
            };
        });
    });

    // 33. SYMBOLS: Displays symbols like ? and !
    colors.forEach(colorName => {
        Object.entries(symbolCoords).forEach(([symbol, coords]) => {
            animations[`symbol_${symbol}_${colorName}`] = {
                on: () => {
                    coords.forEach(([tx, ty]) => {
                        fader.add([tx, ty], colorName, 999999, 'instant');
                    });
                },
                off: () => {
                    coords.forEach(([tx, ty]) => {
                        fader.add([tx, ty], 'off', 0, 'instant');
                    });
                },
                type: 'momentary'
            };
        });
    });
};

// Initialize the library
createAnimationLibrary();

/**
 * Triggers an animation by name at specific coordinates.
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 */
export function triggerAnimation(name, x, y, duration) {
    const anim = animations[name];
    if (anim && anim.on) {
        // Convert duration to milliseconds if provided, otherwise undefined
        const durationMs = duration ? duration * 1000 : undefined;
        anim.on(x, y, durationMs);
        // Ensure changes are sent immediately for non-loop animations
        flushPhysicalColors();
    }
}

/**
 * Releases an animation (stops it if it's momentary).
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 */
export function releaseAnimation(name, x, y) {
    const anim = animations[name];
    if (anim && anim.type === 'momentary' && anim.off) {
        anim.off(x, y);
        // Ensure changes are sent immediately for non-loop animations
        flushPhysicalColors();
    }
}
