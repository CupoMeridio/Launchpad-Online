/**
 * =============================================================================
 * VIDEO BACKGROUND MODULE (video.js)
 * =============================================================================
 * Manages background video selection, effect controls visibility, and
 * applies visual effects (overlay opacity, blur, brightness).
 */

import { syncInputSlider } from './ui.js';

let currentBackgroundEl = null;

const VIDEO_EFFECT_DEFAULTS = {
    opacity: 0,
    blur: 0,
    brightness: 100
};

export function updateVideoControlsVisibility() {
    const backgroundMenu = document.getElementById('background-menu');
    const videoControls = document.querySelector('.video-controls');
    if (!videoControls || !backgroundMenu) return;

    const isVideoActive = currentBackgroundEl !== null;
    const isMenuOpen = backgroundMenu.classList.contains('open');

    if (isVideoActive && isMenuOpen) {
        videoControls.classList.add('visible');
    } else {
        videoControls.classList.remove('visible');
    }
}

export function setBackgroundVideo(videoFile) {
    const overlay = document.querySelector('.video-overlay');
    const backgroundMenu = document.getElementById('background-menu');
    if (backgroundMenu) {
        const buttons = backgroundMenu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
        const selector = videoFile ? `[data-video="${videoFile}"]` : '[data-video="none"]';
        const active = backgroundMenu.querySelector(selector);
        if (active) active.classList.add('selected');
    }

    removeExistingBackground();

    if (videoFile) {
        const video = document.createElement('video');
        video.className = 'background-media';
        video.src = `assets/videos/${videoFile}?t=${new Date().getTime()}`;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;

        document.body.appendChild(video);
        overlay.classList.add('active');
        currentBackgroundEl = video;

        applyVideoEffects();
    } else {
        overlay.classList.remove('active');
        currentBackgroundEl = null;
        resetVideoControls();
    }

    updateVideoControlsVisibility();
}

function resetVideoControls() {
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');

    if (opacitySlider && blurSlider && brightnessSlider) {
        opacitySlider.value = VIDEO_EFFECT_DEFAULTS.opacity;
        blurSlider.value = VIDEO_EFFECT_DEFAULTS.blur;
        brightnessSlider.value = VIDEO_EFFECT_DEFAULTS.brightness;

        if (opacityInput && blurInput && brightnessInput) {
            opacityInput.value = VIDEO_EFFECT_DEFAULTS.opacity;
            blurInput.value = VIDEO_EFFECT_DEFAULTS.blur;
            brightnessInput.value = VIDEO_EFFECT_DEFAULTS.brightness;
        }

        applyVideoEffects();
    }
}

function applyVideoEffects() {
    const overlay = document.querySelector('.video-overlay');
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
 * Initializes video effect controls.
 */
export function initializeVideoControls() {
    const opacitySlider = document.getElementById('opacity-slider');
    const blurSlider = document.getElementById('blur-slider');
    const brightnessSlider = document.getElementById('brightness-slider');
    const opacityInput = document.getElementById('opacity-input');
    const blurInput = document.getElementById('blur-input');
    const brightnessInput = document.getElementById('brightness-input');

    if (opacitySlider && blurSlider && brightnessSlider) {
        opacitySlider.value = VIDEO_EFFECT_DEFAULTS.opacity;
        opacityInput.value = VIDEO_EFFECT_DEFAULTS.opacity;
        blurSlider.value = VIDEO_EFFECT_DEFAULTS.blur;
        blurInput.value = VIDEO_EFFECT_DEFAULTS.blur;
        brightnessSlider.value = VIDEO_EFFECT_DEFAULTS.brightness;
        brightnessInput.value = VIDEO_EFFECT_DEFAULTS.brightness;

        syncInputSlider('opacity-slider', 'opacity-input', applyVideoEffects, 0, 100, false);
        syncInputSlider('blur-slider', 'blur-input', applyVideoEffects, 0, 100, false);
        syncInputSlider('brightness-slider', 'brightness-input', applyVideoEffects, 0, 200, false);
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
            setBackgroundFile(file);
        });
    }
}

function removeExistingBackground() {
    const existingVideo = document.querySelector('.background-video');
    if (existingVideo) existingVideo.remove();
    const existingMedia = document.querySelector('.background-media');
    if (existingMedia) existingMedia.remove();
}

export function setBackgroundFile(file) {
    const overlay = document.querySelector('.video-overlay');
    const backgroundMenu = document.getElementById('background-menu');
    if (backgroundMenu) {
        const buttons = backgroundMenu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
    }
    removeExistingBackground();
    if (file) {
        const url = URL.createObjectURL(file);
        let el;
        if (file.type.startsWith('video/')) {
            el = document.createElement('video');
            el.autoplay = true;
            el.loop = true;
            el.muted = true;
        } else {
            el = document.createElement('img');
        }
        el.className = 'background-media';
        el.src = url;
        document.body.appendChild(el);
        overlay.classList.add('active');
        currentBackgroundEl = el;
        applyVideoEffects();
    } else {
        overlay.classList.remove('active');
        currentBackgroundEl = null;
        resetVideoControls();
    }
    updateVideoControlsVisibility();
}

function setNoneSelected() {
    const backgroundMenu = document.getElementById('background-menu');
    if (backgroundMenu) {
        const buttons = backgroundMenu.querySelectorAll('.menu-option');
        buttons.forEach(b => b.classList.remove('selected'));
        const noneBtn = backgroundMenu.querySelector('[data-video="none"]');
        if (noneBtn) noneBtn.classList.add('selected');
    }
}

export function clearBackground() {
    const overlay = document.querySelector('.video-overlay');
    removeExistingBackground();
    if (overlay) overlay.classList.remove('active');
    currentBackgroundEl = null;
    resetVideoControls();
    setNoneSelected();
    updateVideoControlsVisibility();
    // no file name display
}

// Global exposure for usage in HTML
window.setBackgroundVideo = setBackgroundVideo;
window.setBackgroundFile = setBackgroundFile;
window.clearBackground = clearBackground;