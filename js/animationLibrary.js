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
import { ANIMATION_COLORS } from './constants.js';

/**
 * Registry of available animations.
 */
export const animations = {};

/**
 * Populates the animations registry.
 */
export function createAnimationLibrary() {
    const colors = ANIMATION_COLORS;

    const modules = [
        { category: 'basic', mod: basic },
        { category: 'geometric', mod: geometric },
        { category: 'directional', mod: directional },
        { category: 'special', mod: special },
        { category: 'multicolor', mod: multi },
        { category: 'characters', mod: characters }
    ];

    for (const { category, mod } of modules) {
        const beforeKeys = Object.keys(animations);
        mod.register(animations, colors);
        const afterKeys = Object.keys(animations);
        for (let i = beforeKeys.length; i < afterKeys.length; i++) {
            const key = afterKeys[i];
            const rawAnim = animations[key];

            // Check for multicolor sequence (_red_to_green or _green_to_red)
            const seqMatch = key.match(/^(.*)_(red_to_green|green_to_red)$/);
            let sequence = null;
            let color = null;
            let baseName = key;

            if (seqMatch) {
                sequence = seqMatch[2];
                baseName = seqMatch[1];
            } else {
                color = colors.find(c => key.endsWith(`_${c}`)) || null;
                baseName = color ? key.slice(0, -(color.length + 1)) : key;
            }

            animations[key] = {
                ...rawAnim,
                category,
                color,
                sequence,
                baseName,
                supportsDuration: rawAnim.type === 'fixed'
            };
        }
    }
}
