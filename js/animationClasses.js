/**
 * ANIMATION CLASSES (animationClasses.js)
 * 
 * Contains various animation logic classes.
 */

import { fader, getLpColor, webColorMap } from './animationEngine.js';
import { alphabetCoords, numberCoords, symbolCoords } from './animationData.js';

export class MatrixRainAnimation {
    constructor(colorName, duration) {
        this.startTime = performance.now();
        this.colorName = colorName;
        this.baseDuration = 1340;
        this.factor = duration ? duration / this.baseDuration : 1;

        // Pre-calculate per-column physics
        this.columns = [];
        for (let x = 0; x < 8; x++) {
            this.columns.push({
                delay: Math.random() * 500 * this.factor,
                speed: (70 + Math.random() * 50) * this.factor,
                lastRow: -1 // Track which row we last triggered
            });
        }
    }

    update(now) {
        let activeCount = 0;
        const elapsed = now - this.startTime;

        for (let x = 0; x < 8; x++) {
            const col = this.columns[x];
            const colTime = elapsed - col.delay;

            if (colTime > 0) {
                // Determine which row should be active at this time
                const currentRow = Math.floor(colTime / col.speed);

                if (currentRow < 8) {
                    activeCount++;
                    // Only trigger fade if we entered a new row
                    if (currentRow > col.lastRow) {
                        const fadeDuration = col.speed * 2;
                        fader.add([x, currentRow], this.colorName, fadeDuration, 'standard');
                        col.lastRow = currentRow;
                    }
                }
            } else {
                activeCount++; // Waiting to start
            }
        }

        return activeCount === 0; // Finished when all columns are done
    }
}

export class StrobeBurstAnimation {
    constructor(colorName, duration) {
        this.startTime = performance.now();
        this.colorName = colorName;
        this.totalDuration = duration || 480;
        this.flashInterval = this.totalDuration / 4;
        this.flashDuration = this.flashInterval * 0.4;

        this.flashes = [0, 1, 2, 3]; // 4 flashes
        this.currentFlashIdx = 0;
        this.state = 'waiting'; // waiting, on, off
        this.flashEndTime = 0;

        this.baseColor = getLpColor(colorName);
        this.lpOff = getLpColor('off');
        this.webColors = webColorMap[colorName];
    }

    update(now) {
        const elapsed = now - this.startTime;
        const targetFlashIdx = Math.floor(elapsed / this.flashInterval);

        if (targetFlashIdx >= 4) return true; // Finished

        // Check if we entered a new flash cycle
        if (targetFlashIdx > this.currentFlashIdx) {
            this.currentFlashIdx = targetFlashIdx;
            this.state = 'waiting';
        }

        const flashLocalTime = elapsed % this.flashInterval;

        if (this.state === 'waiting') {
            if (flashLocalTime < this.flashDuration) {
                // TRIGGER FLASH ONCE
                this._triggerFlash();
                this.state = 'on';
            }
        }

        return false;
    }

    _triggerFlash() {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                fader.add([x, y], this.colorName, this.flashDuration, 'instant');
            }
        }
    }
}

export class StrobeBurstMultiAnimation {
    constructor(config, duration) {
        this.startTime = performance.now();
        this.config = config;
        this.totalDuration = duration || 480;
        this.flashInterval = this.totalDuration / 4;
        this.flashDuration = this.flashInterval * 0.4;

        this.currentFlashIdx = 0;
        this.state = 'waiting'; // waiting, on, off
        this.lpOff = getLpColor('off');
    }

    update(now) {
        const elapsed = now - this.startTime;
        const targetFlashIdx = Math.floor(elapsed / this.flashInterval);

        if (targetFlashIdx >= 4) return true; // Finished

        if (targetFlashIdx > this.currentFlashIdx) {
            this.currentFlashIdx = targetFlashIdx;
            this.state = 'waiting';
        }

        const flashLocalTime = elapsed % this.flashInterval;

        if (this.state === 'waiting') {
            if (flashLocalTime < this.flashDuration) {
                // TRIGGER FLASH
                const colorConfig = this.config.sequence[Math.min(this.currentFlashIdx, this.config.sequence.length - 1)];
                this._triggerFlash(colorConfig.color);
                this.state = 'on';
            }
        }

        return false;
    }

    _triggerFlash(colorName) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                fader.add([x, y], colorName, this.flashDuration, 'instant');
            }
        }
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

        // Finished when we've processed all characters
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
            // For vertical, we might want to stack characters or scroll them one by one?
            // Usually vertical scroll means the whole word moves up/down.
            // Since the grid is only 8 high, scrolling a whole word vertically 
            // means characters are stacked vertically.
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
