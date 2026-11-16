/**
 * CUSTOM ANIMATION EDITOR (creator/animationEditor.js)
 *
 * The "Custom lights" view of the Studio: the project's animation library,
 * the frames of the selected animation, the brush, and the current frame drawn
 * on the Launchpad (virtual and physical). While this view is open, pad presses
 * paint the current frame (see the pad source in creator/index.js).
 */

import { ANIMATION_COLORS, ANIMATION_COLOR_TIERS, LAUNCHPAD_COLS, LAUNCHPAD_PADS } from '../constants.js';
import { MAX_CUSTOM_FRAMES, padKey } from '../customAnimationModel.js';
import { previewCustomAnimation } from '../customAnimations.js';
import { getTranslation, translate } from '../i18n.js';
import { flushPhysicalColors, getLpColor, setPhysicalColor } from '../physicalInterface.js';
import { creatorSession } from '../projectCreatorState.js';
import { getPadElement, setWebColor, webColorMap } from '../webInterface.js';
import { listen, setProps } from './dom.js';

/** True while the current frame is shown on the Launchpad. */
let canvasPainted = false;
let previewTimer = null;

/**
 * The colour code the canvas last sent to each hardware pad, by pad index.
 * Legacy Launchpads take LED messages slowly and a drag repaints the canvas
 * once per pad crossed, so during a drag only the pads that changed are sent.
 * Every other repaint sends all of them and starts this record afresh, so a
 * LED changed by anything else is corrected by the next click at the latest
 * (and a newly connected device gets the whole frame: see creator/index.js).
 */
const sentToDevice = new Map();
/** False for a full repaint: every pad is sent. */
let sendChangesOnly = false;

/** Queues a pad's colour for the hardware, unless it already shows it. */
function sendPadColor(index, p, lpColor) {
    if (lpColor === null || lpColor === undefined) return; // No device
    const code = typeof lpColor === 'number' ? lpColor : lpColor.code;
    if (sendChangesOnly && sentToDevice.get(index) === code) return;
    sentToDevice.set(index, code);
    setPhysicalColor(lpColor, p);
}

function isAnimationViewOpen() {
    return creatorSession.isEditorActive() && creatorSession.getActiveCreatorView() === 'animations';
}

/** Colours the brush offers: legacy targets only get colours their LEDs can show. */
function getBrushColors() {
    const legacyOnly = creatorSession.getDraft()?.targetDevice === 'legacy';
    return ANIMATION_COLORS.filter(color => !legacyOnly || ANIMATION_COLOR_TIERS[color] === 'legacy');
}

// ----------------------------------------------------------------------------
// Launchpad canvas
// ----------------------------------------------------------------------------

/** Brightness of the previous frame under the onion skin (virtual pads only). */
const ONION_LEVEL = 0.2;

/** Removes the Studio's pad decorations (assigned light ring, selection, steps badge). */
function stripPadDecorations(pad) {
    pad.classList.remove('creator-pad-assigned', 'creator-pad-selected', 'creator-pad-colorless');
    delete pad.dataset.creatorLed;
    delete pad.dataset.steps;
    pad.style.removeProperty('--creator-led-color');
}

/**
 * A pad that is off in the current frame but lit in the previous one: shown
 * faint and outlined on screen. The hardware stays off, where a faint pad
 * could not be told apart from a "low" one.
 */
function paintOnionPad(index, cell) {
    const p = [index % LAUNCHPAD_COLS, Math.floor(index / LAUNCHPAD_COLS)];
    setWebColor(cell.color, p, ONION_LEVEL);
    sendPadColor(index, p, getLpColor('off'));
    getPadElement(index).dataset.onion = '';
}

function paintPad(index, cell) {
    const p = [index % LAUNCHPAD_COLS, Math.floor(index / LAUNCHPAD_COLS)];
    if (cell) {
        setWebColor(cell.color, p, cell.level);
        sendPadColor(index, p, getLpColor(cell.color, cell.level));
    } else {
        setWebColor('off', p);
        sendPadColor(index, p, getLpColor('off'));
    }
}

function paintFrame(frame, ghost) {
    for (let index = 0; index < LAUNCHPAD_PADS; index++) {
        const pad = getPadElement(index);
        if (!pad) continue;
        stripPadDecorations(pad);
        delete pad.dataset.onion;
        const key = padKey(index % LAUNCHPAD_COLS, Math.floor(index / LAUNCHPAD_COLS));
        const cell = frame?.pads[key];
        if (!cell && ghost?.pads[key]) {
            paintOnionPad(index, ghost.pads[key]);
        } else {
            paintPad(index, cell);
        }
    }
    flushPhysicalColors();
}

/** Turns off the LEDs painted by the editor (virtual and physical). */
export function clearAnimationCanvas() {
    clearTimeout(previewTimer);
    if (!canvasPainted) return;
    canvasPainted = false;
    sendChangesOnly = false;
    for (let index = 0; index < LAUNCHPAD_PADS; index++) {
        const pad = getPadElement(index);
        if (pad) delete pad.dataset.onion;
        paintPad(index, null);
    }
    flushPhysicalColors();
    sentToDevice.clear(); // Others (previews, performance) drive the LEDs from here on
}

/**
 * Shows the current frame on the Launchpad while the animation view is open,
 * and clears it when the view is left.
 */
export function syncAnimationCanvas() {
    repaintCanvas(false);
}

/** Like syncAnimationCanvas, sending the hardware only the pads that changed (dragging). */
export function syncAnimationCanvasChanges() {
    repaintCanvas(true);
}

function repaintCanvas(changesOnly) {
    if (!isAnimationViewOpen()) {
        clearAnimationCanvas();
        return;
    }
    sendChangesOnly = changesOnly && canvasPainted;
    if (!sendChangesOnly) sentToDevice.clear();

    const ghost = creatorSession.isOnionSkinEnabled() ? creatorSession.getPreviousFrame() : null;
    paintFrame(creatorSession.getActiveFrame(), ghost);
    canvasPainted = true;
}

/** Plays the selected animation once, then shows the current frame again. */
function previewActiveAnimation() {
    const animation = creatorSession.getActiveAnimation();
    if (!animation) return;
    clearAnimationCanvas();
    const duration = previewCustomAnimation(animation.id);
    previewTimer = setTimeout(syncAnimationCanvas, duration + 50);
}

// ----------------------------------------------------------------------------
// Panel
// ----------------------------------------------------------------------------

function renderLibrary(animations, active) {
    const list = document.getElementById('creator-anim-list');
    if (list) {
        list.replaceChildren(...animations.map(animation => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'creator-page-tab creator-anim-tab';
            button.classList.toggle('selected', animation === active);
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(animation === active));
            button.textContent = animation.name || getTranslation('creator.anim.untitled');
            button.title = button.textContent;
            button.addEventListener('click', () => creatorSession.selectAnimation(animation.id));
            return button;
        }));
    }
    setProps('creator-anim-empty', { hidden: animations.length > 0 });
    setProps('creator-anim-delete', { disabled: !active });
    setProps('creator-anim-editor', { hidden: !active });
}

function renderFrames(animation, frameIndex) {
    const frames = animation.frames;
    const pills = document.getElementById('creator-anim-frames');
    if (pills) {
        pills.replaceChildren(...frames.map((_frame, index) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'creator-step-pill';
            pill.classList.toggle('selected', index === frameIndex);
            pill.setAttribute('role', 'tab');
            pill.setAttribute('aria-selected', String(index === frameIndex));
            pill.textContent = String(index + 1);
            pill.addEventListener('click', () => creatorSession.selectFrame(index));
            return pill;
        }));
    }
    const atLimit = frames.length >= MAX_CUSTOM_FRAMES;
    setProps('creator-anim-frame-indicator', { textContent: translate('creator.anim.frameIndicator', { frame: frameIndex + 1, total: frames.length }) });
    setProps('creator-anim-add-frame', { disabled: atLimit });
    setProps('creator-anim-duplicate-frame', { disabled: atLimit });
    setProps('creator-anim-delete-frame', { disabled: frames.length <= 1 });
    setProps('creator-anim-move-left', { disabled: frameIndex === 0 });
    setProps('creator-anim-move-right', { disabled: frameIndex === frames.length - 1 });

    const totalMs = frames.reduce((sum, frame) => sum + frame.duration, 0);
    setProps('creator-anim-total', { textContent: translate('creator.anim.totalDuration', { seconds: (totalMs / 1000).toFixed(2) }) });
}

function renderBrush() {
    const brush = creatorSession.getBrush();
    const palette = document.getElementById('creator-anim-palette');
    if (palette) {
        const swatches = getBrushColors().map(color => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'creator-animation-swatch';
            button.classList.toggle('selected', !brush.erase && brush.color === color);
            button.classList.toggle('is-rgb', ANIMATION_COLOR_TIERS[color] === 'rgb');
            const label = getTranslation(`creator.led${color[0].toUpperCase()}${color.slice(1)}`);
            button.title = label;
            button.setAttribute('aria-label', label);
            const dot = document.createElement('span');
            dot.className = 'creator-light-swatch';
            dot.style.setProperty('--preset-color', webColorMap[color].baseColor);
            button.appendChild(dot);
            button.addEventListener('click', () => creatorSession.setBrush({ color, erase: false }));
            return button;
        });
        const eraser = document.createElement('button');
        eraser.type = 'button';
        eraser.className = 'creator-animation-swatch creator-anim-eraser';
        eraser.classList.toggle('selected', brush.erase);
        eraser.title = getTranslation('creator.anim.eraser');
        eraser.setAttribute('aria-label', eraser.title);
        eraser.textContent = '⌫';
        eraser.addEventListener('click', () => creatorSession.setBrush({ erase: true }));
        palette.replaceChildren(...swatches, eraser);
    }
    setProps('creator-anim-level', { value: brush.level, disabled: brush.erase });
    setProps('creator-anim-tool', { value: brush.tool });
}

/**
 * Inputs the user is typing in are their own source of truth: only write a
 * different value, so the caret is never moved.
 */
function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input && input.value !== String(value)) input.value = value;
}

export function renderAnimationEditor() {
    const animations = creatorSession.getAnimations();
    const active = creatorSession.getActiveAnimation();
    renderLibrary(animations, active);
    if (!active) return;

    setInputValue('creator-anim-name', active.name);
    setProps('creator-anim-playback', { value: active.playback });
    renderFrames(active, creatorSession.getActiveFrameIndex());
    setInputValue('creator-anim-frame-duration', creatorSession.getActiveFrame()?.duration ?? '');
    setProps('creator-anim-paste-frame', { disabled: !creatorSession.hasFrameClipboard() });
    setProps('creator-anim-onion', { checked: creatorSession.isOnionSkinEnabled() });
    renderBrush();
}

// ----------------------------------------------------------------------------
// Listeners
// ----------------------------------------------------------------------------

export function initAnimationEditorListeners() {
    listen('creator-anim-new', 'click', () => creatorSession.createAnimation());
    listen('creator-anim-delete', 'click', () => {
        const active = creatorSession.getActiveAnimation();
        if (!active) return;
        const name = active.name || getTranslation('creator.anim.untitled');
        if (window.confirm(translate('creator.anim.confirmDelete', { name }))) {
            creatorSession.deleteAnimation(active.id);
        }
    });
    listen('creator-anim-name', 'input', event => creatorSession.renameAnimation(event.target.value));
    listen('creator-anim-playback', 'change', event => creatorSession.setAnimationPlayback(event.target.value));

    listen('creator-anim-add-frame', 'click', () => creatorSession.addFrame());
    listen('creator-anim-duplicate-frame', 'click', () => creatorSession.duplicateActiveFrame());
    listen('creator-anim-delete-frame', 'click', () => creatorSession.deleteActiveFrame());
    listen('creator-anim-move-left', 'click', () => creatorSession.moveActiveFrame(-1));
    listen('creator-anim-move-right', 'click', () => creatorSession.moveActiveFrame(1));

    // Invalid values are ignored while typing and reverted when committed.
    const durationInput = document.getElementById('creator-anim-frame-duration');
    listen(durationInput, 'input', event => creatorSession.setFrameDuration(event.target.value));
    listen(durationInput, 'change', () => {
        if (!creatorSession.setFrameDuration(durationInput.value)) {
            durationInput.value = creatorSession.getActiveFrame()?.duration ?? '';
        }
    });

    listen('creator-anim-copy-frame', 'click', () => creatorSession.copyActiveFrame());
    listen('creator-anim-paste-frame', 'click', () => creatorSession.pasteIntoActiveFrame());
    listen('creator-anim-onion', 'change', event => creatorSession.setOnionSkin(event.target.checked));

    listen('creator-anim-level', 'change', event => creatorSession.setBrush({ level: event.target.value }));
    listen('creator-anim-tool', 'change', event => creatorSession.setBrush({ tool: event.target.value }));
    listen('creator-anim-transforms', 'click', event => {
        const button = event.target.closest('[data-transform]');
        if (!button) return;
        const allFrames = Boolean(document.getElementById('creator-anim-transform-all')?.checked);
        creatorSession.transformFrames(button.dataset.transform, allFrames);
    });
    listen('creator-anim-clear-frame', 'click', () => creatorSession.clearActiveFrame());
    listen('creator-anim-preview', 'click', previewActiveAnimation);
}
