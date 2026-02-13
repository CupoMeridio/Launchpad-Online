import { fader, activeAnimations } from '../animationEngine.js';
import { MatrixRainAnimation, StrobeBurstAnimation } from '../animationClasses.js';

export function register(animations, colors) {
    colors.forEach(colorName => {
        // BASIC FADE
        animations[`fade_${colorName}`] = {
            on: (x, y, duration) => fader.add([x, y], colorName, duration),
            type: 'fixed'
        };

        // HOLD (Momentary version of fade)
        animations[`hold_${colorName}`] = {
            on: (x, y) => fader.add([x, y], colorName, 999999, 'instant'),
            off: (x, y) => fader.add([x, y], 'off', 0, 'instant'),
            type: 'momentary'
        };

        // MATRIX RAIN
        animations[`matrix_rain_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration, 'down'));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_up_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration, 'up'));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_left_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration, 'left'));
            },
            type: 'fixed'
        };

        animations[`matrix_rain_right_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration, 'right'));
            },
            type: 'fixed'
        };

        // STROBE_BURST
        animations[`strobe_burst_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new StrobeBurstAnimation(colorName, duration));
            },
            type: 'fixed'
        };
    });
}
