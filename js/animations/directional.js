/**
 * DIRECTIONAL ANIMATIONS (js/animations/directional.js)
 * 
 * Provides directional sweeps: rain, arrows, bounces, and scanlines.
 */

import { activeAnimations } from '../animationEngine.js';
import { PrecomputedAnimation } from '../animationClasses.js';

// Rain: single-line sweeps in 4 cardinal directions from the pressed pad
const RAIN_VECTORS = {
    rain_down:  [0, 1],
    rain_up:    [0, -1],
    rain_left:  [-1, 0],
    rain_right: [1, 0]
};

export function buildRainEvents(x, y, dx, dy, stepDelay, fadeDuration) {
    const events = [];
    for (let step = 0; step < 8; step++) {
        const tx = x + dx * step;
        const ty = y + dy * step;
        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
            events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration });
        } else {
            break;
        }
    }
    return events;
}

// Arrows: directional wedges along cardinal and diagonal axes
const ARROW_CONFIGS = {
    arrow_up: { dx: 0, dy: -1 },
    arrow_down: { dx: 0, dy: 1 },
    arrow_left: { dx: -1, dy: 0 },
    arrow_right: { dx: 1, dy: 0 },
    arrow_up_left: { dx: -1, dy: -1 },
    arrow_up_right: { dx: 1, dy: -1 },
    arrow_down_left: { dx: -1, dy: 1 },
    arrow_down_right: { dx: 1, dy: 1 }
};

export function buildArrowEvents(config, dur) {
    const stepDelay = dur ? dur / 13 : 55;
    const fadeDuration = dur ? stepDelay * 4.5 : 400;
    const events = [];

    for (let step = 0; step < 15; step++) {
        const time = step * stepDelay;
        let pointsFound = false;

        for (let ty = 0; ty < 8; ty++) {
            for (let tx = 0; tx < 8; tx++) {
                let d;
                if (config.dx === 0) {
                    const dist_y = config.dy > 0 ? ty : 7 - ty;
                    d = dist_y + Math.abs(tx - 3.5) - 0.5;
                } else if (config.dy === 0) {
                    const dist_x = config.dx > 0 ? tx : 7 - tx;
                    d = dist_x + Math.abs(ty - 3.5) - 0.5;
                } else {
                    const dist_x = config.dx > 0 ? tx : 7 - tx;
                    const dist_y = config.dy > 0 ? ty : 7 - ty;
                    d = (dist_x + dist_y) + Math.abs(dist_x - dist_y) * 0.5;
                }

                if (Math.abs(d - step) < 0.6) {
                    events.push({ p: [tx, ty], time, dur: fadeDuration });
                    pointsFound = true;
                }
            }
        }
        if (step > 12 && !pointsFound) break;
    }
    return events;
}

export function buildBounceEvents(x, y, dur) {
    const stepDelay = dur ? dur / 18 : 50;
    const fadeDuration = dur ? stepDelay * 2 : 140;
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
}

// Scanlines: sweeps across columns or rows (standard, reverse, bounce, bounce_reverse)
const SCANLINE_PATTERNS = {
    '':                { steps: [0, 1, 2, 3, 4, 5, 6, 7], divisor: 8, defaultDelay: 100 },
    '_reverse':        { steps: [7, 6, 5, 4, 3, 2, 1, 0], divisor: 8, defaultDelay: 100 },
    '_bounce':         { steps: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], divisor: 16, defaultDelay: 50 },
    '_bounce_reverse': { steps: [7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7], divisor: 16, defaultDelay: 50 }
};

export function buildScanlineEvents(axis, patternKey, dur) {
    const pattern = SCANLINE_PATTERNS[patternKey];
    const stepDelay = dur ? dur / pattern.divisor : pattern.defaultDelay;
    const fadeDuration = dur ? stepDelay * 2 : 140;
    const events = [];

    pattern.steps.forEach((coord, stepIdx) => {
        const time = stepIdx * stepDelay;
        for (let i = 0; i < 8; i++) {
            const p = axis === 'v' ? [coord, i] : [i, coord];
            events.push({ p, time, dur: fadeDuration });
        }
    });
    return events;
}

export function register(animations, colors) {
    colors.forEach(colorName => {
        // Rain animations (down, up, left, right)
        Object.entries(RAIN_VECTORS).forEach(([name, [dx, dy]]) => {
            animations[`${name}_${colorName}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        const stepDelay = dur ? dur / 9 : 80;
                        const fadeDuration = dur ? stepDelay * 2 : 140;
                        return buildRainEvents(x, y, dx, dy, stepDelay, fadeDuration);
                    }));
                },
                type: 'fixed'
            };
        });

        // Arrow animations (8 directions)
        Object.entries(ARROW_CONFIGS).forEach(([arrowName, config]) => {
            animations[`${arrowName}_${colorName}`] = {
                on: (_x, _y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        return buildArrowEvents(config, dur);
                    }));
                },
                type: 'fixed'
            };
        });

        // Bounce animation
        animations[`bounce_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    return buildBounceEvents(x, y, dur);
                }));
            },
            type: 'fixed'
        };

        // Scanlines: v, v_reverse, v_bounce, v_bounce_reverse, h, h_reverse, h_bounce, h_bounce_reverse
        ['v', 'h'].forEach(axis => {
            Object.keys(SCANLINE_PATTERNS).forEach(patternKey => {
                animations[`scanline_${axis}${patternKey}_${colorName}`] = {
                    on: (_x, _y, duration) => {
                        activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                            return buildScanlineEvents(axis, patternKey, dur);
                        }));
                    },
                    type: 'fixed'
                };
            });
        });
    });
}
