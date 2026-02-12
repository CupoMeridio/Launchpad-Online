import { fader, activeAnimations } from '../animationEngine.js';
import { MatrixRainAnimation, StrobeBurstAnimation } from '../animationClasses.js';

export function register(animations, colors) {
    colors.forEach(colorName => {
        // 1. BASIC FADE
        animations[`fade_${colorName}`] = {
            on: (x, y, duration) => fader.add([x, y], colorName, duration),
            type: 'fixed'
        };

        // 3. MATRIX RAIN
        animations[`matrix_rain_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new MatrixRainAnimation(colorName, duration));
            },
            type: 'fixed'
        };

        // 19. STROBE_BURST
        animations[`strobe_burst_${colorName}`] = {
            on: (x, y, duration) => {
                activeAnimations.add(new StrobeBurstAnimation(colorName, duration));
            },
            type: 'fixed'
        };
    });
}
