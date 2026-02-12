# Documentazione Animazioni Launchpad

Questo documento elenca tutte le animazioni disponibili per il Launchpad Online e le stringhe corrispondenti da utilizzare nei file JSON dei progetti.

## Colori Disponibili
Molte animazioni richiedono un suffisso per il colore. I colori validi sono:
- `red` (Rosso)
- `green` (Verde)
- `amber` (Ambra)
- `yellow` (Giallo)
- `orange` (Arancione)
- `lime` (Lime)

---

## 1. Animazioni a Colore Singolo (Fixed)
Queste animazioni vengono eseguite una volta quando il tasto viene premuto. Sostituire `{color}` con uno dei colori sopra elencati.

| Stringa JSON | Descrizione |
|--------------|-------------|
| `fade_{color}` | Dissolvenza standard del tasto premuto. |
| `matrix_rain_{color}` | Effetto pioggia stile Matrix su tutta la griglia. |
| `explode_{color}` | Espansione a quadrato dal punto di pressione verso l'esterno. |
| `implode_{color}` | Contrazione a quadrato dai bordi verso il punto di pressione. |
| `cross_{color}` | Croce che si espande dal punto di pressione. |
| `cross_reverse_{color}` | Croce che si contrae verso il punto di pressione. |
| `wave_{color}` | Onda circolare che si espande dal punto di pressione. |
| `wave_reverse_{color}` | Onda circolare che si contrae verso il punto di pressione. |
| `wave_center_{color}` | Onda circolare che si espande dal centro della griglia. |
| `wave_center_reverse_{color}` | Onda circolare che si contrae verso il centro. |
| `rotate_cw_{color}` | Rotazione oraria (parte da sinistra). |
| `rotate_ccw_{color}` | Rotazione antioraria (parte da sinistra). |
| `rotate_cw_right_{color}` | Rotazione oraria partendo da destra. |
| `rotate_cw_left_{color}` | Rotazione oraria partendo da sinistra. |
| `rotate_cw_top_{color}` | Rotazione oraria partendo dall'alto. |
| `rotate_cw_bottom_{color}` | Rotazione oraria partendo dal basso. |
| `rotate_ccw_right_{color}` | Rotazione antioraria partendo da destra. |
| `rotate_ccw_left_{color}` | Rotazione antioraria partendo da sinistra. |
| `rotate_ccw_top_{color}` | Rotazione antioraria partendo dall'alto. |
| `rotate_ccw_bottom_{color}` | Rotazione antioraria partendo dal basso. |
| `rain_down_{color}` | Pioggia che cade verticalmente sulla colonna del tasto. |
| `rain_up_{color}` | Pioggia che sale verticalmente sulla colonna del tasto. |
| `rain_left_{color}` | Scorrimento orizzontale verso sinistra sulla riga del tasto. |
| `rain_right_{color}` | Scorrimento orizzontale verso destra sulla riga del tasto. |
| `arrow_up_{color}` | Freccia/Onda che sale verso l'alto su tutta la griglia. |
| `arrow_down_{color}` | Freccia/Onda che scende verso il basso su tutta la griglia. |
| `arrow_left_{color}` | Freccia/Onda che scorre verso sinistra su tutta la griglia. |
| `arrow_right_{color}` | Freccia/Onda che scorre verso destra su tutta la griglia. |
| `arrow_up_left_{color}` | Freccia/Onda verso l'angolo in alto a sinistra. |
| `arrow_up_right_{color}` | Freccia/Onda verso l'angolo in alto a destra. |
| `arrow_down_left_{color}` | Freccia/Onda verso l'angolo in basso a sinistra. |
| `arrow_down_right_{color}` | Freccia/Onda verso l'angolo in basso a destra. |
| `sparkle_{color}` | Scintillio casuale di pixel su tutta la griglia. |
| `bounce_{color}` | Rimbalzo di luci che partono dal tasto verso i bordi e tornano indietro. |
| `snake_{color}` | Percorso a spirale che copre tutta la griglia. |
| `warp_speed_{color}` | Effetto "velocità curvatura" dal centro verso gli angoli. |
| `snake_collision_{color}` | Due percorsi che si scontrano al centro con un'esplosione. |
| `eq_spectrum_{color}` | Effetto equalizzatore casuale su tutta la griglia. |
| `eq_bounce_{color}` | Equalizzatore che sale e scende. |
| `eq_peak_hold_{color}` | Equalizzatore con mantenimento del picco. |
| `strobe_burst_{color}` | Effetto strobo rapido su tutta la griglia. |
| `scanline_v_{color}` | Linea verticale che scorre da sinistra a destra. |
| `scanline_h_{color}` | Linea orizzontale che scorre dall'alto verso il basso. |
| `spiral_{color}` | Spirale che riempie la griglia verso l'interno. |
| `checkerboard_{color}` | Scacchiera lampeggiante. |
| `random_fill_{color}` | Riempimento casuale di tutta la griglia punto per punto. |

---

## 2. Animazioni Multi-colore
Queste animazioni cambiano colore durante l'esecuzione.
Sequenze disponibili: `red_to_green`, `green_to_red`.

| Stringa JSON | Descrizione |
|--------------|-------------|
| `cross_multi_{seq}` | Croce espandibile con cambio colore. |
| `cross_multi_reverse_{seq}` | Croce contraibile con cambio colore. |
| `wave_multi_{seq}` | Onda espandibile con cambio colore. |
| `wave_multi_reverse_{seq}` | Onda contraibile con cambio colore. |
| `wave_center_multi_{seq}` | Onda dal centro con cambio colore. |
| `wave_center_multi_reverse_{seq}` | Onda che si contrae verso il centro con cambio colore. |
| `expand_multi_{seq}` | Alias di `cross_multi_{seq}`. |
| `expand_multi_reverse_{seq}` | Alias di `cross_multi_reverse_{seq}`. |
| `diagonal_multi_top_left_{seq}` | Diagonale dall'angolo in alto a sinistra. |
| `diagonal_multi_top_right_{seq}` | Diagonale dall'angolo in alto a destra. |
| `diagonal_multi_bottom_left_{seq}` | Diagonale dall'angolo in basso a sinistra. |
| `diagonal_multi_bottom_right_{seq}` | Diagonale dall'angolo in basso a destra. |
| `strobe_multi_{seq}` | Effetto strobo che alterna i colori della sequenza. |

---

## 3. Animazioni Speciali
Animazioni con comportamenti o colori predefiniti.

| Stringa JSON | Descrizione |
|--------------|-------------|
| `firework` | Esplosione di fuochi d'artificio in una posizione casuale. |
| `heart_fill` | Cuore rosso che si riempie gradualmente. |
| `heart_simple` | Cuore rosso che appare istantaneamente. |
| `heart_wave` | Cuore rosso con effetto onda dal centro. |

---

## 4. Animazioni Momentanee (Caratteri)
Queste animazioni rimangono attive finché il tasto è premuto.
Sostituire `{char}` con la lettera, `{digit}` con il numero, o `{symbol}` con il nome del simbolo.

| Pattern Stringa | Esempi |
|-----------------|---------|
| `letter_{char}_{color}` | `letter_a_red`, `letter_z_green` |
| `number_{digit}_{color}` | `number_0_yellow`, `number_5_lime` |
| `symbol_{name}_{color}` | `symbol_question_orange`, `symbol_exclamation_red` |

**Caratteri disponibili:**
- Lettere: `a-z`
- Numeri: `0-9`
- Simboli: `question` (?), `exclamation` (!)

---

## 5. Animazioni Dinamiche di Testo
Queste animazioni non sono nel registro fisso ma vengono generate dinamicamente.

| Pattern Stringa | Descrizione |
|-----------------|-------------|
| `scroll_{TESTO}_{color}` | Fa scorrere il testo indicato (default: da destra a sinistra). |
| `scroll_left_{TESTO}_{color}` | Scorrimento da destra a sinistra. |
| `scroll_right_{TESTO}_{color}` | Scorrimento da sinistra a destra. |
| `scroll_up_{TESTO}_{color}` | Scorrimento dal basso verso l'alto. |
| `scroll_down_{TESTO}_{color}` | Scorrimento dall'alto verso il basso. |
| `scroll_bottom_{TESTO}_{color}` | Alias per `scroll_up`. |
| `scroll_top_{TESTO}_{color}` | Alias per `scroll_down`. |
| `text_{TESTO}_{color}` | Visualizza il testo indicato lettera per lettera (es. `text_CIAO_red`). |
