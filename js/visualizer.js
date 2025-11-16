/**
 * =============================================================================
 * VISUALIZER MODULE (visualizer.js)
 * =============================================================================
 * 
 * This module defines the `Visualizer` class, responsible for creating
 * and animating the audio visualizer.
 * It uses data from an `AnalyserNode` (from `audio.js`) to draw
 * frequency bars on two HTML5 `<canvas>` elements in real time.
 */

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
        // Create an 8-bit integer array (values 0–255) to hold frequency data.
        this.dataArray = new Uint8Array(this.bufferLength);

        // Set an initial display mode.
        this.mode = 'both'; 
        this.isSymmetric = false;

        // Customization settings
        this.color1 = '#00aaff';
        this.color2 = '#00aaff';
        this.gradientDirection = 'vertical';
        this.alpha = 0.6;
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
        this.canvasTop.width = window.innerWidth;
        this.canvasTop.height = window.innerHeight * 0.25;
        
        this.canvasBottom.width = window.innerWidth;
        this.canvasBottom.height = window.innerHeight * 0.25;
    }

    /**
     * Sets the display mode.
     * @param {string} mode - Mode to set ('off', 'top', 'bottom', 'both').
     */
    setMode(mode) {
        this.mode = mode;
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);
        window.dispatchEvent(new CustomEvent('visualizer:mode', { detail: { mode } }));
    }

    setSymmetric(enabled) {
        this.isSymmetric = !!enabled;
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
    }

    /**
     * Sets gradient direction.
     * @param {string} direction - 'vertical', 'horizontal', etc.
     */
    setGradientDirection(direction) {
        this.gradientDirection = direction;
    }

    /**
     * Sets visualizer transparency.
     * @param {number} alpha - Transparency value from 0 to 1.
     */
    setAlpha(alpha) {
        this.alpha = alpha;
    }

    /**
     * Main drawing loop (animation).
     */
    draw() {
        requestAnimationFrame(() => this.draw());

        if (this.mode === 'off') return;

        this.analyser.getByteFrequencyData(this.dataArray);

        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);

        const barWidth = (this.canvasBottom.width / this.bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        if (this.isSymmetric) {
            const spacing = 2;
            const halfLength = Math.floor(this.bufferLength / 2);

            if (this.mode === 'bottom' || this.mode === 'both') {
                const width = this.canvasBottom.width;
                const center = width / 2;
                const barW = Math.max(1, (width / this.bufferLength) - spacing);

                const createGradientBottom = (y1, y2) => {
                    let grad;
                    switch (this.gradientDirection) {
                        case 'horizontal':
                            grad = this.ctxBottom.createLinearGradient(0, 0, width, 0);
                            break;
                        case 'horizontal-reverse':
                            grad = this.ctxBottom.createLinearGradient(width, 0, 0, 0);
                            break;
                        case 'vertical-reverse':
                            grad = this.ctxBottom.createLinearGradient(0, y2, 0, y1);
                            break;
                        default:
                            grad = this.ctxBottom.createLinearGradient(0, y1, 0, y2);
                            break;
                    }
                    grad.addColorStop(0, this.hexToRgba(this.color1, this.alpha));
                    grad.addColorStop(1, this.hexToRgba(this.color2, this.alpha));
                    return grad;
                };

                for (let i = 0; i < halfLength; i++) {
                    barHeight = this.dataArray[i] * 0.7;
                    const xLeft = center - (i + 1) * (barW + spacing);
                    const xRight = center + i * (barW + spacing);
                    const grad = createGradientBottom(this.canvasBottom.height, this.canvasBottom.height - barHeight);
                    this.ctxBottom.fillStyle = grad;
                    this.ctxBottom.fillRect(xLeft, this.canvasBottom.height - barHeight, barW, barHeight);
                    this.ctxBottom.fillRect(xRight, this.canvasBottom.height - barHeight, barW, barHeight);
                }
            }

            if (this.mode === 'top' || this.mode === 'both') {
                const width = this.canvasTop.width;
                const center = width / 2;
                const barW = Math.max(1, (width / this.bufferLength) - spacing);

                const createGradientTop = (y1, y2) => {
                    let grad;
                    switch (this.gradientDirection) {
                        case 'horizontal':
                            grad = this.ctxTop.createLinearGradient(0, 0, width, 0);
                            break;
                        case 'horizontal-reverse':
                            grad = this.ctxTop.createLinearGradient(width, 0, 0, 0);
                            break;
                        case 'vertical-reverse':
                            grad = this.ctxTop.createLinearGradient(0, y2, 0, y1);
                            break;
                        default:
                            grad = this.ctxTop.createLinearGradient(0, y1, 0, y2);
                            break;
                    }
                    grad.addColorStop(0, this.hexToRgba(this.color1, this.alpha));
                    grad.addColorStop(1, this.hexToRgba(this.color2, this.alpha));
                    return grad;
                };

                for (let i = 0; i < halfLength; i++) {
                    barHeight = this.dataArray[i] * 0.7;
                    const xLeft = center - (i + 1) * (barW + spacing);
                    const xRight = center + i * (barW + spacing);
                    const grad = createGradientTop(0, barHeight);
                    this.ctxTop.fillStyle = grad;
                    this.ctxTop.fillRect(xLeft, 0, barW, barHeight);
                    this.ctxTop.fillRect(xRight, 0, barW, barHeight);
                }
            }
            return;
        }

        for (let i = 0; i < this.bufferLength; i++) {
            barHeight = this.dataArray[i] * 0.7;

        // Create fill style (gradient or single color)
            const createGradient = (ctx, y1, y2) => {
                let grad;
                switch (this.gradientDirection) {
                    case 'horizontal':
                        grad = ctx.createLinearGradient(0, 0, this.canvasBottom.width, 0);
                        break;
                    case 'horizontal-reverse':
                        grad = ctx.createLinearGradient(this.canvasBottom.width, 0, 0, 0);
                        break;
                    case 'vertical-reverse':
                        grad = ctx.createLinearGradient(0, y2, 0, y1);
                        break;
                    default: // vertical
                        grad = ctx.createLinearGradient(0, y1, 0, y2);
                        break;
                }
                grad.addColorStop(0, this.hexToRgba(this.color1, this.alpha));
                grad.addColorStop(1, this.hexToRgba(this.color2, this.alpha));
                return grad;
            };

            // Draw on bottom canvas
            if (this.mode === 'bottom' || this.mode === 'both') {
                const grad = createGradient(this.ctxBottom, this.canvasBottom.height, this.canvasBottom.height - barHeight);
                this.ctxBottom.fillStyle = grad;
                this.ctxBottom.fillRect(x, this.canvasBottom.height - barHeight, barWidth, barHeight);
            }

            // Draw on top canvas
            if (this.mode === 'top' || this.mode === 'both') {
                const grad = createGradient(this.ctxTop, 0, barHeight);
                this.ctxTop.fillStyle = grad;
                this.ctxTop.fillRect(x, 0, barWidth, barHeight);
            }

            x += barWidth + 2;
        }
    }
}
