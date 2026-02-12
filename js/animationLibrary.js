/**
 * ANIMATION LIBRARY (animationLibrary.js)
 * 
 * Contains the registry of all available animations and the logic to populate it.
 */

import { fader, getLpColor, activeAnimations } from './animationEngine.js';
import { 
    PrecomputedAnimation, 
    MatrixRainAnimation, 
    StrobeBurstAnimation, 
    StrobeBurstMultiAnimation 
} from './animationClasses.js';
import { alphabetCoords, numberCoords, symbolCoords } from './animationData.js';

/**
 * Registry of available animations.
 */
export const animations = {};

/**
 * Populates the animations registry.
 */
export function createAnimationLibrary() {
    const colors = ['red', 'green', 'amber', 'yellow', 'orange', 'lime'];

    colors.forEach(colorName => {
        // 1. BASIC FADE
        animations[`fade_${colorName}`] = {
            on: (x, y, duration) => fader.add([x, y], colorName, duration),
            type: 'fixed'
        };

        // 2. SHORT FADE
        animations[`short_fade_${colorName}`] = {
            on: (x, y, duration) => fader.add([x, y], colorName, duration, 'short'),
            type: 'fixed'
        };

        // 3. MATRIX RAIN (Optimized State-Based)
        animations[`matrix_rain_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration));
            },
            type: 'fixed'
        };

        // 4. EXPLODE: Outward square expansion
        animations[`explode_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let dist = 0; dist < 8; dist++) {
                        const time = dist * stepDelay;
                        for (let dx = -dist; dx <= dist; dx++) {
                            for (let dy = -dist; dy <= dist; dy++) {
                                if (Math.abs(dx) === dist || Math.abs(dy) === dist) {
                                    const tx = x + dx, ty = y + dy;
                                    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                        events.push({ p: [tx, ty], time, dur: fadeDuration, short: true });
                                    }
                                }
                            }
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 5. IMPLODE: Inward square contraction
        animations[`implode_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let dist = 7; dist >= 0; dist--) {
                        const time = (7 - dist) * stepDelay;
                        for (let dx = -dist; dx <= dist; dx++) {
                            for (let dy = -dist; dy <= dist; dy++) {
                                if (Math.abs(dx) === dist || Math.abs(dy) === dist) {
                                    const tx = x + dx, ty = y + dy;
                                    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                        events.push({ p: [tx, ty], time, dur: fadeDuration, short: true });
                                    }
                                }
                            }
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 6. CROSS: Expanding cross (up, down, left, right)
        animations[`cross_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    events.push({ p: [x, y], time: 0, dur: fadeDuration, short: true });
                    for (let dist = 1; dist < 8; dist++) {
                        const time = dist * stepDelay;
                        const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                        directions.forEach(p => {
                            if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) {
                                events.push({ p, time, dur: fadeDuration, short: true });
                            }
                        });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 7. CROSS_REVERSE: Contracting cross
        animations[`cross_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDist = Math.max(x, 7 - x, y, 7 - y);
                    const stepDelay = dur ? dur / (maxDist + 1) : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let dist = maxDist; dist >= 0; dist--) {
                        const time = (maxDist - dist) * stepDelay;
                        if (dist === 0) {
                            events.push({ p: [x, y], time, dur: fadeDuration, short: true });
                        } else {
                            const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                            directions.forEach(p => {
                                if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) {
                                    events.push({ p, time, dur: fadeDuration, short: true });
                                }
                            });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 8. WAVE: Expanding circle/diamond from trigger point
        animations[`wave_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 10 : 60;
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

        // 8.1 WAVE_REVERSE: Contracting circle to trigger point
        animations[`wave_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const maxDistance = Math.max(
                        Math.sqrt(x * x + y * y),
                        Math.sqrt(Math.pow(7 - x, 2) + y * y),
                        Math.sqrt(x * x + Math.pow(7 - y, 2)),
                        Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                    );
                    const stepDelay = dur ? dur / (maxDistance || 1) : 60;
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

        // 9. WAVE_CENTER: Expanding circle from the center
        animations[`wave_center_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const stepDelay = dur ? dur / 5 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 9.1 WAVE_CENTER_REVERSE: Contracting circle to center
        animations[`wave_center_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const stepDelay = dur ? dur / 5 : 60;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            events.push({ p: [targetX, targetY], time: (5 - distance) * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 10. ROTATE: Sweep around the trigger point
        const rotateDirections = {
            'cw_right': (tx, ty, x, y) => Math.atan2(ty - y, tx - x),
            'ccw_right': (tx, ty, x, y) => -Math.atan2(ty - y, tx - x),
            'cw_bottom': (tx, ty, x, y) => Math.atan2(ty - y, tx - x) - Math.PI / 2,
            'ccw_bottom': (tx, ty, x, y) => -(Math.atan2(ty - y, tx - x) - Math.PI / 2),
            'cw_left': (tx, ty, x, y) => Math.atan2(ty - y, tx - x) - Math.PI,
            'ccw_left': (tx, ty, x, y) => -(Math.atan2(ty - y, tx - x) - Math.PI),
            'cw_top': (tx, ty, x, y) => Math.atan2(ty - y, tx - x) - 3 * Math.PI / 2,
            'ccw_top': (tx, ty, x, y) => -(Math.atan2(ty - y, tx - x) - 3 * Math.PI / 2)
        };

        Object.entries(rotateDirections).forEach(([dirName, angleFn]) => {
            animations[`rotate_${dirName}_${colorName}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        const stepDelay = dur ? dur / 12 : 60;
                        const fadeDuration = dur ? stepDelay * 2 : 140;
                        const events = [];
                        for (let targetY = 0; targetY < 8; targetY++) {
                            for (let targetX = 0; targetX < 8; targetX++) {
                                if (targetX === x && targetY === y) continue;
                                let angle = angleFn(targetX, targetY, x, y);
                                if (angle < 0) angle += 2 * Math.PI;
                                events.push({ p: [targetX, targetY], time: angle * (6 * stepDelay / Math.PI), dur: fadeDuration, short: true });
                            }
                        }
                        return events;
                    }));
                },
                type: 'fixed'
            };
        });

        // 11. RAIN_UP/DOWN/LEFT/RIGHT: Single row/column sweeps
        animations[`rain_down_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 80;
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

        // 11.1 ARROW_UP/DOWN/LEFT/RIGHT/DIAGONALS: Arrow sweeps covering the whole grid
        const arrowConfigs = {
            'arrow_up': { dx: 0, dy: -1 },
            'arrow_down': { dx: 0, dy: 1 },
            'arrow_left': { dx: -1, dy: 0 },
            'arrow_right': { dx: 1, dy: 0 },
            'arrow_up_left': { dx: -1, dy: -1 },
            'arrow_up_right': { dx: 1, dy: -1 },
            'arrow_down_left': { dx: -1, dy: 1 },
            'arrow_down_right': { dx: 1, dy: 1 }
        };

        Object.entries(arrowConfigs).forEach(([arrowName, config]) => {
            animations[`${arrowName}_${colorName}`] = {
                on: (x, y, duration) => {
                     activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                         const stepDelay = dur ? dur / 12 : 60;
                         const fadeDuration = dur ? stepDelay * 5 : 450;
                          const events = [];
                        
                         // We calculate the "wave front" for each arrow.
                         // For a chevron shape, the tip of the arrow is ahead of the sides.
                         
                         for (let step = 0; step < 15; step++) {
                             const time = step * stepDelay;
                             let pointsFound = false;
 
                             for (let ty = 0; ty < 8; ty++) {
                                 for (let tx = 0; tx < 8; tx++) {
                                     let d;
                                     if (config.dx === 0) {
                                         // Vertical arrow (UP/DOWN)
                                         const dist_y = config.dy > 0 ? ty : 7 - ty;
                                         // Add horizontal offset to create V-shape
                                         d = dist_y + Math.abs(tx - 3.5) - 0.5;
                                     } else if (config.dy === 0) {
                                         // Horizontal arrow (LEFT/RIGHT)
                                         const dist_x = config.dx > 0 ? tx : 7 - tx;
                                         // Add vertical offset to create V-shape
                                         d = dist_x + Math.abs(ty - 3.5) - 0.5;
                                     } else {
                                         // Diagonal arrow
                                         const dist_x = config.dx > 0 ? tx : 7 - tx;
                                         const dist_y = config.dy > 0 ? ty : 7 - ty;
                                         // V-shape for diagonal: tip is ahead, sides are delayed
                                         d = (dist_x + dist_y) + Math.abs(dist_x - dist_y) * 0.5;
                                     }
 
                                     if (Math.abs(d - step) < 0.6) {
                                         events.push({ p: [tx, ty], time, dur: fadeDuration, short: false });
                                         pointsFound = true;
                                     }
                                 }
                             }
                             if (step > 12 && !pointsFound) break;
                         }
                         return events;
                    }));
                },
                type: 'fixed'
            };
        });

        // 12. SPARKLE
        animations[`sparkle_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
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
                            let turnOffTime;
                            if (ty === peakRow) {
                                turnOffTime = (7 - peakRow) * speed + peakHold;
                            } else {
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

    // 8. CROSS_MULTI: Color transitioning cross
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
        const triggerMultiFade = (event, _ignoreName) => {
            fader.add(event.p, null, event.dur, 'multi', config);
        };

        animations[`cross_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    events.push({ p: [x, y], time: 0, dur: fadeDuration });
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

        animations[`expand_multi_${config.name}`] = animations[`cross_multi_${config.name}`];
        animations[`expand_multi_reverse_${config.name}`] = animations[`cross_multi_reverse_${config.name}`];

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
                        const stepDelay = dur ? dur / 10 : 70;
                        const fadeDuration = dur ? stepDelay * 4.5 : 450;
                        const events = [];
                        for (let ty = 0; ty < 8; ty++) {
                            for (let tx = 0; tx < 8; tx++) {
                                events.push({ p: [tx, ty], time: distFn(tx, ty) * stepDelay, dur: fadeDuration });
                            }
                        }
                        return events;
                    }, triggerMultiFade));
                },
                type: 'fixed'
            };
        });
    });

    // 22. STROBE_MULTI
    multiColorConfigs.forEach(config => {
        animations[`strobe_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new StrobeBurstMultiAnimation(config, duration));
            },
            type: 'fixed'
        };
    });

    // 23. SCANLINE
    colors.forEach(colorName => {
        animations[`scanline_v_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: tx * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_h_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: ty * stepDelay, dur: fadeDuration, short: true });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };
    });

    // 24. SPIRAL
    colors.forEach(colorName => {
        animations[`spiral_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 64 : 20;
                    const fadeDuration = dur ? stepDelay * 4 : 140;
                    const events = [];
                    let left = 0, top = 0, right = 7, bottom = 7;
                    let time = 0;
                    while (left <= right && top <= bottom) {
                        for (let i = left; i <= right; i++) events.push({ p: [i, top], time: time++ * stepDelay, dur: fadeDuration, short: true });
                        top++;
                        for (let i = top; i <= bottom; i++) events.push({ p: [right, i], time: time++ * stepDelay, dur: fadeDuration, short: true });
                        right--;
                        if (top <= bottom) {
                            for (let i = right; i >= left; i--) events.push({ p: [i, bottom], time: time++ * stepDelay, dur: fadeDuration, short: true });
                            bottom--;
                        }
                        if (left <= right) {
                            for (let i = bottom; i >= top; i--) events.push({ p: [left, i], time: time++ * stepDelay, dur: fadeDuration, short: true });
                            left++;
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };
    });

    // 25. CHECKERBOARD
    colors.forEach(colorName => {
        animations[`checkerboard_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const holdTime = dur || 500;
                    const events = [];
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) {
                            if ((tx + ty) % 2 === 0) {
                                events.push({ p: [tx, ty], time: 0, dur: holdTime, short: true });
                            }
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };
    });

    // 26. RANDOM_FILL
    colors.forEach(colorName => {
        animations[`random_fill_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 64 : 15;
                    const fadeDuration = dur ? stepDelay * 10 : 300;
                    const events = [];
                    const points = [];
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) points.push([tx, ty]);
                    }
                    for (let i = points.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [points[i], points[j]] = [points[j], points[i]];
                    }
                    points.forEach((p, i) => {
                        events.push({ p, time: i * stepDelay, dur: fadeDuration });
                    });
                    return events;
                }));
            },
            type: 'fixed'
        };
    });

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
                for (let curY = 7; curY >= explodeY; curY--) {
                    events.push({ p: [startX, curY], time: (7 - curY) * climbSpeed, dur: climbSpeed, color: colorName, mode: 'instant' });
                }
                const explosionTime = (7 - explodeY) * climbSpeed;
                const particles = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
                particles.forEach(([dx, dy]) => {
                    const tx = startX + dx, ty = explodeY + dy;
                    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) events.push({ p: [tx, ty], time: explosionTime, dur: explosionDuration, color: colorName, mode: 'instant' });
                });
                const secPopTime = explosionTime + 150;
                particles.forEach(([dx, dy]) => {
                    const tx2 = startX + dx * 2, ty2 = explodeY + dy * 2;
                    if (tx2 >= 0 && tx2 < 8 && ty2 >= 0 && ty2 < 8) events.push({ p: [tx2, ty2], time: secPopTime, dur: 200, color: colorName, mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed'
    };

    const getHeartPoints = () => [
        [1, 0], [2, 0], [5, 0], [6, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
        [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [2, 6], [3, 6], [4, 6], [5, 6], [3, 7], [4, 7]
    ];

    // 28. HEART_FILL
    animations['heart_fill'] = {
        on: (x, y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const heartPoints = getHeartPoints();
                const factor = dur ? dur / 1350 : 1;
                const holdTime = 1000 * factor;
                const events = [];
                heartPoints.forEach(([tx, ty]) => {
                    events.push({ p: [tx, ty], time: (ty * 40 + (tx * 10)) * factor, dur: holdTime, color: 'red', mode: 'instant' });
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
                const factor = dur ? dur / 1400 : 1;
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

    // 31-33. CHARACTERS (ALPHABET, NUMBERS, SYMBOLS)
    const characterGroups = [
        { prefix: 'letter', coords: alphabetCoords },
        { prefix: 'number', coords: numberCoords },
        { prefix: 'symbol', coords: symbolCoords }
    ];

    colors.forEach(colorName => {
        characterGroups.forEach(({ prefix, coords }) => {
            Object.entries(coords).forEach(([char, charCoords]) => {
                animations[`${prefix}_${char}_${colorName}`] = {
                    on: () => charCoords.forEach(([tx, ty]) => fader.add([tx, ty], colorName, 999999, 'instant')),
                    off: () => charCoords.forEach(([tx, ty]) => fader.add([tx, ty], 'off', 0, 'instant')),
                    type: 'momentary'
                };
            });
        });
    });
}
