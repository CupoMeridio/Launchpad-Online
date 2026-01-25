/**
 * VISUALIZER MODULE (visualizer.js)
 *
 * Defines the `Visualizer` class, responsible for creating
 * and animating the audio visualizer.
 * Uses data from an `AnalyserNode` (from `audio.js`) to draw
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
        
        // Display a portion of the bins (the "musical range")
        // to avoid the silent high-frequency area at the end.
        this.displayPercentage = 0.70; 
        this.displayLength = Math.floor(this.bufferLength * this.displayPercentage);

        // Create an 8-bit integer array (values 0–255) to hold frequency data.
        this.dataArray = new Uint8Array(this.bufferLength);

        // Set an initial display mode.
        this.mode = 'both'; 
        this.isSymmetric = false;
        this.symmetryReverse = false;

        // Customization settings
        this.color1 = '#00aaff';
        this.color2 = '#00aaff';
        this.gradientDirection = 'vertical';
        this.alpha = 0.6;
        
        // Pre-calculated gradients
        this.gradientTop = null;
        this.gradientBottom = null;
        this.needsGradientUpdate = true;

        // Bass pulse settings
        this.bassPulseEnabled = false;
        this.bassThreshold = 150;
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

        this.canvasTop.width = rectTop.width;
        this.canvasTop.height = rectTop.height;
        
        this.canvasBottom.width = rectBottom.width;
        this.canvasBottom.height = rectBottom.height;

        this.needsGradientUpdate = true;
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

            switch (this.gradientDirection) {
                case 'horizontal':
                    grad = ctx.createLinearGradient(0, 0, w, 0);
                    break;
                case 'horizontal-reverse':
                    grad = ctx.createLinearGradient(w, 0, 0, 0);
                    break;
                case 'vertical-reverse':
                    if (isTop) {
                        // Top visualizer grows from 0 to h. Reverse: color1 at tip (h), color2 at base (0)
                        grad = ctx.createLinearGradient(0, h, 0, 0);
                    } else {
                        // Bottom visualizer grows from h to 0. Reverse: color1 at tip (0), color2 at base (h)
                        grad = ctx.createLinearGradient(0, 0, 0, h);
                    }
                    break;
                default: // vertical
                    if (isTop) {
                        // Top visualizer grows from 0 to h. Vertical: color1 at base (0), color2 at tip (h)
                        grad = ctx.createLinearGradient(0, 0, 0, h);
                    } else {
                        // Bottom visualizer grows from h to 0. Vertical: color1 at base (h), color2 at tip (0)
                        grad = ctx.createLinearGradient(0, h, 0, 0);
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
        requestAnimationFrame(() => this.draw());

        if (this.mode === 'off') return;

        this.updateGradients();

        this.analyser.getByteFrequencyData(this.dataArray);

        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);

        // Bass pulse detection
        if (this.bassPulseEnabled) {
            let bassSum = 0;
            const bassBins = Math.max(1, Math.floor(this.displayLength * 0.05)); // 5% of displayed bins
            for (let i = 0; i < bassBins; i++) {
                bassSum += this.dataArray[i];
            }
            const avgBass = bassSum / bassBins;
            
            const bg = document.querySelector('.background-media');
            if (bg) {
                if (avgBass > this.bassThreshold) {
                    const intensity = (avgBass - this.bassThreshold) / (255 - this.bassThreshold);
                    const scale = 1 + (intensity * 0.05); // Max 5% scale
                    bg.style.transform = `scale(${scale})`;
                } else {
                    bg.style.transform = 'scale(1)';
                }
            }
        }

        const spacing = 2;
        const totalSpacing = spacing * (this.displayLength - 1);
        const barWidth = Math.max(1, (this.canvasBottom.width - totalSpacing) / this.displayLength);
        let barHeight;
        let x = 0;

        // Flags for mirrored modes
        const mirrorTop = this.mode === 'top-mirror' || this.mode === 'both-mirror';
        const mirrorBottom = this.mode === 'bottom-mirror' || this.mode === 'both-mirror';
        const showTop = this.mode === 'top' || this.mode === 'top-mirror' || this.mode === 'both' || this.mode === 'both-mirror';
        const showBottom = this.mode === 'bottom' || this.mode === 'bottom-mirror' || this.mode === 'both' || this.mode === 'both-mirror';

        if (this.isSymmetric) {
            const halfLength = Math.floor(this.displayLength / 2);

            if (showBottom) {
                const width = this.canvasBottom.width;
                const center = width / 2;
                const barW = Math.max(1, (width / this.displayLength) - spacing);

                this.ctxBottom.fillStyle = this.gradientBottom;

                for (let i = 0; i < halfLength; i++) {
                    // In symmetric mode, mirroring means swapping whether low frequencies are at the center or edges
                    const sourceIndex = (this.symmetryReverse !== mirrorBottom) ? (halfLength - 1 - i) : i;
                    barHeight = this.dataArray[sourceIndex] * 0.7;
                    const xLeft = center - (i + 1) * (barW + spacing);
                    const xRight = center + i * (barW + spacing);
                    
                    // Standard vertical growth: bottom canvas grows from bottom up
                    this.ctxBottom.fillRect(xLeft, this.canvasBottom.height - barHeight, barW, barHeight);
                    this.ctxBottom.fillRect(xRight, this.canvasBottom.height - barHeight, barW, barHeight);
                }
            }

            if (showTop) {
                const width = this.canvasTop.width;
                const center = width / 2;
                const barW = Math.max(1, (width / this.displayLength) - spacing);

                this.ctxTop.fillStyle = this.gradientTop;

                for (let i = 0; i < halfLength; i++) {
                    const sourceIndex = (this.symmetryReverse !== mirrorTop) ? (halfLength - 1 - i) : i;
                    barHeight = this.dataArray[sourceIndex] * 0.7;
                    const xLeft = center - (i + 1) * (barW + spacing);
                    const xRight = center + i * (barW + spacing);
                    
                    // Standard vertical growth: top canvas grows from top down
                    this.ctxTop.fillRect(xLeft, 0, barW, barHeight);
                    this.ctxTop.fillRect(xRight, 0, barW, barHeight);
                }
            }
            return;
        }

        if (showBottom) {
            this.ctxBottom.fillStyle = this.gradientBottom;
        }
        if (showTop) {
            this.ctxTop.fillStyle = this.gradientTop;
        }

        for (let i = 0; i < this.displayLength; i++) {
            barHeight = this.dataArray[i] * 0.7;

            // Draw on bottom canvas
            if (showBottom) {
                const finalX = mirrorBottom ? (this.canvasBottom.width - x - barWidth) : x;
                this.ctxBottom.fillRect(finalX, this.canvasBottom.height - barHeight, barWidth, barHeight);
            }

            // Draw on top canvas
            if (showTop) {
                const finalX = mirrorTop ? (this.canvasTop.width - x - barWidth) : x;
                this.ctxTop.fillRect(finalX, 0, barWidth, barHeight);
            }

            x += barWidth + spacing;
        }
    }
}
