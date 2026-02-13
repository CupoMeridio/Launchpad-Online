import { activeAnimations } from '../animationEngine.js';
import { PrecomputedAnimation } from '../animationClasses.js';

export function register(animations, colors) {
    colors.forEach(colorName => {
        // EXPLODE: Outward square expansion
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
                                        events.push({ p: [tx, ty], time, dur: fadeDuration });
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

        // IMPLODE: Inward square contraction
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
                                        events.push({ p: [tx, ty], time, dur: fadeDuration });
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

        // CROSS: Expanding cross
        animations[`cross_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
                    const stepDelay = dur ? dur / 8 : 70;
                    const fadeDuration = dur ? stepDelay * 2 : 140;
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
                }));
            },
            type: 'fixed'
        };

        // CROSS_HOLD: Static cross while held
        animations[`cross_hold_${colorName}`] = {
            on: (x, y) => {
                const points = [[x, y]];
                for (let dist = 1; dist < 8; dist++) {
                    [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]].forEach(p => {
                        if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) points.push(p);
                    });
                }
                points.forEach(p => fader.add(p, colorName, 999999, 'instant'));
            },
            off: (x, y) => {
                const points = [[x, y]];
                for (let dist = 1; dist < 8; dist++) {
                    [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]].forEach(p => {
                        if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) points.push(p);
                    });
                }
                points.forEach(p => fader.add(p, 'off', 0, 'instant'));
            },
            type: 'momentary'
        };

        // X_HOLD: Diagonal cross while held
        animations[`x_hold_${colorName}`] = {
            on: (x, y) => {
                const points = [];
                for (let i = -7; i <= 7; i++) {
                    [[x + i, y + i], [x + i, y - i]].forEach(p => {
                        if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) points.push(p);
                    });
                }
                points.forEach(p => fader.add(p, colorName, 999999, 'instant'));
            },
            off: (x, y) => {
                const points = [];
                for (let i = -7; i <= 7; i++) {
                    [[x + i, y + i], [x + i, y - i]].forEach(p => {
                        if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) points.push(p);
                    });
                }
                points.forEach(p => fader.add(p, 'off', 0, 'instant'));
            },
            type: 'momentary'
        };

        // SQUARE_HOLD: 3x3 square while held
        animations[`square_hold_${colorName}`] = {
            on: (x, y) => {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const tx = x + dx, ty = y + dy;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) fader.add([tx, ty], colorName, 999999, 'instant');
                    }
                }
            },
            off: (x, y) => {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const tx = x + dx, ty = y + dy;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) fader.add([tx, ty], 'off', 0, 'instant');
                    }
                }
            },
            type: 'momentary'
        };

        // ROW_HOLD: Full row while held
        animations[`row_hold_${colorName}`] = {
            on: (x, y) => {
                for (let tx = 0; tx < 8; tx++) fader.add([tx, y], colorName, 999999, 'instant');
            },
            off: (x, y) => {
                for (let tx = 0; tx < 8; tx++) fader.add([tx, y], 'off', 0, 'instant');
            },
            type: 'momentary'
        };

        // COL_HOLD: Full column while held
        animations[`col_hold_${colorName}`] = {
            on: (x, y) => {
                for (let ty = 0; ty < 8; ty++) fader.add([x, ty], colorName, 999999, 'instant');
            },
            off: (x, y) => {
                for (let ty = 0; ty < 8; ty++) fader.add([x, ty], 'off', 0, 'instant');
            },
            type: 'momentary'
        };

        // CROSS_REVERSE: Contracting cross
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
                }));
            },
            type: 'fixed'
        };

        // WAVE: Expanding circle/diamond
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
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // WAVE_REVERSE
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
                            events.push({ p: [targetX, targetY], time: (maxDistance - distance) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // WAVE_CENTER
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
                            events.push({ p: [targetX, targetY], time: distance * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // WAVE_CENTER_REVERSE
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
                            events.push({ p: [targetX, targetY], time: (5 - distance) * stepDelay, dur: fadeDuration });
                        }
                    }
                    return events;
                }));
            },
            type: 'fixed'
        };

        // ROTATE
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
                    }));
                },
                type: 'fixed'
            };
        });

        // SPIRAL
        animations[`spiral_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new PrecomputedAnimation(colorName, duration, (dur) => {
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
                }));
            },
            type: 'fixed'
        };

        // Aliases
        animations[`rotate_cw_${colorName}`] = animations[`rotate_cw_left_${colorName}`];
        animations[`rotate_ccw_${colorName}`] = animations[`rotate_ccw_left_${colorName}`];
    });
}
