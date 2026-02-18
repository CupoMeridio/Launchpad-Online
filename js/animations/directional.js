import { activeAnimations } from '../animationEngine.js';
import { PrecomputedAnimation } from '../animationClasses.js';

export function register(animations, colors) {
    colors.forEach(colorName => {
        // RAIN_UP/DOWN/LEFT/RIGHT
        animations[`rain_down_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 9 : 80;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let ty = y; ty < 8; ty++) {
                        events.push({ p: [x, ty], time: (ty - y) * stepDelay, dur: fadeDuration });
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
                        events.push({ p: [x, ty], time: (y - ty) * stepDelay, dur: fadeDuration });
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
                        events.push({ p: [tx, y], time: (x - tx) * stepDelay, dur: fadeDuration });
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
                        events.push({ p: [tx, y], time: (tx - x) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // ARROW_UP/DOWN/LEFT/RIGHT/DIAGONALS
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
                    }));
                },
                type: 'fixed'
            };
        });

        // BOUNCE
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
                }));
            },
            type: 'fixed'
        };

        // SCANLINE
        animations[`scanline_v_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = 0; tx < 8; tx++) {
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: tx * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_v_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let tx = 7; tx >= 0; tx--) {
                        const time = (7 - tx) * stepDelay;
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_v_bounce_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 16 : 50; // Faster steps to fit both ways
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    // Left to Right
                    for (let tx = 0; tx < 8; tx++) {
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: tx * stepDelay, dur: fadeDuration });
                        }
                    }
                    // Right to Left (starting after the first pass)
                    for (let tx = 6; tx >= 0; tx--) { // Start from 6 to avoid double flash on 7
                        const time = (8 + (6 - tx)) * stepDelay;
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_v_bounce_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 16 : 50; // Faster steps to fit both ways
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    // Right to Left
                    for (let tx = 7; tx >= 0; tx--) {
                        const time = (7 - tx) * stepDelay;
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    // Left to Right (starting after the first pass)
                    for (let tx = 1; tx < 8; tx++) { // Start from 1 to avoid double flash on 0
                        const time = (8 + (tx - 1)) * stepDelay;
                        for (let ty = 0; ty < 8; ty++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
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
                            events.push({ p: [tx, ty], time: ty * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_h_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 100;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    for (let ty = 7; ty >= 0; ty--) {
                        const time = (7 - ty) * stepDelay;
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_h_bounce_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 16 : 50; // Faster steps to fit both ways
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    // Top to Bottom
                    for (let ty = 0; ty < 8; ty++) {
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: ty * stepDelay, dur: fadeDuration });
                        }
                    }
                    // Bottom to Top
                    for (let ty = 6; ty >= 0; ty--) { // Start from 6 to avoid double flash on 7
                        const time = (8 + (6 - ty)) * stepDelay;
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        animations[`scanline_h_bounce_reverse_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 16 : 50; // Faster steps to fit both ways
                    const fadeDuration = dur ? stepDelay * 2 : 140;
                    const events = [];
                    // Bottom to Top
                    for (let ty = 7; ty >= 0; ty--) {
                        const time = (7 - ty) * stepDelay;
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    // Top to Bottom
                    for (let ty = 1; ty < 8; ty++) { // Start from 1 to avoid double flash on 0
                        const time = (8 + (ty - 1)) * stepDelay;
                        for (let tx = 0; tx < 8; tx++) {
                            events.push({ p: [tx, ty], time: time, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };
    });
}
