/**
 * =============================================================================
 * STORAGE MODULE (storage.js)
 * =============================================================================
 * 
 * Questo file è predisposto per gestire la persistenza dei dati dell'applicazione
 * nel browser dell'utente, utilizzando `localStorage` o `sessionStorage`.
 *
 * La persistenza dei dati permette di "ricordare" le scelte e le configurazioni
 * dell'utente tra una sessione e l'altra, migliorando l'esperienza d'uso.
 *
 * Esempi di dati che potrebbero essere salvati:
 * - L'ultimo progetto selezionato dall'utente.
 * - Le impostazioni del background video (video selezionato, opacità, sfocatura, luminosità).
 * - Le impostazioni del visualizzatore (modalità, fluidità).
 * - Le personalizzazioni del Launchpad (sfondo, visibilità degli adesivi).
 * - Il volume generale o altre impostazioni audio.
 *
 * IMPLEMENTAZIONE FUTURA:
 * Si potrebbero creare funzioni generiche per salvare e caricare le impostazioni:
 *
 * function saveSetting(key, value) {
 *   try {
 *     const serializedValue = JSON.stringify(value);
 *     localStorage.setItem(key, serializedValue);
 *   } catch (error) {
 *     console.error(`Errore nel salvataggio dell'impostazione '${key}':`, error);
 *   }
 * }
 * 
 * function loadSetting(key, defaultValue = null) {
 *   try {
 *     const serializedValue = localStorage.getItem(key);
 *     if (serializedValue === null) {
 *       return defaultValue;
 *     }
 *     return JSON.parse(serializedValue);
 *   } catch (error) {
 *     console.error(`Errore nel caricamento dell'impostazione '${key}':`, error);
 *     return defaultValue;
 *   }
 * }
 * 
 * Queste funzioni potrebbero poi essere importate e utilizzate in `app.js` per caricare
 * le impostazioni all'avvio e salvarle ogni volta che vengono modificate.
 */
