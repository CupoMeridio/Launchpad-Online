import { fader, activeAnimations } from '../animationEngine.js';
import { PrecomputedAnimation, StrobeBurstMultiAnimation, MatrixRainMultiAnimation } from '../animationClasses.js';

export function register(animations, colors) {
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
                    const stepDelay = dur ? dur / 10 : 70;
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
                    const stepDelay = dur ? dur / (maxDist + 3) : 70;
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
                    const stepDelay = dur ? dur / 12 : 60;
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
                    const stepDelay = dur ? dur / (maxDistance + 3) : 60;
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
                    const stepDelay = dur ? dur / 7.5 : 60;
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
                    const stepDelay = dur ? dur / 7.5 : 60;
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
                        const stepDelay = dur ? dur / 14.5 : 70;
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

        // STROBE_MULTI
        animations[`strobe_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new StrobeBurstMultiAnimation(config, duration));
            },
            type: 'fixed'
        };

        // MATRIX_RAIN_MULTI
        animations[`matrix_rain_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainMultiAnimation(config, duration, 'down'));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_multi_up_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainMultiAnimation(config, duration, 'up'));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_multi_left_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainMultiAnimation(config, duration, 'left'));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_multi_right_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainMultiAnimation(config, duration, 'right'));
            },
            type: 'fixed'
        };

        // RAIN_UP/DOWN/LEFT/RIGHT MULTI
        animations[`rain_down_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 12 : 80;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let ty = y; ty < 8; ty++) {
                        events.push({ p: [x, ty], time: (ty - y) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`rain_up_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 12 : 80;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let ty = y; ty >= 0; ty--) {
                        events.push({ p: [x, ty], time: (y - ty) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`rain_left_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 12 : 80;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let tx = x; tx >= 0; tx--) {
                        events.push({ p: [tx, y], time: (x - tx) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };

        animations[`rain_right_multi_${config.name}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(null, duration, (dur) => {
                    const stepDelay = dur ? dur / 12 : 80;
                    const fadeDuration = dur ? stepDelay * 4.5 : 450;
                    const events = [];
                    for (let tx = x; tx < 8; tx++) {
                        events.push({ p: [tx, y], time: (tx - x) * stepDelay, dur: fadeDuration });
                    }
                    return events;
                }, triggerMultiFade));
            },
            type: 'fixed'
        };
    });
}
