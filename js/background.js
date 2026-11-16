/**
 * BACKGROUND MEDIA MODULE (background.js)
 * Manages background video and image selection, effect controls visibility,
 * and applies visual effects (overlay opacity, blur, brightness).
 */

import { syncInputSlider } from './formControls.js';
import { CATALOG_VIDEOS_PATH, toCatalogName } from './constants.js';
import { logger } from './logger.js';

let currentBackgroundEl = null;

const MEDIA_EFFECT_DEFAULTS = {
    opacity: 0,
    blur: 0,
    brightness: 100
};

// Whether the panel hosting the media effect controls is on screen. Pushed by
// the UI layer (ui.js), which owns menu and tab state, so this module never
// needs to import the UI.
let mediaControlsPanelVisible = false;

/**
 * Informs the module whether the Background customization panel is visible.
 * @param {boolean} isVisible
 */
export function setMediaControlsPanelVisible(isVisible) {
    mediaControlsPanelVisible = Boolean(isVisible);
    updateVideoControlsVisibility();
}

/**
 * Shows the media effect controls only when a background is active AND the
 * Background panel of the Customization menu is visible.
 */
function updateVideoControlsVisibility() {
    const videoControls = document.querySelector('.media-controls');
    if (!videoControls) return;

    const isMediaActive = currentBackgroundEl !== null;
    videoControls.classList.toggle('visible', isMediaActive && mediaControlsPanelVisible);
}

function isImageSource(source, file) {
    if (file && typeof file.type === 'string') {
        if (file.type.startsWith('image/')) return true;
        if (file.type.startsWith('video/')) return false;
    }
    const str = (typeof source === 'string') ? source : (file?.name || '');
    const clean = str.split('?')[0].split('#')[0].toLowerCase();
    if (/\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i.test(clean)) return true;
    if (clean.startsWith('data:image/')) return true;
    return false;
}

/**
 * Sets a background video or image.
 * @param {string|File|Blob|null} mediaFile - The media file name, path, Blob, or `null` to remove it.
 * @returns {Promise<void>} A promise that resolves when the media is ready to display.
 */
export function setBackgroundMedia(mediaFile) {
    const overlay = document.querySelector('.media-overlay');
    const backgroundMenu = document.getElementById('background-menu');
    if (backgroundMenu) {
        const buttons = backgroundMenu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
        if (typeof mediaFile === 'string') {
            const selector = mediaFile
                ? `[data-background="${CSS.escape(toCatalogName(mediaFile, CATALOG_VIDEOS_PATH))}"]`
                : '[data-background="none"]';
            const active = backgroundMenu.querySelector(selector);
            if (active) active.classList.add('selected');
        }
    }

    removeExistingBackground();

    if (!mediaFile) {
        if (overlay) overlay.classList.remove('active');
        currentBackgroundEl = null;
        resetMediaControls();
        updateVideoControlsVisibility();
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let isImage = false;
        let mediaSrc = '';

        if (typeof mediaFile === 'object' && mediaFile !== null) {
            isImage = isImageSource('', mediaFile);
            mediaSrc = URL.createObjectURL(mediaFile);
        } else if (typeof mediaFile === 'string') {
            isImage = isImageSource(mediaFile);
            mediaSrc = (mediaFile.includes('/') || mediaFile.startsWith('blob:') || mediaFile.startsWith('data:'))
                ? mediaFile
                : `${CATALOG_VIDEOS_PATH}${mediaFile}`;
            if (!mediaSrc.startsWith('blob:') && !mediaSrc.startsWith('data:')) {
                mediaSrc = `${mediaSrc}?t=${Date.now()}`;
            }
        }

        let mediaEl;
        if (isImage) {
            mediaEl = document.createElement('img');
            mediaEl.onload = () => resolve();
            mediaEl.onerror = () => {
                logger.error(`Error loading background image: ${mediaSrc}`);
                resolve();
            };
        } else {
            mediaEl = document.createElement('video');
            mediaEl.autoplay = true;
            mediaEl.loop = true;
            mediaEl.muted = true;
            mediaEl.oncanplaythrough = () => resolve();
            mediaEl.onerror = () => {
                logger.error(`Error loading background video: ${mediaSrc}`);
                resolve();
            };
        }

        mediaEl.className = 'background-media';
        mediaEl.src = mediaSrc;

        document.body.appendChild(mediaEl);
        if (overlay) overlay.classList.add('active');
        currentBackgroundEl = mediaEl;

        applyVideoEffects();
        updateVideoControlsVisibility();
    });
}

function resetMediaControls() {
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');

    if (opacitySlider && blurSlider && brightnessSlider) {
        opacitySlider.value = MEDIA_EFFECT_DEFAULTS.opacity;
        blurSlider.value = MEDIA_EFFECT_DEFAULTS.blur;
        brightnessSlider.value = MEDIA_EFFECT_DEFAULTS.brightness;

        if (opacityInput && blurInput && brightnessInput) {
            opacityInput.value = MEDIA_EFFECT_DEFAULTS.opacity;
            blurInput.value = MEDIA_EFFECT_DEFAULTS.blur;
            brightnessInput.value = MEDIA_EFFECT_DEFAULTS.brightness;
        }

        applyVideoEffects();
    }
}

function applyVideoEffects() {
    const overlay = document.querySelector('.media-overlay');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');

    if (overlay && opacityInput && blurInput && brightnessInput) {
        const opacity = opacityInput.value / 100;
        overlay.style.backgroundColor = `rgba(18, 18, 18, ${opacity})`;

        if (currentBackgroundEl) {
            // Convert percentage (0-100) to pixels (0-20px) for blur
            const blurPx = (blurInput.value / 100) * 20;
            const brightness = brightnessInput.value / 100;
            currentBackgroundEl.style.filter = `blur(${blurPx}px) brightness(${brightness})`;
        }
    }
}

/**
 * Initializes background media effect controls.
 */
export function initializeBackgroundControls() {
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');

    if (opacitySlider && blurSlider && brightnessSlider) {
        resetMediaControls();

        syncInputSlider({ sliderId: 'opacity-slider', inputId: 'opacity-input', min: 0, max: 100, onChange: applyVideoEffects });
        syncInputSlider({ sliderId: 'blur-slider', inputId: 'blur-input', min: 0, max: 100, onChange: applyVideoEffects });
        syncInputSlider({ sliderId: 'brightness-slider', inputId: 'brightness-input', min: 0, max: 200, onChange: applyVideoEffects });
    }

    const fileInput = document.getElementById('background-file-input');
    const fileTrigger = document.getElementById('background-file-trigger');
    if (fileTrigger && fileInput) {
        fileTrigger.addEventListener('click', function () {
            fileInput.click();
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            setBackgroundMedia(file);
        });
    }
}

/**
 * Removes the current background element and revokes its blob URL if present,
 * preventing memory leaks from repeated file uploads.
 */
function removeExistingBackground() {
    // Revoke any blob URL previously created via createObjectURL
    if (currentBackgroundEl && currentBackgroundEl.src && currentBackgroundEl.src.startsWith('blob:')) {
        URL.revokeObjectURL(currentBackgroundEl.src);
    }
    const existingVideo = document.querySelector('.background-video');
    if (existingVideo) existingVideo.remove();
    const existingMedia = document.querySelectorAll('.background-media');
    existingMedia.forEach(el => el.remove());
}
