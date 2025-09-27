/**
 * =============================================================================
 * LIBRARY UI MODULE (library-ui.js)
 * =============================================================================
 * 
 * Questo file è predisposto per contenere la logica di costruzione dinamica
 * dei menu della libreria presenti nella sidebar.
 *
 * Attualmente, la logica per popolare i menu (progetti, sfondi video, skin del launchpad)
 * si trova in `app.js`. In un'ottica di separazione delle responsabilità (Separation of Concerns),
 * questa logica dovrebbe essere spostata qui.
 *
 * RESPONSABILITÀ FUTURE DI QUESTO MODULO:
 * ----------------------------------------
 *
 * 1. CARICAMENTO DEI DATI DELLA LIBRERIA:
 *    - Eseguire il `fetch` del file `js/static-data.json` che contiene gli elenchi
 *      di progetti, video e skin disponibili.
 *
 * 2. COSTRUZIONE DEI MENU:
 *    - Creare dinamicamente i pulsanti (`<button class="menu-option">`) per ogni elemento
 *      della libreria.
 *    - Inserire questi pulsanti nei rispettivi contenitori a tendina (`.menu-dropdown`) nell'HTML.
 *    - Le funzioni da implementare sarebbero:
 *      - `populateProjectMenu(projects, onProjectSelectCallback)`
 *      - `populateBackgroundMenu(videos, onVideoSelectCallback)`
 *      - `populateSkinsMenu(skins, onSkinSelectCallback)`
 *
 * 3. GESTIONE DEGLI EVENTI:
 *    - Associare gli eventi `onclick` ai pulsanti creati.
 *    - Quando un pulsante viene cliccato, questo modulo dovrebbe invocare una funzione "callback"
 *      passata da `app.js`, per informare il controller principale della scelta dell'utente.
 *      (Es. `onProjectSelectCallback(project.configPath)`).
 *      Questo disaccoppia la UI dalla logica di business.
 *
 * ESEMPIO DI REFACTORING (da app.js a qui):
 * 
 * // In library-ui.js
 * export function initializeAllMenus(data, callbacks) {
 *   populateProjectMenu(data.projects, callbacks.onProjectSelect);
 *   populateBackgroundMenu(data.videos, callbacks.onVideoSelect);
 *   // ... e così via
 * }
 * 
 * function populateProjectMenu(projects, onProjectSelect) {
 *   const menu = document.getElementById('project-menu');
 *   menu.innerHTML = ''; // Pulisce il menu
 *   projects.forEach(project => {
 *     const button = document.createElement('button');
 *     button.textContent = project.name;
 *     button.onclick = () => onProjectSelect(project.configPath, button);
 *     menu.appendChild(button);
 *   });
 * }
 * 
 * // In app.js
 * import { initializeAllMenus } from './ui/library-ui.js';
 * 
 * // ... dentro DOMContentLoaded ...
 * const data = await fetch('js/static-data.json');
 * initializeAllMenus(data, {
 *   onProjectSelect: loadProject,
 *   onVideoSelect: setBackgroundVideo,
 *   // ...
 * });
 */
