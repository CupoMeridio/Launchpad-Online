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
        // PERSONALIZZAZIONE: Puoi cambiare questo valore in 'off', 'top', 'bottom', o 'both'.
        this.mode = 'both'; 
    }

    /**
     * Ridimensiona i canvas per adattarli alla larghezza della finestra e a un'altezza fissa.
     * Questo metodo viene chiamato al momento della creazione e ogni volta che la finestra del browser viene ridimensionata.
     */
    resize() {
        this.canvasTop.width = window.innerWidth;
        this.canvasTop.height = window.innerHeight * 0.25; // Occupa il 25% superiore dello schermo.
        
        this.canvasBottom.width = window.innerWidth;
        this.canvasBottom.height = window.innerHeight * 0.25; // Occupa il 25% inferiore dello schermo.
    }

    /**
     * Imposta la modalità di visualizzazione.
     * @param {string} mode - La modalità da impostare ('off', 'top', 'bottom', 'both').
     */
    setMode(mode) {
        this.mode = mode;
        // Pulisce immediatamente i canvas quando la modalità cambia per evitare che l'ultimo frame rimanga visibile.
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);
    }

    /**
     * Imposta la fluidità dell'animazione del visualizzatore.
     * @param {number} value - Un valore tra 0 e 1 che imposta `smoothingTimeConstant` dell'analizzatore.
     */
    setSmoothing(value) {
        this.analyser.smoothingTimeConstant = value;
    }

    /**
     * Il ciclo di disegno principale (animation loop).
     * Viene chiamato ricorsivamente tramite `requestAnimationFrame` per un'animazione fluida ed efficiente.
     */
    draw() {
        // Richiede al browser di eseguire questo metodo `draw` al prossimo frame di animazione disponibile.
        requestAnimationFrame(() => this.draw());

        // Se la modalità è 'off', interrompe il ciclo di disegno qui, risparmiando risorse.
        if (this.mode === 'off') return;

        // 1. OTTENERE I DATI AUDIO
        // Copia i dati di frequenza correnti (in decibel) nell'array `dataArray`.
        this.analyser.getByteFrequencyData(this.dataArray);

        // 2. PULIRE I CANVAS
        // È necessario pulire l'intero canvas a ogni frame per non sovrapporre i disegni precedenti.
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);

        // 3. IMPOSTARE I PARAMETRI DI DISEGNO
        // PERSONALIZZAZIONE:
        // - `* 1.5`: Aumenta la larghezza delle barre. Un valore più alto crea barre più spesse e meno numerose.
        const barWidth = (this.canvasBottom.width / this.bufferLength) * 1.5;
        let barHeight;
        let x = 0; // Posizione orizzontale della prima barra.

        // 4. CICLARE SUI DATI E DISEGNARE
        for (let i = 0; i < this.bufferLength; i++) {
            // Il valore in `dataArray[i]` va da 0 a 255. Lo scaliamo per ottenere un'altezza visivamente piacevole.
            // PERSONALIZZAZIONE: Aumenta il moltiplicatore (es. `* 1.0`) per barre più alte e reattive.
            barHeight = this.dataArray[i] * 0.7;

            // PERSONALIZZAZIONE DEL COLORE:
            // Puoi creare gradienti o colori dinamici qui. Per esempio, basando il colore sull'altezza della barra:
            // const g = barHeight; // Verde
            // const b = 255 - barHeight; // Blu
            // this.ctxBottom.fillStyle = `rgb(0, ${g}, ${b})`;
            const fillColor = `rgba(0, 170, 255, 0.6)`; // Blu semitrasparente.

            // --- Disegna sul canvas inferiore (le barre crescono dal basso verso l'alto) ---
            if (this.mode === 'bottom' || this.mode === 'both') {
                this.ctxBottom.fillStyle = fillColor;
                this.ctxBottom.fillRect(
                    x, // Posizione X
                    this.canvasBottom.height - barHeight, // Posizione Y (parte dall'altezza del canvas e va verso l'alto)
                    barWidth, // Larghezza della barra
                    barHeight // Altezza della barra
                );
            }

            // --- Disegna sul canvas superiore (le barre crescono dall'alto verso il basso) ---
            if (this.mode === 'top' || this.mode === 'both') {
                this.ctxTop.fillStyle = fillColor;
                this.ctxTop.fillRect(x, 0, barWidth, barHeight);
            }

            // Sposta la posizione orizzontale per la barra successiva.
            // PERSONALIZZAZIONE: Aumenta il valore `+ 2` per avere più spazio tra le barre.
            x += barWidth + 2;
        }
    }
}
