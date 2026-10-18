import { fader } from '../animationEngine.js';

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
    });
}

