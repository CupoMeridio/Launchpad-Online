/**
 * =============================================================================
 * PROJECT MANAGEMENT (project.js)
 * =============================================================================
 * Populates background and project menus and loads project configuration,
 * sounds, and associated Launchpad cover.
 */

import { audioEngine } from './audio.js';
import { setLaunchpadBackground } from './ui.js';
import { setBackgroundVideo } from './video.js';
import {
    selectedProjectButton,
    setCurrentProject,
    setProjectSounds,
    setProjectLights,
    setSelectedProjectButton
} from './app.js';

/**
 * Dynamically populates the background video menu.
 * @param {string[]} videoFiles - An array of video file names.
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
 * Loads a project, its sounds, and sets the associated background.
 * @param {string} configPath - Path to the project configuration JSON file.
 * @param {HTMLElement} button - Clicked button element to update 'selected' state.
 */
export async function loadProject(configPath, button) {
    try {
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const project = await response.json();
        setCurrentProject(project);

        const baseUrl = configPath.substring(0, configPath.lastIndexOf('/') + 1);
        const resolvePath = (path) => {
            if (!path) return path;
            if (path.startsWith('http') || path.startsWith('/') || path.startsWith('assets/')) return path;
            return baseUrl + path;
        };

        const sounds = [];
        const lights = [];
        if (project.pages) {
            project.pages.forEach(page => {
                sounds.push(...page.sounds.map(s => resolvePath(s)));
                if (page.lights) {
                    lights.push(...page.lights);
                } else {
                    // Fill with empty strings if lights array is missing for a page
                    lights.push(...new Array(64).fill(""));
                }
            });
        }
        setProjectSounds(sounds);
        setProjectLights(lights);
        await audioEngine.loadSounds(sounds);

        setLaunchpadBackground(resolvePath(project.coverImage));

        if (project.backgroundVideo) {
            console.log("Loading project background video:", project.backgroundVideo);
            setBackgroundVideo(resolvePath(project.backgroundVideo));
        } else {
            // Se il progetto non ha un video, rimuovi quello attuale
            setBackgroundVideo(null);
        }

        if (selectedProjectButton) {
            selectedProjectButton.classList.remove('selected');
        }
        if (button) {
            button.classList.add('selected');
            setSelectedProjectButton(button);
        }

        console.log(`Project "${project.name}" loaded.`);
    } catch (error) {
        console.error("Unable to load project:", error);
    }
}

/**
 * Dynamically populates the project selection menu.
 * @param {object[]} projects - Array of project objects from `static-data.json`.
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
            // Pre-select the first project.
            // Selected button handling logic is in loadProject
        }
    });
}
