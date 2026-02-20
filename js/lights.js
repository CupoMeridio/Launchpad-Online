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
let lastTickTime = 0;

/**
 * Main animation loop.
 */
function animationLoop(now) {
    const deltaTime = now - lastTickTime;
    lastTickTime = now;

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

// Start the loop
lastTickTime = performance.now();
animationLoop(lastTickTime);

// Initialize the library
createAnimationLibrary();

/**
 * Triggers an animation by name at specific coordinates.
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 * @param {number} duration - Total duration in seconds.
 */
export function triggerAnimation(name, x, y, duration) {
    // Check for dynamic scroll animations (e.g., scroll_HELLO_green or scroll_up_HELLO_green)
    if (name.startsWith('scroll_')) {
        const parts = name.split('_');
        let text, colorName, direction = 'left';

        if (parts.length >= 4) {
            // Check if parts[1] is a valid direction
            let possibleDir = parts[1].toLowerCase();
            if (['left', 'right', 'up', 'down', 'top', 'bottom'].includes(possibleDir)) {
                // Map aliases
                if (possibleDir === 'top') possibleDir = 'down'; // scroll FROM top means moving DOWN
                if (possibleDir === 'bottom') possibleDir = 'up'; // scroll FROM bottom means moving UP
                
                direction = possibleDir;
                text = parts[2];
                colorName = parts[3];
            } else {
                text = parts[1];
                colorName = parts[2];
            }
        } else if (parts.length >= 3) {
            text = parts[1];
            colorName = parts[2];
        }

        if (text && colorName) {
            const durationMs = duration ? duration * 1000 : 3000;
            activeAnimations.add(new ScrollingTextAnimation(text, colorName, durationMs, direction));
            flushPhysicalColors();
            return;
        }
    }

    // Check for dynamic text animations (e.g., text_ANNA_red)
    if (name.startsWith('text_')) {
        const parts = name.split('_');
        if (parts.length >= 3) {
            const text = parts[1];
            const colorName = parts[2];
            const durationMs = duration ? duration * 1000 : 1000;
            activeAnimations.add(new TextAnimation(text, colorName, durationMs));
            flushPhysicalColors();
            return;
        }
    }

    const anim = animations[name];
    if (anim && anim.on) {
        const durationMs = duration ? duration * 1000 : undefined;
        anim.on(x, y, durationMs);
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
