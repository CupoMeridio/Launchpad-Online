/**
 * =============================================================================
 * VISUALIZER MODULE (visualizer.js)
 * =============================================================================
 * 
 * Questo modulo definisce la classe `Visualizer`, responsabile della creazione
 * e dell'animazione del visualizzatore audio.
 * Utilizza i dati forniti da un `AnalyserNode` (dal modulo `audio.js`) per disegnare
 * barre di frequenza su due elementi `<canvas>` HTML5 in tempo reale.
 */

export class Visualizer {
    /**
     * Costruisce l'istanza del visualizzatore.
     * @param {AnalyserNode} analyser - Il nodo analizzatore della Web Audio API da cui ottenere i dati.
     * @param {HTMLCanvasElement} canvasTop - L'elemento canvas per la visualizzazione superiore.
     * @param {HTMLCanvasElement} canvasBottom - L'elemento canvas per la visualizzazione inferiore.
     */
    constructor(analyser, canvasTop, canvasBottom) {
        this.analyser = analyser;
        
        this.canvasTop = canvasTop;
        this.ctxTop = this.canvasTop.getContext('2d');
        
        this.canvasBottom = canvasBottom;
        this.ctxBottom = this.canvasBottom.getContext('2d');

        // Imposta le dimensioni iniziali dei canvas e aggiunge un listener per il ridimensionamento della finestra.
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // `frequencyBinCount` è la metà della `fftSize` dell'analizzatore.
        // Rappresenta il numero di "contenitori" di dati di frequenza che avremo a disposizione.
        this.bufferLength = this.analyser.frequencyBinCount;
        // Creiamo un array di interi a 8 bit (valori da 0 a 255) per contenere i dati di frequenza.
        this.dataArray = new Uint8Array(this.bufferLength);

        // Imposta una modalità di visualizzazione iniziale.
        this.mode = 'both'; 
        this.isSymmetric = false;

        // Impostazioni di personalizzazione
        this.color1 = '#00aaff';
        this.color2 = '#00aaff';
        this.gradientDirection = 'vertical';
        this.alpha = 0.6;
    }

    /**
     * Converte un colore esadecimale in formato RGBA.
     * @param {string} hex - Il colore esadecimale (es. '#RRGGBB').
     * @param {number} alpha - Il valore di trasparenza (da 0 a 1).
     * @returns {string} - La stringa del colore in formato `rgba(r, g, b, alpha)`.
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Ridimensiona i canvas per adattarli alla larghezza della finestra e a un'altezza fissa.
     */
    resize() {
        this.canvasTop.width = window.innerWidth;
        this.canvasTop.height = window.innerHeight * 0.25;
        
        this.canvasBottom.width = window.innerWidth;
        this.canvasBottom.height = window.innerHeight * 0.25;
    }

    /**
     * Imposta la modalità di visualizzazione.
     * @param {string} mode - La modalità da impostare ('off', 'top', 'bottom', 'both').
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
     * Imposta la fluidità dell'animazione.
     * @param {number} value - Valore tra 0 e 1 per `smoothingTimeConstant`.
     */
    setSmoothing(value) {
        this.analyser.smoothingTimeConstant = value;
    }

    /**
     * Imposta i colori per il visualizzatore.
     * @param {string} color1 - Il primo colore.
     * @param {string} color2 - Il secondo colore (opzionale, per il gradiente).
     */
    setColors(color1, color2) {
        this.color1 = color1;
        this.color2 = color2 || color1;
    }

    /**
     * Imposta la direzione del gradiente.
     * @param {string} direction - 'vertical', 'horizontal', etc.
     */
    setGradientDirection(direction) {
        this.gradientDirection = direction;
    }

    /**
     * Imposta la trasparenza del visualizzatore.
     * @param {number} alpha - Valore di trasparenza da 0 a 1.
     */
    setAlpha(alpha) {
        this.alpha = alpha;
    }

    /**
     * Il ciclo di disegno principale (animation loop).
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

            // Creazione dello stile di riempimento (gradiente o colore singolo)
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

            // Disegna sul canvas inferiore
            if (this.mode === 'bottom' || this.mode === 'both') {
                const grad = createGradient(this.ctxBottom, this.canvasBottom.height, this.canvasBottom.height - barHeight);
                this.ctxBottom.fillStyle = grad;
                this.ctxBottom.fillRect(x, this.canvasBottom.height - barHeight, barWidth, barHeight);
            }

            // Disegna sul canvas superiore
            if (this.mode === 'top' || this.mode === 'both') {
                const grad = createGradient(this.ctxTop, 0, barHeight);
                this.ctxTop.fillStyle = grad;
                this.ctxTop.fillRect(x, 0, barWidth, barHeight);
            }

            x += barWidth + 2;
        }
    }
}
