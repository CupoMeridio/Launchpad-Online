import { fader } from '../animationEngine.js';
import { alphabetCoords, numberCoords, numberCoordsBold, symbolCoords } from '../animationData.js';

export function register(animations, colors) {
    const characterGroups = [
        { prefix: 'letter', coords: alphabetCoords },
        { prefix: 'number', coords: numberCoords },
        { prefix: 'number_bold', coords: numberCoordsBold },
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
