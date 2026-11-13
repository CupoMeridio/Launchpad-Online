/**
 * PREVIEW (creator/preview.js)
 *
 * Auditioning the selected pad step: one-shot preview, hold-to-play preview for
 * momentary lights, and stopping draft playback.
 */

import { audioEngine } from '../audio.js';
import { LAUNCHPAD_COLS, LAUNCHPAD_PADS } from '../constants.js';
import { animations, releaseAnimation, resolveStepLightDuration, triggerAnimation } from '../lights.js';
import { getPadSteps } from '../projectCreatorModel.js';
import { creatorSession } from '../projectCreatorState.js';
import { getPadElement } from '../webInterface.js';
import { listen } from './dom.js';

export function stopPreview() {
    audioEngine.stopSound('preview');
    const momentary = creatorSession.getActiveMomentaryPreview();
    if (momentary) {
        releaseAnimation(momentary.animation, momentary.x, momentary.y);
        creatorSession.setActiveMomentaryPreview(null);
    }
}

export function stopAllDraftPads() {
    audioEngine.stopSoundsWithPrefix('draft:');
    for (let i = 0; i < LAUNCHPAD_PADS; i++) {
        const pad = getPadElement(i);
        if (pad) pad.classList.remove('active');
    }
}

function getPadPreviewContext(index = creatorSession.getActivePadIndex()) {
    const page = creatorSession.getCurrentPage();
    if (index === null || !page) return null;
    stopPreview();
    const steps = getPadSteps(page, index);
    const activePad = creatorSession.getActivePadIndex();
    const activeStep = creatorSession.getActiveStepIndex();
    const stepIdx = (index === activePad) ? activeStep : 0;
    const step = steps[stepIdx] || steps[0];
    return {
        page,
        buffer: step.buffer,
        animation: step.light || '',
        syncToSound: step.syncToSound,
        manualDuration: step.duration,
        x: index % LAUNCHPAD_COLS,
        y: Math.floor(index / LAUNCHPAD_COLS)
    };
}

function startHoldPreview(index = creatorSession.getActivePadIndex()) {
    const ctx = getPadPreviewContext(index);
    if (!ctx) return;

    if (ctx.buffer) {
        audioEngine.playBuffer(ctx.buffer, 'preview');
    }
    if (ctx.animation) {
        creatorSession.setActiveMomentaryPreview({ animation: ctx.animation, x: ctx.x, y: ctx.y });
        triggerAnimation(ctx.animation, ctx.x, ctx.y);
    }
}

export function previewPad(index = creatorSession.getActivePadIndex()) {
    const ctx = getPadPreviewContext(index);
    if (!ctx) return;

    let duration = 0;
    if (ctx.buffer) {
        duration = audioEngine.playBuffer(ctx.buffer, 'preview');
    }

    if (ctx.animation) {
        const animDuration = resolveStepLightDuration(
            { light: ctx.animation, syncToSound: ctx.syncToSound, duration: ctx.manualDuration },
            duration
        );
        triggerAnimation(ctx.animation, ctx.x, ctx.y, animDuration);
    }
}

function isMomentaryStepSelected() {
    const light = creatorSession.getCurrentStep()?.light;
    return Boolean(light && animations[light]?.type === 'momentary');
}

/**
 * Preview button: a click plays the selected step; a momentary light instead
 * plays while the button (or Space/Enter) is held down.
 */
export function initPreviewListeners() {
    const previewBtn = document.getElementById('creator-preview-pad');
    if (!previewBtn) return;

    const handleHoldRelease = () => {
        if (creatorSession.getActiveMomentaryPreview()) {
            stopPreview();
        }
    };

    listen(previewBtn, 'pointerdown', (e) => {
        if (previewBtn.disabled || e.button !== 0 || !isMomentaryStepSelected()) return;
        e.preventDefault();
        startHoldPreview();
    });
    listen(previewBtn, 'pointerup', handleHoldRelease);
    listen(previewBtn, 'pointerleave', handleHoldRelease);
    listen(previewBtn, 'pointercancel', handleHoldRelease);

    listen(previewBtn, 'click', () => {
        if (!isMomentaryStepSelected()) previewPad();
    });

    listen(previewBtn, 'keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && isMomentaryStepSelected()) {
            e.preventDefault();
            startHoldPreview();
        }
    });
    listen(previewBtn, 'keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') handleHoldRelease();
    });
}
