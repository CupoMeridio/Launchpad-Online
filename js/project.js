import { audioEngine } from './audio.js';
import { setLaunchpadBackground } from './ui.js';
import { setBackgroundVideo } from './video.js';
import { changeSoundSet } from './interaction.js';
import { 
    currentProject, 
    selectedProjectButton, 
    setCurrentProject, 
    setProjectSounds, 
    setSelectedProjectButton 
} from './app.js';

/**
 * Popola dinamicamente il menu dei video di sfondo.
 * @param {string[]} videoFiles - Un array di nomi di file video.
 */
export function initializeBackgroundMenu(videoFiles) {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = backgroundMenu.querySelector('.video-controls');

    videoFiles.forEach(videoFile => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.setAttribute('data-video', videoFile);
        button.textContent = videoFile.replace('.mp4', '');
        button.onclick = () => setBackgroundVideo(videoFile);
        backgroundMenu.insertBefore(button, videoControls);
    });
}

/**
 * Carica un progetto, i suoi suoni e imposta lo sfondo associato.
 * @param {string} configPath - Il percorso al file JSON di configurazione del progetto.
 * @param {HTMLElement} button - L'elemento pulsante cliccato, per aggiornare lo stato 'selected'.
 */
export async function loadProject(configPath, button) {
    try {
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const project = await response.json();
        setCurrentProject(project);

        const sounds = [];
        if (project.pages) {
            project.pages.forEach(page => {
                sounds.push(...page.sounds);
            });
        }
        setProjectSounds(sounds);
        await audioEngine.loadSounds(sounds);

        setLaunchpadBackground(project.coverImage);

        if (selectedProjectButton) {
            selectedProjectButton.classList.remove('selected');
        }
        if (button) {
            button.classList.add('selected');
            setSelectedProjectButton(button);
        }

        changeSoundSet(0);

        console.log(`Progetto "${project.name}" caricato.`);
    } catch (error) {
        console.error("Impossibile caricare il progetto:", error);
    }
}

/**
 * Popola dinamicamente il menu di selezione del progetto.
 * @param {object[]} projects - Array di oggetti progetto da `static-data.json`.
 */
export function initializeProjectMenu(projects) {
    const projectMenu = document.getElementById('project-menu');
    if (!projectMenu) return;

    projects.forEach((project, index) => {
        const button = document.createElement('button');
        button.className = 'menu-option';
        button.textContent = project.name;
        button.onclick = () => loadProject(project.configPath, button);
        projectMenu.appendChild(button);

        if (index === 0) {
            // Pre-seleziona il primo progetto.
            // La logica di gestione del pulsante selezionato è in loadProject
        }
    });
}