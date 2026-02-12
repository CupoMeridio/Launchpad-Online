/**
 * ANIMATION LIBRARY (animationLibrary.js)
 * 
 * Contains the registry of all available animations and the logic to populate it.
 * This file is now modularized into categories found in js/animations/.
 */

import * as basic from './animations/basic.js';
import * as geometric from './animations/geometric.js';
import * as directional from './animations/directional.js';
import * as special from './animations/special.js';
import * as multi from './animations/multi.js';
import * as characters from './animations/characters.js';

/**
 * Registry of available animations.
 */
export const animations = {};

/**
 * Populates the animations registry.
 */
export function createAnimationLibrary() {
    const colors = ['red', 'green', 'amber', 'yellow', 'orange', 'lime'];

    // Register animations from modules
    basic.register(animations, colors);
    geometric.register(animations, colors);
    directional.register(animations, colors);
    special.register(animations, colors);
    multi.register(animations, colors);
    characters.register(animations, colors);
}
