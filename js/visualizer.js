export class Visualizer {
    constructor(analyser, canvasTop, canvasBottom) {
        this.analyser = analyser;
        
        this.canvasTop = canvasTop;
        this.ctxTop = this.canvasTop.getContext('2d');
        
        this.canvasBottom = canvasBottom;
        this.ctxBottom = this.canvasBottom.getContext('2d');

        // Imposta la larghezza e l'altezza dei canvas in base alla finestra
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Prepara lo spazio per i dati audio
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        // Imposta una modalità iniziale ('off', 'top', 'bottom', 'both')
        this.mode = 'both'; 
    }

    // Ridimensiona i canvas per riempire la finestra
    resize() {
        this.canvasTop.width = window.innerWidth;
        this.canvasTop.height = window.innerHeight * 0.25; // Usa il 25% dell'altezza
        
        this.canvasBottom.width = window.innerWidth;
        this.canvasBottom.height = window.innerHeight * 0.25;
    }

    // Permette di cambiare modalità dall'esterno
    setMode(mode) {
        this.mode = mode;
        // Pulisce i canvas quando la modalità cambia
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);
    }

    draw() {
        // Richiede il prossimo frame per l'animazione
        requestAnimationFrame(() => this.draw());

        if (this.mode === 'off') return; // Se è spento, non fare nulla

        // Ottiene i dati delle frequenze dall'analizzatore
        this.analyser.getByteFrequencyData(this.dataArray);

        // Pulisce i canvas a ogni frame
        this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
        this.ctxBottom.clearRect(0, 0, this.canvasBottom.width, this.canvasBottom.height);

        const barWidth = (this.canvasBottom.width / this.bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            barHeight = this.dataArray[i] * 0.7; // Scala l'altezza per un effetto migliore

            // --- Disegna sul canvas inferiore (dal basso verso l'alto) ---
            if (this.mode === 'bottom' || this.mode === 'both') {
                this.ctxBottom.fillStyle = `rgba(0, 170, 255, 0.6)`;
                this.ctxBottom.fillRect(x, this.canvasBottom.height - barHeight, barWidth, barHeight);
            }

            // --- Disegna sul canvas superiore (dall'alto verso il basso) ---
            if (this.mode === 'top' || this.mode === 'both') {
                this.ctxTop.fillStyle = `rgba(0, 170, 255, 0.6)`;
                this.ctxTop.fillRect(x, 0, barWidth, barHeight);
            }

            x += barWidth + 2; // Spazio tra le barre
        }
    }
}