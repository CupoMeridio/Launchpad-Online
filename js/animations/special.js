/**
 * SPECIAL ANIMATIONS (js/animations/special.js)
 * 
 * Provides complex, audio-reactive, algorithmic, and shape-based light effects:
 * EQ spectrums, matrix rain, strobe bursts, snakes, fireworks, and momentary holds.
 */

import { fader, activeAnimations } from '../animationEngine.js';
import { PrecomputedAnimation, RealEQAnimation, MatrixRainAnimation, StrobeBurstAnimation } from '../animationClasses.js';

const MATRIX_RAIN_DIRECTIONS = [
    ['matrix_rain', 'down'],
    ['matrix_rain_up', 'up'],
    ['matrix_rain_left', 'left'],
    ['matrix_rain_right', 'right']
];

export function buildSnakeEvents(dur) {
    const stepDelay = dur ? dur / 66 : 30;
    const fadeDuration = dur ? stepDelay * 2 : 140;
    const events = [];
    let tx = 3, ty = 3;
    let delay = 0;

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
}

export function buildWarpSpeedEvents(dur) {
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
            events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration });
        }
    });
    return events;
}

export function buildSnakeCollisionEvents(dur) {
    const stepDelay = dur ? dur / 10 : 100;
    const fadeDuration = dur ? stepDelay * 2 : 140;
    const events = [];
    const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
    const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];

    path1.forEach((p, i) => {
        events.push({ p, time: i * stepDelay, dur: fadeDuration });
    });
    path2.forEach((p, i) => {
        events.push({ p, time: i * stepDelay, dur: fadeDuration });
    });

    const explosionDelay = path1.length * stepDelay;
    const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
    flash.forEach(p => {
        events.push({ p, time: explosionDelay, dur: fadeDuration });
    });

    return events;
}

export function buildEqSpectrumEvents(dur) {
    const stepDelay = dur ? dur / 9 : 40;
    const fadeDuration = dur ? stepDelay * 2 : 140;
    const events = [];
    for (let tx = 0; tx < 8; tx++) {
        const height = Math.floor(Math.random() * 7) + 1;
        for (let ty = 7; ty >= 8 - height; ty--) {
            events.push({ p: [tx, ty], time: (7 - ty) * stepDelay, dur: fadeDuration });
        }
    }
    return events;
}

export function buildEqBounceEvents(dur) {
    const baseSteps = 16;
    const speed = dur ? dur / baseSteps : 40;
    const hold = speed * 2;
    const events = [];

    for (let tx = 0; tx < 8; tx++) {
        const height = Math.floor(Math.random() * 7) + 1;
        const peakRow = 8 - height;

        for (let ty = 7; ty >= peakRow; ty--) {
            const turnOnTime = (7 - ty) * speed;
            const turnOffTime = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
            const activeDur = turnOffTime - turnOnTime;

            events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, mode: 'instant' });
        }
    }
    return events;
}

export function buildEqPeakHoldEvents(dur) {
    const baseSteps = 20;
    const speed = dur ? dur / baseSteps : 30;
    const peakHold = dur ? dur * 0.5 : 400;
    const events = [];

    for (let tx = 0; tx < 8; tx++) {
        const height = Math.floor(Math.random() * 7) + 1;
        const peakRow = 8 - height;

        for (let ty = 7; ty >= peakRow; ty--) {
            const turnOnTime = (7 - ty) * speed;
            const turnOffTime = (ty === peakRow)
                ? (7 - peakRow) * speed + peakHold
                : (7 - peakRow) * speed + (ty - peakRow) * speed;

            const activeDur = turnOffTime - turnOnTime;
            if (activeDur > 0) {
                events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, mode: 'instant' });
            }
        }
    }
    return events;
}

export function buildCheckerboardEvents(dur) {
    const holdTime = dur || 500;
    const events = [];
    for (let ty = 0; ty < 8; ty++) {
        for (let tx = 0; tx < 8; tx++) {
            if ((tx + ty) % 2 === 0) {
                events.push({ p: [tx, ty], time: 0, dur: holdTime });
            }
        }
    }
    return events;
}

export function buildAtomicBounceEvents(startX, startY, dur) {
    const totalSteps = 15;
    const stepDelay = dur ? dur / totalSteps : 60;
    const fadeDuration = stepDelay * 2;
    const events = [];
    
    let currX = startX;
    let currY = startY;
    let dx = Math.random() > 0.5 ? 1 : -1;
    let dy = Math.random() > 0.5 ? 1 : -1;

    for (let i = 0; i < totalSteps; i++) {
        events.push({ p: [Math.round(currX), Math.round(currY)], time: i * stepDelay, dur: fadeDuration });
        currX += dx;
        currY += dy;

        if (currX <= 0 || currX >= 7) {
            dx *= -1;
            currX = Math.max(0, Math.min(7, currX));
        }
        if (currY <= 0 || currY >= 7) {
            dy *= -1;
            currY = Math.max(0, Math.min(7, currY));
        }
    }
    return events;
}

export function buildDnaSpiralEvents(_startX, startY, dur) {
    const totalSteps = 16;
    const stepDelay = dur ? dur / totalSteps : 50;
    const fadeDuration = stepDelay * 3;
    const events = [];

    for (let i = 0; i < totalSteps; i++) {
        const tx = i % 8;
        const offset = Math.sin(i * 0.8) * 2;
        const ty1 = Math.max(0, Math.min(7, Math.round(startY + offset)));
        const ty2 = Math.max(0, Math.min(7, Math.round(startY - offset)));

        events.push({ p: [tx, ty1], time: i * stepDelay, dur: fadeDuration });
        events.push({ p: [tx, ty2], time: i * stepDelay, dur: fadeDuration });
    }
    return events;
}

export function buildRandomFillEvents(dur) {
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
}

const STATIC_HOLD_SHAPES = {
    grid_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) pts.push([tx, ty]);
        return pts;
    })(),
    border_hold: (() => {
        const pts = [];
        for (let i = 0; i < 8; i++) pts.push([i, 0], [i, 7], [0, i], [7, i]);
        return pts;
    })(),
    checkerboard_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) if ((tx + ty) % 2 === 0) pts.push([tx, ty]);
        return pts;
    })(),
    inv_checkerboard_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) if ((tx + ty) % 2 !== 0) pts.push([tx, ty]);
        return pts;
    })(),
    half_up_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 8; tx++) pts.push([tx, ty]);
        return pts;
    })(),
    half_down_hold: (() => {
        const pts = [];
        for (let ty = 4; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) pts.push([tx, ty]);
        return pts;
    })(),
    half_left_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 4; tx++) pts.push([tx, ty]);
        return pts;
    })(),
    half_right_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 4; tx < 8; tx++) pts.push([tx, ty]);
        return pts;
    })(),
    stripes_v_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx += 2) pts.push([tx, ty]);
        return pts;
    })(),
    stripes_h_hold: (() => {
        const pts = [];
        for (let ty = 0; ty < 8; ty += 2) for (let tx = 0; tx < 8; tx++) pts.push([tx, ty]);
        return pts;
    })()
};

const HEART_POINTS = [
    [1, 0], [2, 0], [5, 0], [6, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [2, 6], [3, 6], [4, 6], [5, 6], [3, 7], [4, 7]
];

export function register(animations, colors) {
    // EQ_REAL: Multi-color realistic EQ (Green -> Amber -> Red)
    animations['eq_real'] = {
        on: (_x, _y, duration) => {
            activeAnimations.add(new RealEQAnimation(duration));
        },
        type: 'fixed',
        swatchColors: ['green', 'amber', 'red']
    };

    colors.forEach(colorName => {
        // MATRIX RAIN (4 directions)
        for (const [prefix, dir] of MATRIX_RAIN_DIRECTIONS) {
            animations[`${prefix}_${colorName}`] = {
                on: (_x, _y, duration) => {
                    activeAnimations.add(new MatrixRainAnimation(colorName, duration, dir));
                },
                type: 'fixed'
            };
        }

        // STROBE_BURST
        animations[`strobe_burst_${colorName}`] = {
            on: (_x, _y, duration) => {
                activeAnimations.add(new StrobeBurstAnimation(colorName, duration));
            },
            type: 'fixed'
        };

        // Algorithmic pattern animations
        const patternBuilders = {
            snake: (_x, _y, dur) => buildSnakeEvents(dur),
            warp_speed: (_x, _y, dur) => buildWarpSpeedEvents(dur),
            snake_collision: (_x, _y, dur) => buildSnakeCollisionEvents(dur),
            eq_spectrum: (_x, _y, dur) => buildEqSpectrumEvents(dur),
            eq_bounce: (_x, _y, dur) => buildEqBounceEvents(dur),
            eq_peak_hold: (_x, _y, dur) => buildEqPeakHoldEvents(dur),
            checkerboard: (_x, _y, dur) => buildCheckerboardEvents(dur),
            atomic_bounce: (x, y, dur) => buildAtomicBounceEvents(x, y, dur),
            dna_spiral: (x, y, dur) => buildDnaSpiralEvents(x, y, dur),
            random_fill: (_x, _y, dur) => buildRandomFillEvents(dur)
        };

        Object.entries(patternBuilders).forEach(([name, builder]) => {
            animations[`${name}_${colorName}`] = {
                on: (x, y, duration) => {
                    activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                        return builder(x, y, dur);
                    }));
                },
                type: 'fixed'
            };
        });

        // Static shape momentary hold animations
        Object.entries(STATIC_HOLD_SHAPES).forEach(([name, points]) => {
            animations[`${name}_${colorName}`] = {
                on: () => {
                    for (let i = 0; i < points.length; i++) {
                        fader.add(points[i], colorName, 999999, 'instant');
                    }
                },
                off: () => {
                    for (let i = 0; i < points.length; i++) {
                        fader.add(points[i], 'off', 0, 'instant');
                    }
                },
                type: 'momentary'
            };
        });
    });

    // FIREWORK
    animations['firework'] = {
        on: (_x, _y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const colorsArr = ['red', 'green', 'amber'];
                const colorName = colorsArr[Math.floor(Math.random() * colorsArr.length)];
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
        type: 'fixed',
        swatchColors: ['red', 'amber', 'green']
    };

    // HEART_FILL
    animations['heart_fill'] = {
        on: (_x, _y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const factor = dur ? dur / 1350 : 1;
                const holdTime = 1000 * factor;
                const events = [];
                HEART_POINTS.forEach(([tx, ty]) => {
                    events.push({ p: [tx, ty], time: (ty * 40 + (tx * 10)) * factor, dur: holdTime, color: 'red', mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed',
        swatchColors: ['red']
    };

    // HEART_SIMPLE
    animations['heart_simple'] = {
        on: (_x, _y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const holdTime = dur || 1000;
                const events = [];
                HEART_POINTS.forEach(([tx, ty]) => {
                    events.push({ p: [tx, ty], time: 0, dur: holdTime, color: 'red', mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed',
        swatchColors: ['red']
    };

    // HEART_WAVE
    animations['heart_wave'] = {
        on: (_x, _y, duration) => {
            activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                const centerX = 3.5, centerY = 3.5;
                const factor = dur ? dur / 1400 : 1;
                const events = [];
                HEART_POINTS.forEach(([tx, ty]) => {
                    const dist = Math.sqrt(Math.pow(tx - centerX, 2) + Math.pow(ty - centerY, 2));
                    const appearDelay = (dist * 80) * factor;
                    const disappearDelay = (1000 + ((5 - dist) * 80)) * factor;
                    events.push({ p: [tx, ty], time: appearDelay, dur: (disappearDelay - appearDelay), color: 'red', mode: 'instant' });
                });
                return events;
            }));
        },
        type: 'fixed',
        swatchColors: ['red']
    };
}
