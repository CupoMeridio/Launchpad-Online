/**
 * GEOMETRIC ANIMATIONS (js/animations/geometric.js)
 * 
 * Provides geometric patterns: explosions, crosses, waves, rotations, spirals,
 * and momentary shape holds.
 */

import { fader, activeAnimations } from '../animationEngine.js';
import {
    PrecomputedAnimation,
    maxCornerDistance,
    buildCrossEvents,
    buildReverseCrossEvents,
    buildWaveEvents
} from '../animationClasses.js';

export function buildSquareExpansionEvents(x, y, stepDelay, fadeDuration, reverse = false) {
    const events = [];
    for (let step = 0; step < 8; step++) {
        const dist = reverse ? 7 - step : step;
        const time = step * stepDelay;
        for (let dx = -dist; dx <= dist; dx++) {
            for (let dy = -dist; dy <= dist; dy++) {
                if (Math.abs(dx) === dist || Math.abs(dy) === dist) {
                    const tx = x + dx, ty = y + dy;
                    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                        events.push({ p: [tx, ty], time, dur: fadeDuration });
                    }
                }
            }
        }
    }
    return events;
}

const ROTATE_DIRECTIONS = {
    'cw_right': (tx, ty, x, y) => Math.atan2(ty - y, tx - x),
    'ccw_right': (tx, ty, x, y) => -Math.atan2(ty - y, tx - x),
    'cw_bottom': (tx, ty, x, y) => Math.atan2(ty - y, tx - x) - Math.PI / 2,
    'ccw_bottom': (tx, ty, x, y) => -(Math.atan2(ty - y, tx - x) - Math.PI / 2),
    'cw_left': (tx, ty, x, y) => Math.atan2(ty - y, tx - x) - Math.PI,
    'ccw_left': (tx, ty, x, y) => -(Math.atan2(ty - y, tx - x) - Math.PI),
    'cw_top': (tx, ty, x, y) => Math.atan2(ty - y, tx - x) - 3 * Math.PI / 2,
    'ccw_top': (tx, ty, x, y) => -(Math.atan2(ty - y, tx - x) - 3 * Math.PI / 2)
};

export function buildRotateEvents(angleFn, dur) {
    const centerX = 3.5;
    const centerY = 3.5;
    const stepDelay = dur ? dur / 12 : 60;
    const fadeDuration = dur ? stepDelay * 2 : 140;
    const events = [];
    for (let targetY = 0; targetY < 8; targetY++) {
        for (let targetX = 0; targetX < 8; targetX++) {
            let angle = angleFn(targetX, targetY, centerX, centerY);
            if (angle < 0) angle += 2 * Math.PI;
            events.push({ p: [targetX, targetY], time: angle * (6 * stepDelay / Math.PI), dur: fadeDuration });
        }
    }
    return events;
}

export function buildSpiralEvents(dur) {
    const stepDelay = dur ? dur / 64 : 20;
    const fadeDuration = dur ? stepDelay * 4 : 140;
    const events = [];
    let left = 0, top = 0, right = 7, bottom = 7;
    let time = 0;
    while (left <= right && top <= bottom) {
        for (let i = left; i <= right; i++) events.push({ p: [i, top], time: time++ * stepDelay, dur: fadeDuration });
        top++;
        for (let i = top; i <= bottom; i++) events.push({ p: [right, i], time: time++ * stepDelay, dur: fadeDuration });
        right--;
        if (top <= bottom) {
            for (let i = right; i >= left; i--) events.push({ p: [i, bottom], time: time++ * stepDelay, dur: fadeDuration });
            bottom--;
        }
        if (left <= right) {
            for (let i = bottom; i >= top; i--) events.push({ p: [left, i], time: time++ * stepDelay, dur: fadeDuration });
            left++;
        }
    }
    return events;
}

const GEOMETRIC_HOLD_GENERATORS = {
    cross_hold: (x, y) => {
        const points = [[x, y]];
        for (let dist = 1; dist < 8; dist++) {
            for (const [px, py] of [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]]) {
                if (px >= 0 && px < 8 && py >= 0 && py < 8) points.push([px, py]);
            }
        }
        return points;
    },
    x_hold: (x, y) => {
        const points = [];
        for (let i = -7; i <= 7; i++) {
            for (const [px, py] of [[x + i, y + i], [x + i, y - i]]) {
                if (px >= 0 && px < 8 && py >= 0 && py < 8) points.push([px, py]);
            }
        }
        return points;
    },
    square_hold: (x, y) => {
        const points = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const tx = x + dx, ty = y + dy;
                if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) points.push([tx, ty]);
            }
        }
        return points;
    },
    row_hold: (_x, y) => {
        const points = [];
        for (let tx = 0; tx < 8; tx++) points.push([tx, y]);
        return points;
    },
    col_hold: (x, _y) => {
        const points = [];
        for (let ty = 0; ty < 8; ty++) points.push([x, ty]);
        return points;
    }
};

function createMomentaryHold(colorName, getPoints) {
    return {
        on: (x, y) => {
            const points = getPoints(x, y);
            for (let i = 0; i < points.length; i++) {
                fader.add(points[i], colorName, 999999, 'instant');
            }
        },
        off: (x, y) => {
            const points = getPoints(x, y);
            for (let i = 0; i < points.length; i++) {
                fader.add(points[i], 'off', 0, 'instant');
            }
        },
        type: 'momentary'
    };
}

export function register(animations, colors) {
    colors.forEach(colorName => {
        // EXPLODE: Outward square expansion
        animations[`explode_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildSquareExpansionEvents(x, y, stepDelay, fadeDuration, false);
                }));
            },
            type: 'fixed'
        };

        // IMPLODE: Inward square contraction
        animations[`implode_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildSquareExpansionEvents(x, y, stepDelay, fadeDuration, true);
                }));
            },
            type: 'fixed'
        };

        // CROSS: Expanding cross
        animations[`cross_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildCrossEvents(x, y, stepDelay, fadeDuration);
                }));
            },
            type: 'fixed'
        };

        // CROSS_REVERSE: Contracting cross
        animations[`cross_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDist = Math.max(x, 7 - x, y, 7 - y);
                    const stepDelay = dur ? dur / (maxDist + 1) : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildReverseCrossEvents(x, y, stepDelay, fadeDuration);
                }));
            },
            type: 'fixed'
        };

        // Momentary shape holds: cross_hold, x_hold, square_hold, row_hold, col_hold
        Object.entries(GEOMETRIC_HOLD_GENERATORS).forEach(([name, getPoints]) => {
            animations[`${name}_${colorName}`] = createMomentaryHold(colorName, getPoints);
        });

        // WAVE: Expanding circle/diamond
        animations[`wave_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 10 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildWaveEvents(x, y, stepDelay, fadeDuration);
                }));
            },
            type: 'fixed'
        };

        // WAVE_REVERSE
        animations[`wave_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDistance = maxCornerDistance(x, y);
                    const stepDelay = dur ? dur / (maxDistance || 1) : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildWaveEvents(x, y, stepDelay, fadeDuration, true, maxDistance);
                }));
            },
            type: 'fixed'
        };

        // WAVE_CENTER
        animations[`wave_center_${colorName}`] = {
            on: (_x, _y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 5 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildWaveEvents(3.5, 3.5, stepDelay, fadeDuration);
                }));
            },
            type: 'fixed'
        };

        // WAVE_CENTER_REVERSE
        animations[`wave_center_reverse_${colorName}`] = {
            on: (_x, _y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 5 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    return buildWaveEvents(3.5, 3.5, stepDelay, fadeDuration, true, 5);
                }));
            },
            type: 'fixed'
        };

        // ROTATE (8 directions)
        Object.entries(ROTATE_DIRECTIONS).forEach(([dirName, angleFn]) => {
            animations[`rotate_${dirName}_${colorName}`] = {
                on: (_x, _y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        return buildRotateEvents(angleFn, dur);
                    }));
                },
                type: 'fixed'
            };
        });

        // SPIRAL
        animations[`spiral_${colorName}`] = {
            on: (_x, _y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    return buildSpiralEvents(dur);
                }));
            },
            type: 'fixed'
        };

        // Aliases
        animations[`rotate_cw_${colorName}`] = animations[`rotate_cw_left_${colorName}`];
        animations[`rotate_ccw_${colorName}`] = animations[`rotate_ccw_left_${colorName}`];
    });
}
