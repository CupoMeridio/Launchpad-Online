/**
 * VISUALIZER MODULE (visualizer.js)
 *
 * Defines the `Visualizer` class, responsible for creating
 * and animating the audio visualizer.
 * Uses data from an `AnalyserNode` (from `audio.js`) to draw
 * frequency bars on two HTML5 `<canvas>` elements in real time.
 */

import {
    DEFAULT_VISUALIZER_MODE,
    DEFAULT_VISUALIZER_COLOR,
    DEFAULT_VISUALIZER_GRADIENT_DIRECTION
} from './constants.js';

const BAR_SPACING = 2;
// Frequency values (0-255) are scaled so the tallest bar stays inside the canvas.
const BAR_HEIGHT_SCALE = 0.7;

/** Which canvases each display mode draws on, and which are mirrored. */
const EMPTY_LAYOUT = Object.freeze({ showTop: false, showBottom: false, mirrorTop: false, mirrorBottom: false });
const MODE_LAYOUTS = {
    top: { showTop: true },
    bottom: { showBottom: true },
    both: { showTop: true, showBottom: true },
    'top-mirror': { showTop: true, mirrorTop: true },
    'bottom-mirror': { showBottom: true, mirrorBottom: true },
    'both-mirror': { showTop: true, showBottom: true, mirrorTop: true, mirrorBottom: true }
};

export class Visualizer {
    /**
     * Constructs the visualizer instance.
     * @param {AnalyserNode} analyser - The Web Audio API analyser node to read data from.
     * @param {HTMLCanvasElement} canvasTop - The canvas element for the top visualization.
     * @param {HTMLCanvasElement} canvasBottom - The canvas element for the bottom visualization.
     */
    constructor(analyser, canvasTop, canvasBottom) {
        this.analyser = analyser;

        this.canvasTop = canvasTop;
        this.ctxTop = this.canvasTop.getContext('2d');

        this.canvasBottom = canvasBottom;
        this.ctxBottom = this.canvasBottom.getContext('2d');

        // Set initial canvas sizes and add a window resize listener.
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // `frequencyBinCount` is half of the analyser's `fftSize`.
        // It represents the number of frequency data "bins" available.
        this.bufferLength = this.analyser.frequencyBinCount;

        // Display a portion of the bins (the "musical range")
        // to avoid the silent high-frequency area at the end.
        this.displayPercentage = 0.70;
        this.displayLength = Math.floor(this.bufferLength * this.displayPercentage);

        // Create an 8-bit integer array (values 0–255) to hold frequency data.
        this.dataArray = new Uint8Array(this.bufferLength);

        // Set an initial display mode.
        this.mode = DEFAULT_VISUALIZER_MODE;
        this.isSymmetric = false;
        this.symmetryReverse = false;

        // Customization settings
        this.color1 = DEFAULT_VISUALIZER_COLOR;
        this.color2 = DEFAULT_VISUALIZER_COLOR;
        this.gradientDirection = DEFAULT_VISUALIZER_GRADIENT_DIRECTION;
        this.alpha = 0.6;

        // Pre-calculated gradients
        this.gradientTop = null;
        this.gradientBottom = null;
        this.needsGradientUpdate = true;

        // Bass pulse settings
        this.bassPulseEnabled = false;
        this.bassThreshold = 150;

        // Animation frame reference
        this.animationId = null;

        // Listen for external mode-change requests (e.g. from project.js on project load)
        // The visualizer is managed through visualizerManager.js to avoid global dependencies.
        window.addEventListener('visualizer:setMode', (e) => {
            if (e.detail?.mode) this.setMode(e.detail.mode);
        });
    }

    /**
     * Converts a hexadecimal color to RGBA format.
     * @param {string} hex - Hex color (e.g., '#RRGGBB').
     * @param {number} alpha - Transparency value (0–1).
     * @returns {string} - Color string in `rgba(r, g, b, alpha)` format.
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Resizes canvases to match window width and a fixed height.
     */
    resize() {
        const rectTop = this.canvasTop.getBoundingClientRect();
        const rectBottom = this.canvasBottom.getBoundingClientRect();
        const targetTopWidth = Math.round(rectTop.width);
        const targetTopHeight = Math.round(rectTop.height);
        const targetBottomWidth = Math.round(rectBottom.width);
        const targetBottomHeight = Math.round(rectBottom.height);

        let changed = false;
        if (this.canvasTop.width !== targetTopWidth) {
            this.canvasTop.width = targetTopWidth;
            changed = true;
        }
        if (this.canvasTop.height !== targetTopHeight) {
            this.canvasTop.height = targetTopHeight;
            changed = true;
        }
        if (this.canvasBottom.width !== targetBottomWidth) {
            this.canvasBottom.width = targetBottomWidth;
            changed = true;
        }
        if (this.canvasBottom.height !== targetBottomHeight) {
            this.canvasBottom.height = targetBottomHeight;
            changed = true;
        }

        if (changed) {
            this.needsGradientUpdate = true;
        }
    }

    /**
     * Sets the display mode.
     * @param {string} mode - Mode to set ('off', 'top', 'bottom', 'both').
     */
    setMode(mode) {
        const wasOff = this.mode === 'off';
        this.mode = mode;

        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);
        window.dispatchEvent(new CustomEvent('visualizer:mode', { detail: { mode } }));

        // Manage animation loop
        if (wasOff && mode !== 'off') {
            this.draw();
        } else if (mode === 'off' && this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setSymmetric(enabled) {
        this.isSymmetric = !!enabled;
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);
    }

    setSymmetryReverse(enabled) {
        this.symmetryReverse = !!enabled;
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);
    }

    /**
     * Sets animation smoothness.
     * @param {number} value - Value between 0 and 1 for `smoothingTimeConstant`.
     */
    setSmoothing(value) {
        this.analyser.smoothingTimeConstant = value;
    }

    /**
     * Sets colors for the visualizer.
     * @param {string} color1 - First color.
     * @param {string} color2 - Second color (optional, for gradient).
     */
    setColors(color1, color2) {
        this.color1 = color1;
        this.color2 = color2 || color1;
        this.needsGradientUpdate = true;
    }

    setGradientDirection(direction) {
        this.gradientDirection = direction;
        this.needsGradientUpdate = true;
    }

    setAlpha(alpha) {
        this.alpha = alpha;
        this.needsGradientUpdate = true;
    }

    setBassPulse(enabled) {
        this.bassPulseEnabled = !!enabled;
        if (!this.bassPulseEnabled) {
            const bg = document.querySelector('.background-media');
            if (bg) bg.style.transform = 'scale(1)';
        }
    }

    setBassThreshold(value) {
        this.bassThreshold = value;
    }

    updateGradients() {
        if (!this.needsGradientUpdate) return;

        const createGrad = (ctx, canvas, isTop) => {
            let grad;
            const w = canvas.width;
            const h = canvas.height;
            // The visualizer bars are scaled by 0.7 and the max data value is 255.
            // Using a factor of 0.35 - 0.4 ensures the color transition (midpoint) 
            // happens at about half the height of an average bar, 
            // making both colors clearly visible even at medium volumes.
            const maxBarHeight = Math.min(h, 255 * 0.35);

            switch (this.gradientDirection) {
                case 'horizontal':
                    grad = ctx.createLinearGradient(0, 0, w, 0);
                    break;
                case 'horizontal-reverse':
                    grad = ctx.createLinearGradient(w, 0, 0, 0);
                    break;
                case 'vertical-reverse':
                    if (isTop) {
                        // Top visualizer grows from 0 down. Reverse: color1 at tip, color2 at base (0)
                        grad = ctx.createLinearGradient(0, maxBarHeight, 0, 0);
                    } else {
                        // Bottom visualizer grows from h up. Reverse: color1 at tip, color2 at base (h)
                        grad = ctx.createLinearGradient(0, h - maxBarHeight, 0, h);
                    }
                    break;
                default: // vertical
                    if (isTop) {
                        // Top visualizer grows from 0 down. Vertical: color1 at base (0), color2 at tip
                        grad = ctx.createLinearGradient(0, 0, 0, maxBarHeight);
                    } else {
                        // Bottom visualizer grows from h up. Vertical: color1 at base (h), color2 at tip
                        grad = ctx.createLinearGradient(0, h, 0, h - maxBarHeight);
                    }
                    break;
            }
            grad.addColorStop(0, this.hexToRgba(this.color1, this.alpha));
            grad.addColorStop(1, this.hexToRgba(this.color2, this.alpha));
            return grad;
        };

        this.gradientTop = createGrad(this.ctxTop, this.canvasTop, true);
        this.gradientBottom = createGrad(this.ctxBottom, this.canvasBottom, false);
        this.needsGradientUpdate = false;
    }

    /**
     * Main drawing loop (animation).
     */
    draw() {
        if (this.mode === 'off') {
            this.animationId = null;
            return;
        }

        this.animationId = requestAnimationFrame(() => this.draw());

        this.updateGradients();
        this.analyser.getByteFrequencyData(this.dataArray);

        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);

        if (this.bassPulseEnabled) {
            this.applyBassPulse();
        }

        const layout = { ...EMPTY_LAYOUT, ...MODE_LAYOUTS[this.mode] };
        if (this.isSymmetric) {
            this.drawSymmetric(layout);
        } else {
            this.drawLinear(layout);
        }
    }

    /**
     * Scales the background media up to 5% with the bass level above the threshold.
     */
    applyBassPulse() {
        const bassBins = Math.max(1, Math.floor(this.displayLength * 0.05)); // 5% of displayed bins
        let bassSum = 0;
        for (let i = 0; i < bassBins; i++) {
            bassSum += this.dataArray[i];
        }
        const avgBass = bassSum / bassBins;

        const bg = document.querySelector('.background-media');
        if (!bg) return;
        if (avgBass > this.bassThreshold) {
            const intensity = (avgBass - this.bassThreshold) / (255 - this.bassThreshold);
            bg.style.transform = `scale(${1 + (intensity * 0.05)})`;
        } else {
            bg.style.transform = 'scale(1)';
        }
    }

    /**
     * The canvas, context and gradient of one side. Bars grow down from the
     * top edge on the top canvas, and up from the bottom edge on the bottom one.
     * @param {'top'|'bottom'} name
     */
    side(name) {
        return name === 'top'
            ? { ctx: this.ctxTop, canvas: this.canvasTop, gradient: this.gradientTop, growsDown: true }
            : { ctx: this.ctxBottom, canvas: this.canvasBottom, gradient: this.gradientBottom, growsDown: false };
    }

    fillBar(side, x, width, height) {
        const y = side.growsDown ? 0 : side.canvas.height - height;
        side.ctx.fillRect(x, y, width, height);
    }

    /**
     * Symmetric mode: bars spread from the centre to both edges.
     * @param {typeof EMPTY_LAYOUT} layout
     */
    drawSymmetric(layout) {
        const halfLength = Math.floor(this.displayLength / 2);
        if (layout.showBottom) this.drawSymmetricBars(this.side('bottom'), halfLength, layout.mirrorBottom);
        if (layout.showTop) this.drawSymmetricBars(this.side('top'), halfLength, layout.mirrorTop);
    }

    drawSymmetricBars(side, halfLength, mirrored) {
        const center = side.canvas.width / 2;
        const barWidth = Math.max(1, (side.canvas.width / this.displayLength) - BAR_SPACING);
        // Mirroring swaps whether low frequencies sit at the centre or at the edges.
        const lowAtEdges = this.symmetryReverse !== mirrored;

        side.ctx.fillStyle = side.gradient;
        for (let i = 0; i < halfLength; i++) {
            const sourceIndex = lowAtEdges ? (halfLength - 1 - i) : i;
            const barHeight = this.dataArray[sourceIndex] * BAR_HEIGHT_SCALE;
            this.fillBar(side, center - (i + 1) * (barWidth + BAR_SPACING), barWidth, barHeight);
            this.fillBar(side, center + i * (barWidth + BAR_SPACING), barWidth, barHeight);
        }
    }

    /**
     * Linear mode: bars from left to right (right to left when mirrored).
     * Both canvases share the bar width computed from the bottom canvas.
     * @param {typeof EMPTY_LAYOUT} layout
     */
    drawLinear(layout) {
        const bottom = this.side('bottom');
        const top = this.side('top');
        const barWidth = Math.max(1, (bottom.canvas.width - BAR_SPACING * (this.displayLength - 1)) / this.displayLength);

        if (layout.showBottom) bottom.ctx.fillStyle = bottom.gradient;
        if (layout.showTop) top.ctx.fillStyle = top.gradient;

        let x = 0;
        for (let i = 0; i < this.displayLength; i++) {
            const barHeight = this.dataArray[i] * BAR_HEIGHT_SCALE;
            if (layout.showBottom) {
                this.fillBar(bottom, layout.mirrorBottom ? (bottom.canvas.width - x - barWidth) : x, barWidth, barHeight);
            }
            if (layout.showTop) {
                this.fillBar(top, layout.mirrorTop ? (top.canvas.width - x - barWidth) : x, barWidth, barHeight);
            }
            x += barWidth + BAR_SPACING;
        }
    }
}
