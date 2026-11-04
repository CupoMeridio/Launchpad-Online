/**
 * ANIMATION CLASSES (animationClasses.js)
 * 
 * Contains various animation logic classes.
 */

import { fader } from './animationEngine.js';
import { alphabetCoords, numberCoords, symbolCoords } from './animationData.js';

export class BaseMatrixRainAnimation {
    constructor(duration, direction = 'down') {
        this.startTime = performance.now();
        this.baseDuration = 1450;
        this.factor = duration ? duration / this.baseDuration : 1;
        this.direction = direction; // 'down', 'up', 'left', 'right'

        // Pre-calculate per-line physics (columns or rows depending on direction)
        this.lines = [];
        for (let i = 0; i < 8; i++) {
            this.lines.push({
                delay: Math.random() * 500 * this.factor,
                speed: (70 + Math.random() * 50) * this.factor,
                lastIdx: -1 // Tracks which row/col was last triggered
            });
        }
    }

    _triggerCell(x, y, fadeDuration) {
        // Implemented by subclasses
    }

    update(now) {
        let activeCount = 0;
        const elapsed = now - this.startTime;

        for (let i = 0; i < 8; i++) {
            const line = this.lines[i];
            const lineTime = elapsed - line.delay;

            if (lineTime > 0) {
                // Determine which index should be active at this time
                const currentIdx = Math.floor(lineTime / line.speed);

                if (currentIdx < 8) {
                    activeCount++;
                    // Triggers fade only if a new cell is entered
                    if (currentIdx > line.lastIdx) {
                        const fadeDuration = line.speed * 4;
                        let x, y;

                        if (this.direction === 'down') {
                            x = i; y = currentIdx;
                        } else if (this.direction === 'up') {
                            x = i; y = 7 - currentIdx;
                        } else if (this.direction === 'right') {
                            x = currentIdx; y = i;
                        } else if (this.direction === 'left') {
                            x = 7 - currentIdx; y = i;
                        }

                        this._triggerCell(x, y, fadeDuration);
                        line.lastIdx = currentIdx;
                    }
                }
            } else {
                activeCount++; // Waiting to start
            }
        }

        return activeCount === 0; // Finished when all lines are done
    }
}

export class MatrixRainAnimation extends BaseMatrixRainAnimation {
    constructor(colorName, duration, direction = 'down') {
        super(duration, direction);
        this.colorName = colorName;
    }

    _triggerCell(x, y, fadeDuration) {
        fader.add([x, y], this.colorName, fadeDuration, 'standard');
    }
}

export class MatrixRainMultiAnimation extends BaseMatrixRainAnimation {
    constructor(config, duration, direction = 'down') {
        super(duration, direction);
        this.config = config;
    }

    _triggerCell(x, y, fadeDuration) {
        fader.add([x, y], null, fadeDuration, 'multi', this.config);
    }
}

export class BaseStrobeBurstAnimation {
    constructor(duration) {
        this.startTime = performance.now();
        this.totalDuration = duration || 480;
        this.flashInterval = this.totalDuration / 4;
        this.flashDuration = this.flashInterval * 0.4;

        this.currentFlashIdx = 0;
        this.state = 'waiting'; // waiting, on, off
    }

    _triggerFlashForIndex(flashIndex) {
        // Implemented by subclasses
    }

    _fillGrid(colorName) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                fader.add([x, y], colorName, this.flashDuration, 'instant');
            }
        }
    }

    update(now) {
        const elapsed = now - this.startTime;
        const targetFlashIdx = Math.floor(elapsed / this.flashInterval);

        if (targetFlashIdx >= 4) return true; // Finished

        // Checks if a new flash cycle has started
        if (targetFlashIdx > this.currentFlashIdx) {
            this.currentFlashIdx = targetFlashIdx;
            this.state = 'waiting';
        }

        const flashLocalTime = elapsed % this.flashInterval;

        if (this.state === 'waiting') {
            if (flashLocalTime < this.flashDuration) {
                this._triggerFlashForIndex(this.currentFlashIdx);
                this.state = 'on';
            }
        }

        return false;
    }
}

export class StrobeBurstAnimation extends BaseStrobeBurstAnimation {
    constructor(colorName, duration) {
        super(duration);
        this.colorName = colorName;
    }

    _triggerFlashForIndex() {
        this._fillGrid(this.colorName);
    }
}

export class StrobeBurstMultiAnimation extends BaseStrobeBurstAnimation {
    constructor(config, duration) {
        super(duration);
        this.config = config;
    }

    _triggerFlashForIndex(flashIndex) {
        const colorConfig = this.config.sequence[Math.min(flashIndex, this.config.sequence.length - 1)];
        this._fillGrid(colorConfig.color);
    }
}

/**
 * TextAnimation displays a string of characters sequentially.
 * Each character is shown one at a time, synchronized with the total duration.
 */
export class TextAnimation {
    constructor(text, colorName, duration) {
        this.startTime = performance.now();
        this.text = text.toLowerCase();
        this.colorName = colorName;
        this.totalDuration = duration || 1000;
        
        // Calculate duration per character
        this.charDuration = this.totalDuration / this.text.length;
        this.currentCharIdx = -1;
    }

    update(now) {
        const elapsed = now - this.startTime;
        const targetCharIdx = Math.floor(elapsed / this.charDuration);

        // Finished when all characters have been processed
        if (targetCharIdx >= this.text.length) {
            return true;
        }

        // Show next character if it's time
        if (targetCharIdx > this.currentCharIdx) {
            this.currentCharIdx = targetCharIdx;
            const char = this.text[this.currentCharIdx];
            
            // Get coordinates for the character
            const coords = alphabetCoords[char] || numberCoords[char] || symbolCoords[char];
            
            if (coords) {
                // Display each pixel of the character
                coords.forEach(([tx, ty]) => {
                    // Use 'instant' mode to show the character for its specific duration
                    fader.add([tx, ty], this.colorName, this.charDuration, 'instant');
                });
            }
        }

        return false;
    }
}

/**
 * ScrollingTextAnimation scrolls a string of characters in a specified direction.
 * The entire word moves across the grid.
 */
export class ScrollingTextAnimation {
    constructor(text, colorName, duration, direction = 'left') {
        this.startTime = performance.now();
        this.text = text.toLowerCase();
        this.colorName = colorName;
        this.totalDuration = duration || 3000;
        this.direction = direction; // 'left', 'right', 'up', 'down'

        // Determine total distance based on direction
        if (this.direction === 'left' || this.direction === 'right') {
            this.totalDistance = this.text.length * 8 + 8;
        } else {
            // For vertical scrolling, characters are stacked or scrolled one by one.
            // Usually vertical scroll involves the whole word moving up/down.
            // As the grid is only 8 high, characters are stacked vertically.
            this.totalDistance = this.text.length * 8 + 8;
        }

        this.msPerPixel = this.totalDuration / this.totalDistance;
        this.lastOffset = null;
    }

    update(now) {
        const elapsed = now - this.startTime;
        const progress = Math.min(elapsed / this.totalDuration, 1);

        if (progress >= 1) return true;

        let currentOffset;
        if (this.direction === 'left') {
            currentOffset = Math.floor(8 - progress * this.totalDistance);
        } else if (this.direction === 'right') {
            currentOffset = Math.floor(-this.totalDistance + 8 + progress * this.totalDistance);
        } else if (this.direction === 'up') {
            currentOffset = Math.floor(8 - progress * this.totalDistance);
        } else if (this.direction === 'down') {
            currentOffset = Math.floor(-this.totalDistance + 8 + progress * this.totalDistance);
        }

        // Only update if the offset has changed to avoid redundant fader calls
        if (currentOffset !== this.lastOffset) {
            this.lastOffset = currentOffset;

            for (let i = 0; i < this.text.length; i++) {
                const char = this.text[i];
                if (char === ' ') continue; // Skip spaces

                const coords = alphabetCoords[char] || numberCoords[char] || symbolCoords[char];

                if (coords) {
                    coords.forEach(([tx, ty]) => {
                        let finalX, finalY;

                        if (this.direction === 'left' || this.direction === 'right') {
                            const charBaseX = i * 8;
                            finalX = tx + charBaseX + currentOffset;
                            finalY = ty;
                        } else {
                            // Vertical scroll: characters are stacked vertically
                            const charBaseY = i * 8;
                            finalX = tx;
                            finalY = ty + charBaseY + currentOffset;
                        }

                        // Only draw if within the 8x8 viewport
                        if (finalX >= 0 && finalX <= 7 && finalY >= 0 && finalY <= 7) {
                            // Duration is slightly longer than the time spent on one pixel to prevent flickering
                            fader.add([finalX, finalY], this.colorName, this.msPerPixel * 1.2, 'instant');
                        }
                    });
                }
            }
        }

        return false;
    }
}

/**
 * Generic class for animations that can be pre-calculated.
 */
export class PrecomputedAnimation {
    constructor(colorName, duration, generatorFn, onTrigger) {
        this.startTime = performance.now();
        this.colorName = colorName;
        // Check if generatorFn returns the events array directly or is a function
        if (typeof generatorFn === 'function') {
            this.events = generatorFn(duration);
        } else {
            this.events = generatorFn;
        }
        this.events.sort((a, b) => a.time - b.time);
        this.cursor = 0;
        this.onTrigger = onTrigger;
    }

    update(now) {
        const elapsed = now - this.startTime;

        while (this.cursor < this.events.length) {
            const event = this.events[this.cursor];
            if (elapsed >= event.time) {
                // Trigger event
                if (this.onTrigger) {
                    this.onTrigger(event, this.colorName);
                } else {
                    // Default behavior: FadeSystem
                    let mode = event.mode || 'standard';
                    fader.add(event.p, this.colorName, event.dur, mode);
                }
                this.cursor++;
            } else {
                break; // Next event is in the future
            }
        }

        return this.cursor >= this.events.length;
    }
}

/**
 * RealEQAnimation creates a realistic equalizer look with:
 * Green at the base (bottom), Amber in the middle, and Red at the top.
 */
export class RealEQAnimation {
    constructor(duration) {
        this.startTime = performance.now();
        this.totalDuration = duration || 1000;
        
        const baseSteps = 16;
        const speed = this.totalDuration / baseSteps;
        const hold = speed * 2;
        
        this.events = [];
        
        for (let tx = 0; tx < 8; tx++) {
            const height = Math.floor(Math.random() * 7) + 1;
            const peakRow = 8 - height;

            for (let ty = 7; ty >= peakRow; ty--) {
                const turnOnTime = (7 - ty) * speed;
                const turnOffTime = (7 - peakRow) * speed + hold + (ty - peakRow) * speed;
                const activeDur = turnOffTime - turnOnTime;
                
                // Determine color based on Y position (row)
                let color;
                if (ty <= 1) { // Top 2 rows
                    color = 'red';
                } else if (ty <= 4) { // Middle rows
                    color = 'amber';
                } else { // Bottom rows
                    color = 'green';
                }

                this.events.push({ p: [tx, ty], time: turnOnTime, dur: activeDur, color: color });
            }
        }
        
        this.events.sort((a, b) => a.time - b.time);
        this.cursor = 0;
    }

    update(now) {
        const elapsed = now - this.startTime;

        while (this.cursor < this.events.length) {
            const event = this.events[this.cursor];
            if (elapsed >= event.time) {
                fader.add(event.p, event.color, event.dur, 'instant');
                this.cursor++;
            } else {
                break;
            }
        }

        return this.cursor >= this.events.length;
    }
}
