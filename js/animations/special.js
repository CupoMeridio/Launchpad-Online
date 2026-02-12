import { activeAnimations } from '../animationEngine.js';
import { PrecomputedAnimation } from '../animationClasses.js';

export function register(animations, colors) {
    colors.forEach(colorName => {
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
                            events.push({ p: [tx, ty], time: step * stepDelay, dur: fadeDuration });
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
                        events.push({ p, time: i * stepDelay, dur: fadeDuration });
                    });
                    path2.forEach((p, i) => {
                        events.push({ p, time: i * stepDelay, dur: fadeDuration });
                    });

                    // Explosion
                    const explosionDelay = path1.length * stepDelay;
                    const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    flash.forEach(p => {
                        events.push({ p, time: explosionDelay, dur: fadeDuration });
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
                            events.push({ p: [tx, ty], time: (7 - ty) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
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
                        events.push({ p: [tx, ty], time: delay, dur: fadeDuration });
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // 25. CHECKERBOARD
        animations[`checkerboard_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
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
                }));
            },
            type: 'fixed'
        };

        // 26. RANDOM_FILL
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
}
