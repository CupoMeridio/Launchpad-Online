/**
 * LIGHTS MODULE (lights.js)
 * 
 * Orchestrator for light animations. This module provides the public API
 * to trigger and release animations, and runs the main animation loop.
 */

import { 
    scheduler, 
    fader, 
    activeAnimations, 
    flushPhysicalColors 
} from './animationEngine.js';

import { 
    animations, 
    createAnimationLibrary 
} from './animationLibrary.js';

import { TextAnimation, ScrollingTextAnimation } from './animationClasses.js';

// Re-export for external modules if needed
export { animations };

let animationFrameId = null;
let isLoopRunning = false;

/**
 * Main animation loop.
 */
function animationLoop(now) {
    // 1. Update Managers
    scheduler.update(now);
    fader.update(now);

    // 2. Update Active Animations (State-based)
    if (activeAnimations.size > 0) {
        for (const anim of activeAnimations) {
            const isFinished = anim.update(now);
            if (isFinished) {
                activeAnimations.delete(anim);
            }
        }
    }

    // 3. Sync physical device (Batched update)
    flushPhysicalColors();

    animationFrameId = requestAnimationFrame(animationLoop);
}

/**
 * Stops the animation loop and cancels pending requestAnimationFrame.
 * Call this to cleanup and prevent memory leaks when the app is being destroyed
 * or when you need to pause animations temporarily.
 */
export function stopAnimationLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isLoopRunning = false;
    }
}

/**
 * Starts the animation loop if it's not already running.
 * Use this to resume animations after calling stopAnimationLoop().
 */
export function startAnimationLoop() {
    if (!isLoopRunning) {
        isLoopRunning = true;
        animationLoop(performance.now());
    }
}

// Start the loop
isLoopRunning = true;
animationLoop(performance.now());

// Initialize the library
createAnimationLibrary();

const SCROLL_DIRECTIONS = ['left', 'right', 'up', 'down', 'top', 'bottom'];
// "scroll from top" moves the text down; "scroll from bottom" moves it up.
const SCROLL_DIRECTION_ALIASES = { top: 'down', bottom: 'up' };

/**
 * Parses a dynamic text light name:
 * - `scroll_<TEXT>_<color>` or `scroll_<direction>_<TEXT>_<color>` (direction defaults to left);
 * - `text_<TEXT>_<color>`.
 * @param {string} name
 * @returns {{kind: 'scroll'|'text', text: string, color: string, direction?: string}|null}
 *   Null when the name is not a (complete) dynamic light.
 */
export function parseDynamicLight(name) {
    const parts = name.split('_');
    if (parts[0] === 'scroll' && parts.length >= 3) {
        const possibleDirection = parts[1].toLowerCase();
        const hasDirection = parts.length >= 4 && SCROLL_DIRECTIONS.includes(possibleDirection);
        const [text, color] = hasDirection ? [parts[2], parts[3]] : [parts[1], parts[2]];
        if (!text || !color) return null;
        const direction = hasDirection ? (SCROLL_DIRECTION_ALIASES[possibleDirection] || possibleDirection) : 'left';
        return { kind: 'scroll', text, color, direction };
    }
    if (parts[0] === 'text' && parts.length >= 3) {
        return { kind: 'text', text: parts[1], color: parts[2] };
    }
    return null;
}

/**
 * Triggers an animation by name.
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 * @param {number} duration - Total duration in seconds.
 */
export function triggerAnimation(name, x, y, duration) {
    const dynamic = parseDynamicLight(name);
    if (dynamic?.kind === 'scroll') {
        const durationMs = duration ? duration * 1000 : 3000;
        activeAnimations.add(new ScrollingTextAnimation(dynamic.text, dynamic.color, durationMs, dynamic.direction));
        flushPhysicalColors();
        return;
    }
    if (dynamic?.kind === 'text') {
        const durationMs = duration ? duration * 1000 : 1000;
        activeAnimations.add(new TextAnimation(dynamic.text, dynamic.color, durationMs));
        flushPhysicalColors();
        return;
    }

    const anim = animations[name];
    if (anim && anim.on) {
        anim.on(x, y, duration ? duration * 1000 : undefined);
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
        flushPhysicalColors();
    }
}
