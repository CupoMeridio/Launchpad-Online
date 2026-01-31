/**
 * =============================================================================
 * LIGHTS MODULE (lights.js)
 * =============================================================================
 * 
 * This module orchestrates light animations for both the physical Launchpad
 * and the web UI (digital Launchpad). It uses the respective interface modules
 * to perform the actual updates.
 */

import { setWebColor, webColorMap } from './webInterface.js';
import { setPhysicalColor, getLpColor, flushPhysicalColors } from './physicalInterface.js';

/**
 * Registry of available animations.
 */
export const animations = {};

let animationFrameId = null;
let lastTickTime = 0;
const activeAnimations = new Set();

/**
 * Main animation loop using requestAnimationFrame.
 */
function animationLoop(timestamp) {
    if (!lastTickTime) lastTickTime = timestamp;
    const deltaTime = timestamp - lastTickTime;
    lastTickTime = timestamp;

    if (activeAnimations.size > 0) {
        activeAnimations.forEach(anim => {
            if (anim.update) {
                const isFinished = anim.update(timestamp, deltaTime);
                if (isFinished) {
                    activeAnimations.delete(anim);
                }
            }
        });
    }

    // After updating all animations for this frame, flush MIDI messages
    flushPhysicalColors();

    animationFrameId = requestAnimationFrame(animationLoop);
}

// Start the loop
animationFrameId = requestAnimationFrame(animationLoop);

/**
 * Shared utility to run a callback after a certain delay using the animation loop.
 */
const setLoopTimeout = (callback, delay) => {
    const startTime = performance.now();
    const anim = {
        update: (now) => {
            if (now - startTime >= delay) {
                callback();
                return true;
            }
            return false;
        }
    };
    activeAnimations.add(anim);
};

/**
 * Shared utility to apply a fade effect (Full -> Medium -> Low -> Off) to a pad.
 */
const applyFade = (p, colorName) => {
    const startTime = performance.now();
    const baseColor = getLpColor(colorName);
    const lpOff = getLpColor('off');

    const anim = {
        update: (now) => {
            const elapsed = now - startTime;
            if (elapsed < 100) {
                setWebColor(webColorMap[colorName].full, p);
                setPhysicalColor(baseColor?.full, p);
                return false;
            } else if (elapsed < 200) {
                setWebColor(webColorMap[colorName].medium, p);
                setPhysicalColor(baseColor?.medium, p);
                return false;
            } else if (elapsed < 300) {
                setWebColor(webColorMap[colorName].low, p);
                setPhysicalColor(baseColor?.low, p);
                return false;
            } else {
                setWebColor('off', p);
                setPhysicalColor(lpOff, p);
                return true; // Finished
            }
        }
    };
    activeAnimations.add(anim);
};

/**
 * Shared utility to apply a shorter fade effect (Full -> Low -> Off).
 */
const applyFadeShort = (p, colorName) => {
    const startTime = performance.now();
    const baseColor = getLpColor(colorName);
    const lpOff = getLpColor('off');

    const anim = {
        update: (now) => {
            const elapsed = now - startTime;
            if (elapsed < 70) {
                setWebColor(webColorMap[colorName].full, p);
                setPhysicalColor(baseColor?.full, p);
                return false;
            } else if (elapsed < 140) {
                setWebColor(webColorMap[colorName].low, p);
                setPhysicalColor(baseColor?.low, p);
                return false;
            } else {
                setWebColor('off', p);
                setPhysicalColor(lpOff, p);
                return true; // Finished
            }
        }
    };
    activeAnimations.add(anim);
};

/**
 * Animation Factory
 */
const createAnimationLibrary = () => {
    const alphabetCoords = {
        'a': [[3, 0], [4, 0], [2, 1], [5, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'b': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        'c': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'd': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        'e': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [1, 5], [1, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        'f': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [1, 5], [1, 6], [1, 7]],
        'g': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [1, 3], [4, 3], [5, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'h': [[1, 0], [6, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'i': [[2, 0], [3, 0], [4, 0], [5, 0], [3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [3, 6], [4, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'j': [[4, 0], [5, 0], [6, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [1, 6], [5, 6], [2, 7], [3, 7], [4, 7]],
        'k': [[1, 0], [6, 0], [1, 1], [5, 1], [1, 2], [4, 2], [1, 3], [2, 3], [3, 3], [1, 4], [4, 4], [1, 5], [5, 5], [1, 6], [6, 6], [1, 7], [7, 7]],
        'l': [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'm': [[1, 0], [6, 0], [1, 1], [2, 1], [5, 1], [6, 1], [1, 2], [3, 2], [4, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'n': [[1, 0], [6, 0], [1, 1], [2, 1], [6, 1], [1, 2], [3, 2], [6, 2], [1, 3], [4, 2], [6, 3], [1, 4], [5, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'o': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'p': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [1, 5], [1, 6], [1, 7]],
        'q': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [4, 4], [6, 4], [1, 5], [5, 5], [6, 5], [2, 6], [3, 6], [4, 6], [5, 6], [1, 7], [6, 7], [7, 7]],
        'r': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [4, 4], [1, 5], [5, 5], [1, 6], [6, 6], [1, 7], [7, 7]],
        's': [[2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        't': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [3, 6], [4, 6], [3, 7], [4, 7]],
        'u': [[1, 0], [6, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        'v': [[1, 0], [6, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [2, 5], [5, 5], [3, 6], [4, 6], [3, 7], [4, 7]],
        'w': [[1, 0], [7, 0], [1, 1], [7, 1], [1, 2], [7, 2], [1, 3], [4, 3], [7, 3], [1, 4], [3, 4], [5, 4], [7, 4], [1, 5], [2, 5], [6, 5], [7, 5], [1, 6], [7, 6], [1, 7], [7, 7]],
        'x': [[1, 0], [6, 0], [1, 1], [6, 1], [2, 2], [5, 2], [3, 3], [4, 3], [3, 4], [4, 4], [2, 5], [5, 5], [1, 6], [6, 6], [1, 7], [6, 7]],
        'y': [[1, 0], [6, 0], [1, 1], [6, 1], [2, 2], [5, 2], [3, 3], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7]],
        'z': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [6, 1], [5, 2], [4, 3], [3, 4], [2, 5], [1, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]]
    };

    const numberCoords = {
        '0': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '1': [[4, 0], [3, 1], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        '2': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [6, 2], [6, 3], [5, 4], [4, 5], [3, 6], [2, 7], [1, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
        '3': [[2, 0], [3, 0], [4, 0], [5, 0], [6, 1], [6, 2], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '4': [[1, 0], [1, 1], [1, 2], [1, 3], [6, 0], [6, 1], [6, 2], [6, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [6, 7]],
        '5': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 4], [6, 5], [6, 6], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
        '6': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '7': [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [6, 1], [5, 2], [4, 3], [3, 4], [2, 5], [1, 6], [1, 7]],
        '8': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [6, 4], [1, 5], [6, 5], [1, 6], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]],
        '9': [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [6, 1], [1, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [6, 4], [6, 5], [6, 6], [2, 7], [3, 7], [4, 7], [5, 7]]
    };

    const symbolCoords = {
        'question': [[3, 0], [4, 0], [5, 0], [2, 1], [6, 1], [6, 2], [4, 3], [5, 3], [4, 4], [4, 5], [4, 7]],
        'exclamation': [[3, 0], [4, 0], [3, 1], [4, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5], [3, 7], [4, 7]]
    };

    const colors = ['red', 'green', 'amber'];

    colors.forEach(colorName => {
        // 1. PULSE
        animations[`pulse_${colorName}`] = {
            on: (x, y) => {
                setWebColor(webColorMap[colorName].full, [x, y]);
                setPhysicalColor(getLpColor(colorName), [x, y]);
            },
            off: (x, y) => {
                setWebColor('off', [x, y]);
                setPhysicalColor(getLpColor('off'), [x, y]);
            },
            type: 'momentary'
        };

        // 2. CROSS
        animations[`cross_${colorName}`] = {
            on: (x, y) => {
                const color = webColorMap[colorName].full;
                const lpColor = getLpColor(colorName);
                for (let i = 0; i < 8; i++) {
                    setWebColor(color, [i, y]);
                    setWebColor(color, [x, i]);
                    setPhysicalColor(lpColor, [i, y]);
                    setPhysicalColor(lpColor, [x, i]);
                }
            },
            off: (x, y) => {
                const lpOff = getLpColor('off');
                for (let i = 0; i < 8; i++) {
                    setWebColor('off', [i, y]);
                    setWebColor('off', [x, i]);
                    setPhysicalColor(lpOff, [i, y]);
                    setPhysicalColor(lpOff, [x, i]);
                }
            },
            type: 'momentary'
        };

        // 3. EXPAND
        animations[`expand_${colorName}`] = {
            on: (x, y) => {
                applyFade([x, y], colorName);
                for (let dist = 1; dist < 8; dist++) {
                    setLoopTimeout(() => {
                        const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                        directions.forEach(p => {
                            if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyFade(p, colorName);
                        });
                    }, dist * 60);
                }
            },
            type: 'fixed'
        };

        // 3.1 EXPAND_REVERSE
        animations[`expand_reverse_${colorName}`] = {
            on: (x, y) => {
                const maxDist = Math.max(x, 7 - x, y, 7 - y);
                for (let dist = maxDist; dist >= 0; dist--) {
                    setLoopTimeout(() => {
                        if (dist === 0) {
                            applyFade([x, y], colorName);
                        } else {
                            const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                            directions.forEach(p => {
                                if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyFade(p, colorName);
                            });
                        }
                    }, (maxDist - dist) * 60);
                }
            },
            type: 'fixed'
        };

        // 4. WAVE
        animations[`wave_${colorName}`] = {
            on: (x, y) => {
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - x;
                        const dy = targetY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFade([targetX, targetY], colorName), distance * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 4.1 WAVE_REVERSE
        animations[`wave_reverse_${colorName}`] = {
            on: (x, y) => {
                const maxDistance = Math.max(
                    Math.sqrt(x * x + y * y),
                    Math.sqrt(Math.pow(7 - x, 2) + y * y),
                    Math.sqrt(x * x + Math.pow(7 - y, 2)),
                    Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                );
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - x;
                        const dy = targetY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFade([targetX, targetY], colorName), (maxDistance - distance) * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 5. WAVE_CENTER
        animations[`wave_center_${colorName}`] = {
            on: () => {
                const centerX = 3.5;
                const centerY = 3.5;
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - centerX;
                        const dy = targetY - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFade([targetX, targetY], colorName), distance * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 5.1 WAVE_CENTER_REVERSE
        animations[`wave_center_reverse_${colorName}`] = {
            on: () => {
                const centerX = 3.5;
                const centerY = 3.5;
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - centerX;
                        const dy = targetY - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFade([targetX, targetY], colorName), (5 - distance) * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 6. ROTATE: Rotating beam (radar sweep) with directional variants
        const rotationStarts = {
            'top': -Math.PI / 2,
            'right': 0,
            'bottom': Math.PI / 2,
            'left': Math.PI
        };

        Object.entries(rotationStarts).forEach(([dirName, startAngle]) => {
            // Clockwise (CW)
            animations[`rotate_cw_${dirName}_${colorName}`] = {
                on: () => {
                    const centerX = 3.5;
                    const centerY = 3.5;
                    const baseColor = getLpColor(colorName);
                    const lpOff = getLpColor('off');

                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const angle = Math.atan2(dy, dx);

                            // Calculate normalized angle (0 to 1) starting from startAngle, going CW
                            let shiftedAngle = angle - startAngle;
                            while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                            const normalizedAngle = shiftedAngle / (2 * Math.PI);

                            const delay = normalizedAngle * 600;
                            const p = [targetX, targetY];
                            setLoopTimeout(() => applyFade(p, colorName), delay);
                        }
                    }
                },
                type: 'fixed'
            };

            // Counter-Clockwise (CCW)
            animations[`rotate_ccw_${dirName}_${colorName}`] = {
                on: () => {
                    const centerX = 3.5;
                    const centerY = 3.5;

                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - centerX;
                            const dy = targetY - centerY;
                            const angle = Math.atan2(dy, dx);

                            // Calculate normalized angle (0 to 1) starting from startAngle, going CCW
                            let shiftedAngle = startAngle - angle;
                            while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                            const normalizedAngle = shiftedAngle / (2 * Math.PI);

                            const delay = normalizedAngle * 600;
                            const p = [targetX, targetY];
                            setLoopTimeout(() => applyFade(p, colorName), delay);
                        }
                    }
                },
                type: 'fixed'
            };
        });

        // 7. DIAGONAL: Straight diagonal wave from corners
        const corners = {
            'top_left': (x, y) => x + y,
            'top_right': (x, y) => (7 - x) + y,
            'bottom_left': (x, y) => x + (7 - y),
            'bottom_right': (x, y) => (7 - x) + (7 - y)
        };

        Object.entries(corners).forEach(([cornerName, distFn]) => {
            // Normal
            animations[`diagonal_${cornerName}_${colorName}`] = {
                on: () => {
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const distance = distFn(targetX, targetY);
                            setLoopTimeout(() => applyFade([targetX, targetY], colorName), distance * 60);
                        }
                    }
                },
                type: 'fixed'
            };
        });

        // 8. RING: Expanding shockwave (only the edge)
        animations[`ring_${colorName}`] = {
            on: (x, y) => {
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - x;
                        const dy = targetY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFadeShort([targetX, targetY], colorName), distance * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 8b. RING_CENTER: Expanding shockwave from the center
        animations[`ring_center_${colorName}`] = {
            on: () => {
                const cx = 3.5, cy = 3.5; // Center of the 8x8 grid
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - cx;
                        const dy = targetY - cy;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFadeShort([targetX, targetY], colorName), distance * 60);
                    }
                }
            },
            type: 'fixed'
        };

        animations[`ring_reverse_${colorName}`] = {
            on: (x, y) => {
                const maxDistance = Math.max(
                    Math.sqrt(x * x + y * y),
                    Math.sqrt(Math.pow(7 - x, 2) + y * y),
                    Math.sqrt(x * x + Math.pow(7 - y, 2)),
                    Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                );
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - x;
                        const dy = targetY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyFadeShort([targetX, targetY], colorName), (maxDistance - distance) * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 9. SCANLINE
        animations[`scan_h_${colorName}`] = {
            on: (x, y) => {
                for (let ty = 0; ty < 8; ty++) {
                    const delay = Math.abs(ty - y) * 60;
                    setLoopTimeout(() => {
                        for (let tx = 0; tx < 8; tx++) {
                            applyFadeShort([tx, ty], colorName);
                        }
                    }, delay);
                }
            },
            type: 'fixed'
        };

        animations[`scan_v_${colorName}`] = {
            on: (x, y) => {
                for (let tx = 0; tx < 8; tx++) {
                    const delay = Math.abs(tx - x) * 60;
                    setLoopTimeout(() => {
                        for (let ty = 0; ty < 8; ty++) {
                            applyFadeShort([tx, ty], colorName);
                        }
                    }, delay);
                }
            },
            type: 'fixed'
        };

        // 10. RAIN
        animations[`rain_${colorName}`] = {
            on: (x, y) => {
                for (let ty = y; ty < 8; ty++) {
                    const delay = (ty - y) * 100;
                    setLoopTimeout(() => applyFadeShort([x, ty], colorName), delay);
                }
            },
            type: 'fixed'
        };

        // 10b. MATRIX_RAIN
        animations[`matrix_rain_${colorName}`] = {
            on: () => {
                for (let tx = 0; tx < 8; tx++) {
                    const startDelay = Math.random() * 500;
                    const speed = 70 + Math.random() * 50;
                    setLoopTimeout(() => {
                        for (let ty = 0; ty < 8; ty++) {
                            const stepDelay = ty * speed;
                            setLoopTimeout(() => applyFadeShort([tx, ty], colorName), stepDelay);
                        }
                    }, startDelay);
                }
            },
            type: 'fixed'
        };

        animations[`rain_up_${colorName}`] = {
            on: (x, y) => {
                for (let ty = y; ty >= 0; ty--) {
                    const delay = (y - ty) * 80;
                    setLoopTimeout(() => applyFadeShort([x, ty], colorName), delay);
                }
            },
            type: 'fixed'
        };

        // 12. SPARKLE
        animations[`sparkle_${colorName}`] = {
            on: () => {
                for (let i = 0; i < 20; i++) {
                    const delay = Math.random() * 600;
                    const tx = Math.floor(Math.random() * 8);
                    const ty = Math.floor(Math.random() * 8);
                    setLoopTimeout(() => applyFadeShort([tx, ty], colorName), delay);
                }
            },
            type: 'fixed'
        };

        // 13. BOUNCE
        animations[`bounce_${colorName}`] = {
            on: (x, y) => {
                const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                directions.forEach(([dx, dy]) => {
                    for (let step = 0; step < 8; step++) {
                        const tx = x + dx * step;
                        const ty = y + dy * step;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            setLoopTimeout(() => applyFadeShort([tx, ty], colorName), step * 50);
                        } else {
                            const lastValidStep = step - 1;
                            for (let bStep = 1; bStep <= lastValidStep; bStep++) {
                                const bx = x + dx * (lastValidStep - bStep);
                                const by = y + dy * (lastValidStep - bStep);
                                setLoopTimeout(() => applyFadeShort([bx, by], colorName), (step + bStep) * 50);
                            }
                            break;
                        }
                    }
                });
            },
            type: 'fixed'
        };

        // 14. SNAKE
        animations[`snake_${colorName}`] = {
            on: () => {
                let tx = 3, ty = 3;
                let delay = 0;
                applyFadeShort([tx, ty], colorName);

                const move = (dx, dy, steps) => {
                    for (let i = 0; i < steps; i++) {
                        tx += dx;
                        ty += dy;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            const p = [tx, ty];
                            delay += 30;
                            setLoopTimeout(() => applyFadeShort(p, colorName), delay);
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
            },
            type: 'fixed'
        };

        // 16. WARP_SPEED
        animations[`warp_speed_${colorName}`] = {
            on: () => {
                const centers = [[3, 3], [3, 4], [4, 3], [4, 4]];
                const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                centers.forEach((c, i) => {
                    const [dx, dy] = directions[i];
                    for (let step = 0; step < 4; step++) {
                        const tx = c[0] + dx * step;
                        const ty = c[1] + dy * step;
                        setLoopTimeout(() => applyFadeShort([tx, ty], colorName), step * 80);
                    }
                });
            },
            type: 'fixed'
        };

        // 17. SNAKE_COLLISION
        animations[`snake_collision_${colorName}`] = {
            on: () => {
                const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
                const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];
                path1.forEach((p, i) => {
                    setLoopTimeout(() => applyFadeShort(p, colorName), i * 100);
                });
                path2.forEach((p, i) => {
                    setLoopTimeout(() => applyFadeShort(p, colorName), i * 100);
                });
                setLoopTimeout(() => {
                    const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    flash.forEach(p => applyFadeShort(p, colorName));
                }, path1.length * 100);
            },
            type: 'fixed'
        };

        // 18. EQ_SPECTRUM
        animations[`eq_spectrum_${colorName}`] = {
            on: () => {
                for (let tx = 0; tx < 8; tx++) {
                    const height = Math.floor(Math.random() * 7) + 1;
                    for (let ty = 7; ty >= 8 - height; ty--) {
                        setLoopTimeout(() => applyFadeShort([tx, ty], colorName), (7 - ty) * 40);
                    }
                }
            },
            type: 'fixed'
        };

        // 19. STROBE_BURST: Rapid grid flashes
        animations[`strobe_burst_${colorName}`] = {
            on: () => {
                const baseColor = getLpColor(colorName);
                const lpOff = getLpColor('off');
                for (let flash = 0; flash < 4; flash++) {
                    setLoopTimeout(() => {
                        // Flash On
                        for (let ty = 0; ty < 8; ty++) {
                            for (let tx = 0; tx < 8; tx++) {
                                setWebColor(webColorMap[colorName].full, [tx, ty]);
                                setPhysicalColor(baseColor?.full, [tx, ty]);
                            }
                        }
                        // Flash Off
                        setLoopTimeout(() => {
                            for (let ty = 0; ty < 8; ty++) {
                                for (let tx = 0; tx < 8; tx++) {
                                    setWebColor('off', [tx, ty]);
                                    setPhysicalColor(lpOff, [tx, ty]);
                                }
                            }
                        }, 50);
                    }, flash * 120);
                }
            },
            type: 'fixed'
        };

        // 20. EQ_BOUNCE: Solid columns that rise and fall
        animations[`eq_bounce_${colorName}`] = {
            on: () => {
                const baseColor = getLpColor(colorName);
                const lpOff = getLpColor('off');
                for (let tx = 0; tx < 8; tx++) {
                    const height = Math.floor(Math.random() * 7) + 1;
                    const peakRow = 8 - height;
                    const speed = 40;
                    const hold = 100;

                    // Rise: Turn pixels ON from bottom to top
                    for (let ty = 7; ty >= peakRow; ty--) {
                        setLoopTimeout(() => {
                            setWebColor(webColorMap[colorName].full, [tx, ty]);
                            setPhysicalColor(baseColor?.full, [tx, ty]);
                        }, (7 - ty) * speed);
                    }

                    // Fall: Turn pixels OFF from top to bottom
                    for (let ty = peakRow; ty <= 7; ty++) {
                        const fallDelay = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                        setLoopTimeout(() => {
                            setWebColor('off', [tx, ty]);
                            setPhysicalColor(lpOff, [tx, ty]);
                        }, fallDelay);
                    }
                }
            },
            type: 'fixed'
        };

        // 21. EQ_PEAK_HOLD: Columns fall immediately, but the peak pixel stays longer
        animations[`eq_peak_hold_${colorName}`] = {
            on: () => {
                const baseColor = getLpColor(colorName);
                const lpOff = getLpColor('off');
                for (let tx = 0; tx < 8; tx++) {
                    const height = Math.floor(Math.random() * 7) + 1;
                    const peakRow = 8 - height;
                    const speed = 30;
                    const peakHold = 400;

                    // Rise
                    for (let ty = 7; ty >= peakRow; ty--) {
                        setLoopTimeout(() => {
                            setWebColor(webColorMap[colorName].full, [tx, ty]);
                            setPhysicalColor(baseColor?.full, [tx, ty]);
                        }, (7 - ty) * speed);
                    }

                    // Fast Fall (all except peak)
                    for (let ty = peakRow + 1; ty <= 7; ty++) {
                        const fallDelay = (7 - peakRow) * speed + (ty - peakRow) * speed;
                        setLoopTimeout(() => {
                            setWebColor('off', [tx, ty]);
                            setPhysicalColor(lpOff, [tx, ty]);
                        }, fallDelay);
                    }

                    // Peak Fall (stays longer)
                    const peakFallDelay = (7 - peakRow) * speed + peakHold;
                    setLoopTimeout(() => {
                        setWebColor('off', [tx, peakRow]);
                        setPhysicalColor(lpOff, [tx, peakRow]);
                    }, peakFallDelay);
                }
            },
            type: 'fixed'
        };

        // Legacy / Default aliases (Left-starting)
        animations[`rotate_cw_${colorName}`] = animations[`rotate_cw_left_${colorName}`];
        animations[`rotate_ccw_${colorName}`] = animations[`rotate_ccw_left_${colorName}`];
    });

    // 8. CROSS_MULTI: Color transitioning cross (Red -> Amber -> Green and vice-versa)
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
        // HELPER: applyMultiFade
        const applyMultiFade = (p) => {
            const startTime = performance.now();
            const step1 = config.sequence[0];
            const step2 = config.sequence[1];
            const step3 = config.sequence[2];
            const lpOff = getLpColor('off');

            const anim = {
                update: (now) => {
                    const elapsed = now - startTime;
                    if (elapsed < 150) {
                        setWebColor(webColorMap[step1.color][step1.level], p);
                        setPhysicalColor(getLpColor(step1.color, step1.level), p);
                        return false;
                    } else if (elapsed < 300) {
                        setWebColor(webColorMap[step2.color][step2.level], p);
                        setPhysicalColor(getLpColor(step2.color, step2.level), p);
                        return false;
                    } else if (elapsed < 450) {
                        setWebColor(webColorMap[step3.color][step3.level], p);
                        setPhysicalColor(getLpColor(step3.color, step3.level), p);
                        return false;
                    } else {
                        setWebColor('off', p);
                        setPhysicalColor(lpOff, p);
                        return true; // Finished
                    }
                }
            };
            activeAnimations.add(anim);
        };

        // 8. CROSS_MULTI: Color transitioning cross
        animations[`cross_multi_${config.name}`] = {
            on: (x, y) => {
                applyMultiFade([x, y]);
                for (let dist = 1; dist < 8; dist++) {
                    setLoopTimeout(() => {
                        const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                        directions.forEach(p => {
                            if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyMultiFade(p);
                        });
                    }, dist * 70);
                }
            },
            type: 'fixed'
        };

        // 8.1 CROSS_MULTI_REVERSE: Color transitioning cross converging to center
        animations[`cross_multi_reverse_${config.name}`] = {
            on: (x, y) => {
                const maxDist = Math.max(x, 7 - x, y, 7 - y);
                for (let dist = maxDist; dist >= 0; dist--) {
                    setLoopTimeout(() => {
                        if (dist === 0) {
                            applyMultiFade([x, y]);
                        } else {
                            const directions = [[x + dist, y], [x - dist, y], [x, y + dist], [x, y - dist]];
                            directions.forEach(p => {
                                if (p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8) applyMultiFade(p);
                            });
                        }
                    }, (maxDist - dist) * 70);
                }
            },
            type: 'fixed'
        };

        // 9. EXPAND_MULTI: Color transitioning expand
        animations[`expand_multi_${config.name}`] = animations[`cross_multi_${config.name}`];
        animations[`expand_multi_reverse_${config.name}`] = animations[`cross_multi_reverse_${config.name}`];

        // 10. WAVE_MULTI: Color transitioning wave
        animations[`wave_multi_${config.name}`] = {
            on: (x, y) => {
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - x;
                        const dy = targetY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyMultiFade([targetX, targetY]), distance * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 10.1 WAVE_MULTI_REVERSE: Color transitioning wave converging to pressed key
        animations[`wave_multi_reverse_${config.name}`] = {
            on: (x, y) => {
                const maxDistance = Math.max(
                    Math.sqrt(x * x + y * y),
                    Math.sqrt(Math.pow(7 - x, 2) + y * y),
                    Math.sqrt(x * x + Math.pow(7 - y, 2)),
                    Math.sqrt(Math.pow(7 - x, 2) + Math.pow(7 - y, 2))
                );

                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - x;
                        const dy = targetY - y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyMultiFade([targetX, targetY]), (maxDistance - distance) * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 11. WAVE_CENTER_MULTI: Color transitioning wave from center
        animations[`wave_center_multi_${config.name}`] = {
            on: () => {
                const centerX = 3.5;
                const centerY = 3.5;
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - centerX;
                        const dy = targetY - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyMultiFade([targetX, targetY]), distance * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 11.1 WAVE_CENTER_MULTI_REVERSE: Color transitioning wave converging to center
        animations[`wave_center_multi_reverse_${config.name}`] = {
            on: () => {
                const centerX = 3.5;
                const centerY = 3.5;
                for (let targetY = 0; targetY < 8; targetY++) {
                    for (let targetX = 0; targetX < 8; targetX++) {
                        const dx = targetX - centerX;
                        const dy = targetY - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        setLoopTimeout(() => applyMultiFade([targetX, targetY]), (5 - distance) * 60);
                    }
                }
            },
            type: 'fixed'
        };

        // 11.2 DIAGONAL_MULTI: Color transitioning diagonal wave
        const corners = {
            'top_left': (x, y) => x + y,
            'top_right': (x, y) => (7 - x) + y,
            'bottom_left': (x, y) => x + (7 - y),
            'bottom_right': (x, y) => (7 - x) + (7 - y)
        };

        Object.entries(corners).forEach(([cornerName, distFn]) => {
            // Normal
            animations[`diagonal_multi_${cornerName}_${config.name}`] = {
                on: () => {
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const distance = distFn(targetX, targetY);
                            setLoopTimeout(() => applyMultiFade([targetX, targetY]), distance * 60);
                        }
                    }
                },
                type: 'fixed'
            };
        });

        // 12. ROTATE_MULTI: Color transitioning rotation
        const rotationStarts = { 'top': -Math.PI / 2, 'right': 0, 'bottom': Math.PI / 2, 'left': Math.PI };
        Object.entries(rotationStarts).forEach(([dirName, startAngle]) => {
            // CW
            animations[`rotate_cw_${dirName}_multi_${config.name}`] = {
                on: () => {
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - 3.5;
                            const dy = targetY - 3.5;
                            const angle = Math.atan2(dy, dx);
                            let shiftedAngle = angle - startAngle;
                            while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                            const normalizedAngle = shiftedAngle / (2 * Math.PI);
                            setLoopTimeout(() => applyMultiFade([targetX, targetY]), normalizedAngle * 600);
                        }
                    }
                },
                type: 'fixed'
            };
            // CCW
            animations[`rotate_ccw_${dirName}_multi_${config.name}`] = {
                on: () => {
                    for (let targetY = 0; targetY < 8; targetY++) {
                        for (let targetX = 0; targetX < 8; targetX++) {
                            const dx = targetX - 3.5;
                            const dy = targetY - 3.5;
                            const angle = Math.atan2(dy, dx);
                            let shiftedAngle = startAngle - angle;
                            while (shiftedAngle < 0) shiftedAngle += 2 * Math.PI;
                            const normalizedAngle = shiftedAngle / (2 * Math.PI);
                            setLoopTimeout(() => applyMultiFade([targetX, targetY]), normalizedAngle * 600);
                        }
                    }
                },
                type: 'fixed'
            };
        });

        // 13. RING_MULTI: Expanding shockwave from the center (multi-color)
        animations[`ring_center_multi_${config.name}`] = {
            on: () => {
                const cx = 3.5, cy = 3.5;
                for (let ty = 0; ty < 8; ty++) {
                    for (let tx = 0; tx < 8; tx++) {
                        const dist = Math.sqrt(Math.pow(tx - cx, 2) + Math.pow(ty - cy, 2));
                        const delay = dist * 70;
                        setLoopTimeout(() => applyMultiFade([tx, ty]), delay);
                    }
                }
            },
            type: 'fixed'
        };

        // 14. SCANLINE_MULTI: Multi-color grid sweeps
        animations[`scan_h_multi_${config.name}`] = {
            on: (x, y) => {
                for (let ty = 0; ty < 8; ty++) {
                    const delay = Math.abs(ty - y) * 70;
                    setLoopTimeout(() => {
                        for (let tx = 0; tx < 8; tx++) {
                            applyMultiFade([tx, ty]);
                        }
                    }, delay);
                }
            },
            type: 'fixed'
        };

        animations[`scan_v_multi_${config.name}`] = {
            on: (x, y) => {
                for (let tx = 0; tx < 8; tx++) {
                    const delay = Math.abs(tx - x) * 70;
                    setLoopTimeout(() => {
                        for (let ty = 0; ty < 8; ty++) {
                            applyMultiFade([tx, ty]);
                        }
                    }, delay);
                }
            },
            type: 'fixed'
        };

        // 15. RAIN_MULTI: Multi-color falling pixels
        animations[`rain_multi_${config.name}`] = {
            on: (x, y) => {
                for (let ty = y; ty < 8; ty++) {
                    const delay = (ty - y) * 100;
                    setLoopTimeout(() => applyMultiFade([x, ty]), delay);
                }
            },
            type: 'fixed'
        };

        animations[`rain_multi_up_${config.name}`] = {
            on: (x, y) => {
                for (let ty = y; ty >= 0; ty--) {
                    const delay = (y - ty) * 100;
                    setLoopTimeout(() => applyMultiFade([x, ty]), delay);
                }
            },
            type: 'fixed'
        };

        // 15b. MATRIX_RAIN_MULTI: Global falling rain on all columns
        animations[`matrix_rain_multi_${config.name}`] = {
            on: () => {
                for (let tx = 0; tx < 8; tx++) {
                    const startDelay = Math.random() * 400;
                    const speed = 80 + Math.random() * 60;
                    setLoopTimeout(() => {
                        for (let ty = 0; ty < 8; ty++) {
                            const stepDelay = ty * speed;
                            setLoopTimeout(() => applyMultiFade([tx, ty]), stepDelay);
                        }
                    }, startDelay);
                }
            },
            type: 'fixed'
        };

        // 16. SPARKLE_MULTI: Multi-color random pixels across the grid
        animations[`sparkle_multi_${config.name}`] = {
            on: () => {
                for (let i = 0; i < 20; i++) {
                    const delay = Math.random() * 800;
                    const tx = Math.floor(Math.random() * 8);
                    const ty = Math.floor(Math.random() * 8);
                    setLoopTimeout(() => applyMultiFade([tx, ty]), delay);
                }
            },
            type: 'fixed'
        };

        // 17. BOUNCE_MULTI: Multi-color border bounce
        animations[`bounce_multi_${config.name}`] = {
            on: (x, y) => {
                const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                directions.forEach(([dx, dy]) => {
                    for (let step = 0; step < 8; step++) {
                        const tx = x + dx * step;
                        const ty = y + dy * step;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            setLoopTimeout(() => applyMultiFade([tx, ty]), step * 60);
                        } else {
                            const lastValidStep = step - 1;
                            for (let bStep = 1; bStep <= lastValidStep; bStep++) {
                                const bx = x + dx * (lastValidStep - bStep);
                                const by = y + dy * (lastValidStep - bStep);
                                setLoopTimeout(() => applyMultiFade([bx, by]), (step + bStep) * 60);
                            }
                            break;
                        }
                    }
                });
            },
            type: 'fixed'
        };

        // 18. SNAKE_MULTI: Multi-color square spiral from center
        animations[`snake_multi_${config.name}`] = {
            on: () => {
                let tx = 3, ty = 3;
                let delay = 0;
                applyMultiFade([tx, ty]);

                const move = (dx, dy, steps) => {
                    for (let i = 0; i < steps; i++) {
                        tx += dx;
                        ty += dy;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            const p = [tx, ty];
                            delay += 40;
                            setLoopTimeout(() => applyMultiFade(p), delay);
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
            },
            type: 'fixed'
        };

        // 19. DNA_HELIX_MULTI: Eliminata su richiesta utente

        // 20. WARP_SPEED_MULTI: Explosion from center to corners
        animations[`warp_speed_multi_${config.name}`] = {
            on: () => {
                const centers = [[3, 3], [3, 4], [4, 3], [4, 4]];
                const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
                centers.forEach((c, i) => {
                    const [dx, dy] = directions[i];
                    for (let step = 0; step < 4; step++) {
                        const tx = c[0] + dx * step;
                        const ty = c[1] + dy * step;
                        setLoopTimeout(() => applyMultiFade([tx, ty]), step * 80);
                    }
                });
            },
            type: 'fixed'
        };

        // 21. SNAKE_COLLISION_MULTI: Two snakes colliding at center
        animations[`snake_collision_multi_${config.name}`] = {
            on: () => {
                const path1 = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3]];
                const path2 = [[7, 7], [6, 7], [5, 7], [4, 7], [4, 6], [4, 5], [4, 4]];
                path1.forEach((p, i) => {
                    setLoopTimeout(() => applyMultiFade(p), i * 100);
                });
                path2.forEach((p, i) => {
                    setLoopTimeout(() => applyMultiFade(p), i * 100);
                });
                // Collision flash
                setLoopTimeout(() => {
                    const flash = [[3, 3], [3, 4], [4, 3], [4, 4]];
                    flash.forEach(p => applyMultiFade(p));
                }, path1.length * 100);
            },
            type: 'fixed'
        };

        // 22. EQ_SPECTRUM_MULTI: Columns jump to random heights
        animations[`eq_spectrum_multi_${config.name}`] = {
            on: () => {
                for (let tx = 0; tx < 8; tx++) {
                    const height = Math.floor(Math.random() * 7) + 1;
                    for (let ty = 7; ty >= 8 - height; ty--) {
                        setLoopTimeout(() => applyMultiFade([tx, ty]), (7 - ty) * 40);
                    }
                }
            },
            type: 'fixed'
        };

        // 23. STROBE_BURST_MULTI: Rapid grid flashes with color transition
        animations[`strobe_burst_multi_${config.name}`] = {
            on: () => {
                const lpOff = getLpColor('off');
                for (let flashIdx = 0; flashIdx < 4; flashIdx++) {
                    const delay = flashIdx * 120;
                    setLoopTimeout(() => {
                        const colorConfig = config.sequence[Math.min(flashIdx, config.sequence.length - 1)];
                        const webColor = webColorMap[colorConfig.color][colorConfig.level];
                        const physColor = getLpColor(colorConfig.color, colorConfig.level);
                        for (let ty = 0; ty < 8; ty++) {
                            for (let tx = 0; tx < 8; tx++) {
                                setWebColor(webColor, [tx, ty]);
                                setPhysicalColor(physColor, [tx, ty]);
                            }
                        }
                        setLoopTimeout(() => {
                            for (let ty = 0; ty < 8; ty++) {
                                for (let tx = 0; tx < 8; tx++) {
                                    setWebColor('off', [tx, ty]);
                                    setPhysicalColor(lpOff, [tx, ty]);
                                }
                            }
                        }, 50);
                    }, delay);
                }
            },
            type: 'fixed'
        };

        // 24. EQ_BOUNCE_MULTI: Solid columns with fixed gradient (Green -> Amber -> Red)
        animations[`eq_bounce_multi_${config.name}`] = {
            on: () => {
                const lpOff = getLpColor('off');
                for (let tx = 0; tx < 8; tx++) {
                    const height = Math.floor(Math.random() * 7) + 1;
                    const peakRow = 8 - height;
                    const speed = 40;
                    const hold = 100;

                    // Funzione per ottenere il colore in base all'altezza (riga)
                    // riga 7,6: verde | riga 5,4,3: arancione | riga 2,1,0: rosso
                    const getGradientColor = (row) => {
                        if (row >= 6) return { lp: getLpColor('green'), web: webColorMap['green'].full };
                        if (row >= 3) return { lp: getLpColor('amber'), web: webColorMap['amber'].full };
                        return { lp: getLpColor('red'), web: webColorMap['red'].full };
                    };

                    // Rise: Accende i pixel con il gradiente
                    for (let ty = 7; ty >= peakRow; ty--) {
                        setLoopTimeout(() => {
                            const color = getGradientColor(ty);
                            setWebColor(color.web, [tx, ty]);
                            setPhysicalColor(color.lp?.full, [tx, ty]);
                        }, (7 - ty) * speed);
                    }

                    // Fall: Spegne i pixel
                    for (let ty = peakRow; ty <= 7; ty++) {
                        const fallDelay = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                        setLoopTimeout(() => {
                            setWebColor('off', [tx, ty]);
                            setPhysicalColor(lpOff, [tx, ty]);
                        }, fallDelay);
                    }
                }
            },
            type: 'fixed'
        };

        // 25. EQ_PEAK_HOLD_MULTI: Columns with fixed gradient and peak hold
        animations[`eq_peak_hold_multi_${config.name}`] = {
            on: () => {
                const lpOff = getLpColor('off');
                const speed = 30;
                const peakHold = 400;

                const getGradientColor = (row) => {
                    if (row >= 6) return { lp: getLpColor('green'), web: webColorMap['green'].full };
                    if (row >= 3) return { lp: getLpColor('amber'), web: webColorMap['amber'].full };
                    return { lp: getLpColor('red'), web: webColorMap['red'].full };
                };

                for (let tx = 0; tx < 8; tx++) {
                    const height = Math.floor(Math.random() * 7) + 1;
                    const peakRow = 8 - height;

                    // Rise
                    for (let ty = 7; ty >= peakRow; ty--) {
                        setLoopTimeout(() => {
                            const color = getGradientColor(ty);
                            setWebColor(color.web, [tx, ty]);
                            setPhysicalColor(color.lp?.full, [tx, ty]);
                        }, (7 - ty) * speed);
                    }

                    // Fast Fall (all except peak)
                    for (let ty = peakRow + 1; ty <= 7; ty++) {
                        const fallDelay = (7 - peakRow) * speed + (ty - peakRow) * speed;
                        setLoopTimeout(() => {
                            setWebColor('off', [tx, ty]);
                            setPhysicalColor(lpOff, [tx, ty]);
                        }, fallDelay);
                    }

                    // Peak Fall (stays longer)
                    const peakFallDelay = (7 - peakRow) * speed + peakHold;
                    setLoopTimeout(() => {
                        setWebColor('off', [tx, peakRow]);
                        setPhysicalColor(lpOff, [tx, peakRow]);
                    }, peakFallDelay);
                }
            },
            type: 'fixed'
        };

        // 25. VORTEX_MULTI: Eliminato su richiesta utente

        // Default aliases for rotate_multi
        animations[`rotate_cw_multi_${config.name}`] = animations[`rotate_cw_left_multi_${config.name}`];
        animations[`rotate_ccw_multi_${config.name}`] = animations[`rotate_ccw_left_multi_${config.name}`];
    });

    // 26. TETRIS_FALLING: Random Tetris block falling with random color selection
    animations['tetris_falling'] = {
        on: () => {
            const colors = ['red', 'green', 'amber'];
            const colorName = colors[Math.floor(Math.random() * colors.length)];
            const baseColor = getLpColor(colorName);
            const lpOff = getLpColor('off');

            const shapes = [
                [[0, 0], [1, 0], [2, 0], [3, 0]], // I
                [[0, 0], [1, 0], [0, 1], [1, 1]], // O
                [[1, 0], [0, 1], [1, 1], [2, 1]], // T
                [[1, 0], [2, 0], [0, 1], [1, 1]], // S
                [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
                [[0, 0], [0, 1], [1, 1], [2, 1]], // J
                [[2, 0], [0, 1], [1, 1], [2, 1]]  // L
            ];

            let shape = shapes[Math.floor(Math.random() * shapes.length)];

            // Randomize rotation (0, 90, 180, 270 degrees)
            const rotations = Math.floor(Math.random() * 4);
            for (let i = 0; i < rotations; i++) {
                shape = shape.map(([x, y]) => [-y, x]);
            }

            // Normalize shape coordinates (bring to 0,0)
            const minX = Math.min(...shape.map(p => p[0]));
            const minY = Math.min(...shape.map(p => p[1]));
            shape = shape.map(([x, y]) => [x - minX, y - minY]);

            const shapeWidth = Math.max(...shape.map(p => p[0])) + 1;
            let curX = Math.floor(Math.random() * (8 - shapeWidth + 1));
            const speed = 150;

            let lastPositions = [];

            for (let curY = -2; curY < 10; curY++) {
                const delay = (curY + 2) * speed;

                // Pre-calculate next state
                let nextX = curX;
                if (curY >= 0 && curY < 7 && Math.random() > 0.8) {
                    const move = Math.random() > 0.5 ? 1 : -1;
                    if (curX + move >= 0 && curX + move + shapeWidth <= 8) {
                        nextX += move;
                    }
                }
                curX = nextX;
                const stepX = curX;
                const stepY = curY;

                setLoopTimeout(() => {
                    // 1. Clear last positions
                    lastPositions.forEach(([tx, ty]) => {
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            setWebColor('off', [tx, ty]);
                            setPhysicalColor(lpOff, [tx, ty]);
                        }
                    });

                    lastPositions = [];

                    // 2. Draw new positions
                    shape.forEach(([dx, dy]) => {
                        const tx = stepX + dx;
                        const ty = stepY + dy;
                        if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                            setWebColor(webColorMap[colorName].full, [tx, ty]);
                            setPhysicalColor(baseColor?.full, [tx, ty]);
                            lastPositions.push([tx, ty]);
                        }
                    });
                }, delay);
            }
        },
        type: 'fixed'
    };

    // 27. FIREWORK: Rocket climbs from bottom and explodes
    animations['firework'] = {
        on: () => {
            const colors = ['red', 'green', 'amber'];
            const mainColor = colors[Math.floor(Math.random() * colors.length)];
            const baseColor = getLpColor(mainColor);
            const lpOff = getLpColor('off');

            const startX = Math.floor(Math.random() * 8);
            const explodeY = 1 + Math.floor(Math.random() * 3); // Explodes at row 1, 2, or 3
            const climbSpeed = 80;

            // Phase 1: Climb
            for (let curY = 7; curY >= explodeY; curY--) {
                const delay = (7 - curY) * climbSpeed;
                const stepY = curY;
                setLoopTimeout(() => {
                    // Clear previous position
                    if (stepY < 7) {
                        setWebColor('off', [startX, stepY + 1]);
                        setPhysicalColor(lpOff, [startX, stepY + 1]);
                    }

                    // Draw current position
                    setWebColor(webColorMap[mainColor].full, [startX, stepY]);
                    setPhysicalColor(baseColor?.full, [startX, stepY]);

                    // If reached explosion point, start Phase 2
                    if (stepY === explodeY) {
                        setLoopTimeout(() => {
                            // Clear rocket head
                            setWebColor('off', [startX, stepY]);
                            setPhysicalColor(lpOff, [startX, stepY]);

                            // Explode!
                            const particles = [
                                [0, -1], [0, 1], [-1, 0], [1, 0], // Cross
                                [-1, -1], [1, -1], [-1, 1], [1, 1] // Diagonals
                            ];

                            particles.forEach(([dx, dy]) => {
                                const tx = startX + dx;
                                const ty = explodeY + dy;
                                if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                                    // Multi-color particles or single? Let's go with single for now but fast fade
                                    setWebColor(webColorMap[mainColor].full, [tx, ty]);
                                    setPhysicalColor(baseColor?.full, [tx, ty]);

                                    setLoopTimeout(() => {
                                        setWebColor('off', [tx, ty]);
                                        setPhysicalColor(lpOff, [tx, ty]);
                                    }, 300);
                                }
                            });

                            // Secondary explosion wave (optional, for "pop" effect)
                            setLoopTimeout(() => {
                                particles.forEach(([dx, dy]) => {
                                    const tx2 = startX + dx * 2;
                                    const ty2 = explodeY + dy * 2;
                                    if (tx2 >= 0 && tx2 < 8 && ty2 >= 0 && ty2 < 8) {
                                        setWebColor(webColorMap[mainColor].full, [tx2, ty2]);
                                        setPhysicalColor(baseColor?.full, [tx2, ty2]);

                                        setLoopTimeout(() => {
                                            setWebColor('off', [tx2, ty2]);
                                            setPhysicalColor(lpOff, [tx2, ty2]);
                                        }, 200);
                                    }
                                });
                            }, 150);

                        }, climbSpeed);
                    }
                }, delay);
            }
        },
        type: 'fixed'
    };

    // 28. HEART_FILL: Draws a heart shape with a top-to-bottom fill effect
    animations['heart_fill'] = {
        on: () => {
            const colorName = 'red';
            const baseColor = getLpColor(colorName);
            const lpOff = getLpColor('off');

            const heartPoints = [
                [1, 0], [2, 0], [5, 0], [6, 0],
                [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
                [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
                [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
                [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
                [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
                [2, 6], [3, 6], [4, 6], [5, 6],
                [3, 7], [4, 7]
            ];

            heartPoints.forEach(([tx, ty]) => {
                const delay = ty * 40 + (tx * 10);
                setLoopTimeout(() => {
                    setWebColor(webColorMap[colorName].full, [tx, ty]);
                    setPhysicalColor(baseColor?.full, [tx, ty]);
                    setLoopTimeout(() => {
                        setWebColor('off', [tx, ty]);
                        setPhysicalColor(lpOff, [tx, ty]);
                    }, 1000);
                }, delay);
            });
        },
        type: 'fixed'
    };

    // 29. HEART_SIMPLE: Instant appear and disappear
    animations['heart_simple'] = {
        on: () => {
            const colorName = 'red';
            const baseColor = getLpColor(colorName);
            const lpOff = getLpColor('off');

            const heartPoints = [
                [1, 0], [2, 0], [5, 0], [6, 0],
                [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
                [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
                [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
                [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
                [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
                [2, 6], [3, 6], [4, 6], [5, 6],
                [3, 7], [4, 7]
            ];

            heartPoints.forEach(([tx, ty]) => {
                setWebColor(webColorMap[colorName].full, [tx, ty]);
                setPhysicalColor(baseColor?.full, [tx, ty]);
                setLoopTimeout(() => {
                    setWebColor('off', [tx, ty]);
                    setPhysicalColor(lpOff, [tx, ty]);
                }, 1000);
            });
        },
        type: 'fixed'
    };

    // 30. HEART_WAVE: Expands from center and retracts to center
    animations['heart_wave'] = {
        on: () => {
            const colorName = 'red';
            const baseColor = getLpColor(colorName);
            const lpOff = getLpColor('off');

            const heartPoints = [
                [1, 0], [2, 0], [5, 0], [6, 0],
                [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1],
                [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
                [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
                [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
                [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
                [2, 6], [3, 6], [4, 6], [5, 6],
                [3, 7], [4, 7]
            ];

            // Center of the 8x8 grid is roughly (3.5, 3.5)
            const centerX = 3.5;
            const centerY = 3.5;

            heartPoints.forEach(([tx, ty]) => {
                // Distance from center determines the delay
                const dist = Math.sqrt(Math.pow(tx - centerX, 2) + Math.pow(ty - centerY, 2));
                const appearDelay = dist * 80;
                const disappearDelay = 1000 + ((5 - dist) * 80); // Retracts to center

                setLoopTimeout(() => {
                    setWebColor(webColorMap[colorName].full, [tx, ty]);
                    setPhysicalColor(baseColor?.full, [tx, ty]);

                    setLoopTimeout(() => {
                        setWebColor('off', [tx, ty]);
                        setPhysicalColor(lpOff, [tx, ty]);
                    }, disappearDelay - appearDelay);
                }, appearDelay);
            });
        },
        type: 'fixed'
    };

    // 31. ALPHABET: Displays letters A-Z
    colors.forEach(colorName => {
        Object.entries(alphabetCoords).forEach(([letter, coords]) => {
            animations[`letter_${letter}_${colorName}`] = {
                on: () => {
                    const color = webColorMap[colorName].full;
                    const lpColor = getLpColor(colorName);
                    coords.forEach(([tx, ty]) => {
                        setWebColor(color, [tx, ty]);
                        setPhysicalColor(lpColor, [tx, ty]);
                    });
                },
                off: () => {
                    const lpOff = getLpColor('off');
                    coords.forEach(([tx, ty]) => {
                        setWebColor('off', [tx, ty]);
                        setPhysicalColor(lpOff, [tx, ty]);
                    });
                },
                type: 'momentary'
            };
        });
    });

    // 32. NUMBERS: Displays numbers 0-9
    colors.forEach(colorName => {
        Object.entries(numberCoords).forEach(([number, coords]) => {
            animations[`number_${number}_${colorName}`] = {
                on: () => {
                    const color = webColorMap[colorName].full;
                    const lpColor = getLpColor(colorName);
                    coords.forEach(([tx, ty]) => {
                        setWebColor(color, [tx, ty]);
                        setPhysicalColor(lpColor, [tx, ty]);
                    });
                },
                off: () => {
                    const lpOff = getLpColor('off');
                    coords.forEach(([tx, ty]) => {
                        setWebColor('off', [tx, ty]);
                        setPhysicalColor(lpOff, [tx, ty]);
                    });
                },
                type: 'momentary'
            };
        });
    });

    // 33. SYMBOLS: Displays symbols like ? and !
    colors.forEach(colorName => {
        Object.entries(symbolCoords).forEach(([symbol, coords]) => {
            animations[`symbol_${symbol}_${colorName}`] = {
                on: () => {
                    const color = webColorMap[colorName].full;
                    const lpColor = getLpColor(colorName);
                    coords.forEach(([tx, ty]) => {
                        setWebColor(color, [tx, ty]);
                        setPhysicalColor(lpColor, [tx, ty]);
                    });
                },
                off: () => {
                    const lpOff = getLpColor('off');
                    coords.forEach(([tx, ty]) => {
                        setWebColor('off', [tx, ty]);
                        setPhysicalColor(lpOff, [tx, ty]);
                    });
                },
                type: 'momentary'
            };
        });
    });
};

// Initialize the library
createAnimationLibrary();

/**
 * Triggers an animation by name at specific coordinates.
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 */
export function triggerAnimation(name, x, y) {
    const anim = animations[name];
    if (anim && anim.on) {
        anim.on(x, y);
        // Ensure changes are sent immediately for non-loop animations
        flushPhysicalColors();
    }
}

/**
 * Releases an animation (stops it if it's momentary).
 * @param {string} name - The name of the animation in the registry.
 * @param {number} x - The X coordinate (0-7).
 * @param {number} y - The Y coordinate (0-7).
 */
export function releaseAnimation(name, x, y) {
    const anim = animations[name];
    if (anim && anim.type === 'momentary' && anim.off) {
        anim.off(x, y);
        // Ensure changes are sent immediately for non-loop animations
        flushPhysicalColors();
    }
}
