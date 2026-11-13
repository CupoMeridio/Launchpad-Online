/**
 * CUSTOM ANIMATION MODEL (customAnimationModel.js)
 *
 * User-drawn light animations: a list of frames, each a full snapshot of the
 * lit pads (pads not listed are off). Pure functions only: no DOM, timers or
 * LEDs, so everything here is testable headlessly.
 *
 *   animation = {
 *     id, name,
 *     playback: 'once' | 'hold',   // once: plays for a duration; hold: loops while the pad is held
 *     frames: [ { duration: <ms>, pads: { "x,y": { color, level } } } ]
 *   }
 *
 * A pad step refers to one with the light name `custom:<id>`. Whether a 'once'
 * animation stretches to the sample or keeps its own speed is decided by the
 * step's existing "sync to sound" option, not by the animation.
 *
 * For playback, frames are compiled into the engine's event format (see
 * `compileCustomAnimation`): one event per pad and run of identical colour.
 */

import { ANIMATION_COLORS, ANIMATION_COLOR_TIERS } from './constants.js';

export const CUSTOM_LIGHT_PREFIX = 'custom:';
export const PLAYBACK_MODES = Object.freeze(['once', 'hold']);
export const LIGHT_LEVELS = Object.freeze(['full', 'medium', 'low']);
export const MAX_CUSTOM_FRAMES = 256;
export const MIN_FRAME_DURATION_MS = 10;
export const MAX_FRAME_DURATION_MS = 10000;
export const DEFAULT_FRAME_DURATION_MS = 100;
export const CUSTOM_ANIMATION_ID_PATTERN = /^[a-z0-9-]{1,32}$/;

const GRID_SIZE = 8;

// ----------------------------------------------------------------------------
// Names and pad keys
// ----------------------------------------------------------------------------

/** @returns {string} The light name a pad step uses to reference the animation. */
export function customLightName(id) {
    return `${CUSTOM_LIGHT_PREFIX}${id}`;
}

/**
 * @param {*} lightName
 * @returns {string|null} The animation id of a `custom:<id>` light, otherwise null.
 */
export function parseCustomLightName(lightName) {
    return typeof lightName === 'string' && lightName.startsWith(CUSTOM_LIGHT_PREFIX)
        ? lightName.slice(CUSTOM_LIGHT_PREFIX.length)
        : null;
}

/** @returns {string} The key of a pad in a frame ("x,y"). */
export function padKey(x, y) {
    return `${x},${y}`;
}

/**
 * @param {string} key - "x,y"
 * @returns {[number, number]|null} Grid coordinates, or null if the key is not a pad of the 8x8 grid.
 */
export function parsePadKey(key) {
    const match = /^(\d),(\d)$/.exec(key);
    if (!match) return null;
    const [x, y] = [Number(match[1]), Number(match[2])];
    return x < GRID_SIZE && y < GRID_SIZE ? [x, y] : null;
}

// ----------------------------------------------------------------------------
// Creation and normalization
// ----------------------------------------------------------------------------

/**
 * @param {number} [duration]
 * @returns {{duration: number, pads: object}} An empty (all off) frame.
 */
export function createFrame(duration = DEFAULT_FRAME_DURATION_MS) {
    return { duration, pads: {} };
}

/**
 * A new id not used by `existingIds` ("anim-1", "anim-2", ...).
 * @param {Iterable<string>} existingIds
 * @returns {string}
 */
export function createCustomAnimationId(existingIds) {
    const taken = new Set(existingIds);
    let n = 1;
    while (taken.has(`anim-${n}`)) n++;
    return `anim-${n}`;
}

/**
 * @param {object} fields
 * @param {string} fields.id
 * @param {string} [fields.name]
 * @param {'once'|'hold'} [fields.playback]
 * @returns {object} An animation with one empty frame.
 */
export function createCustomAnimation({ id, name = '', playback = 'once' }) {
    return { id, name, playback, frames: [createFrame()] };
}

function normalizeCell(cell) {
    if (!cell || !ANIMATION_COLORS.includes(cell.color)) return null;
    return { color: cell.color, level: LIGHT_LEVELS.includes(cell.level) ? cell.level : 'full' };
}

function normalizeFrame(frame) {
    const duration = Number.isFinite(frame?.duration)
        ? Math.min(MAX_FRAME_DURATION_MS, Math.max(MIN_FRAME_DURATION_MS, frame.duration))
        : DEFAULT_FRAME_DURATION_MS;
    const pads = {};
    Object.entries(frame?.pads || {}).forEach(([key, cell]) => {
        const normalized = parsePadKey(key) && normalizeCell(cell);
        if (normalized) pads[key] = normalized;
    });
    return { duration, pads };
}

/**
 * Defensive copy of a (validated) animation with defaults for missing values;
 * cells with unknown colours or off-grid keys are dropped.
 * @param {object} raw
 * @returns {object}
 */
export function normalizeCustomAnimation(raw) {
    const frames = Array.isArray(raw?.frames) && raw.frames.length > 0 ? raw.frames.map(normalizeFrame) : [createFrame()];
    return {
        id: String(raw?.id ?? ''),
        name: typeof raw?.name === 'string' ? raw.name : '',
        playback: PLAYBACK_MODES.includes(raw?.playback) ? raw.playback : 'once',
        frames
    };
}

/**
 * @param {*} list - The `animations` field of a project.
 * @returns {object[]} Normalized animations (an absent field is an empty list).
 */
export function normalizeCustomAnimations(list) {
    return Array.isArray(list) ? list.map(normalizeCustomAnimation) : [];
}

// ----------------------------------------------------------------------------
// Compilation to engine events
// ----------------------------------------------------------------------------

/**
 * @typedef {object} CompiledLightEvent
 * @property {[number, number]} p - Pad coordinates.
 * @property {number} time - Start, in ms from the beginning.
 * @property {number} dur - How long the pad keeps this colour, in ms.
 * @property {string} color
 * @property {string} level - 'full' | 'medium' | 'low'.
 */

const sameCell = (a, b) => a.color === b.color && a.level === b.level;

/**
 * Compiles frames into timed events: a pad that keeps the same colour across
 * consecutive frames yields a single event, so the cost depends on changes,
 * not on the number of frames.
 * @param {object} animation - Normalized animation.
 * @returns {{events: CompiledLightEvent[], duration: number}} Events sorted by time, and the natural duration in ms.
 */
export function compileCustomAnimation(animation) {
    const events = [];
    const open = new Map(); // key -> { cell, start }
    const close = (key, end) => {
        const { cell, start } = open.get(key);
        events.push({ p: parsePadKey(key), time: start, dur: end - start, color: cell.color, level: cell.level });
        open.delete(key);
    };

    let time = 0;
    for (const frame of animation.frames) {
        for (const key of [...open.keys()]) {
            const next = frame.pads[key];
            if (!next || !sameCell(next, open.get(key).cell)) close(key, time);
        }
        for (const [key, cell] of Object.entries(frame.pads)) {
            if (!open.has(key)) open.set(key, { cell, start: time });
        }
        time += frame.duration;
    }
    for (const key of [...open.keys()]) close(key, time);

    // By time, then row and column, so the output is deterministic.
    events.sort((a, b) => (a.time - b.time) || (a.p[1] - b.p[1]) || (a.p[0] - b.p[0]));
    return { events, duration: time };
}

/**
 * Stretches or compresses compiled events to last `targetDuration` ms,
 * keeping the proportions between frames.
 * @param {{events: CompiledLightEvent[], duration: number}} compiled
 * @param {number} targetDuration
 * @returns {CompiledLightEvent[]}
 */
export function scaleCompiledEvents(compiled, targetDuration) {
    if (!(targetDuration > 0) || compiled.duration <= 0 || targetDuration === compiled.duration) {
        return compiled.events;
    }
    const factor = targetDuration / compiled.duration;
    return compiled.events.map(event => ({ ...event, time: event.time * factor, dur: event.dur * factor }));
}

// ----------------------------------------------------------------------------
// Device compatibility
// ----------------------------------------------------------------------------

/**
 * @param {object} animation
 * @returns {boolean} True if any frame uses a colour only RGB Launchpads can show.
 */
export function usesRgbOnlyColors(animation) {
    return animation.frames.some(frame =>
        Object.values(frame.pads).some(cell => ANIMATION_COLOR_TIERS[cell.color] === 'rgb')
    );
}

// ----------------------------------------------------------------------------
// Editing (pure operations on an animation; they mutate it in place)
// ----------------------------------------------------------------------------

/** @returns {boolean} True if `ms` is an allowed frame duration. */
export function isValidFrameDuration(ms) {
    return Number.isFinite(ms) && ms >= MIN_FRAME_DURATION_MS && ms <= MAX_FRAME_DURATION_MS;
}

const copyPads = pads => Object.fromEntries(Object.entries(pads).map(([key, cell]) => [key, { ...cell }]));

/**
 * Inserts an empty frame after `index`, with the same duration.
 * @returns {number} Index of the new frame, or -1 at the frame limit.
 */
export function addFrameAfter(animation, index) {
    if (animation.frames.length >= MAX_CUSTOM_FRAMES) return -1;
    animation.frames.splice(index + 1, 0, createFrame(animation.frames[index]?.duration ?? DEFAULT_FRAME_DURATION_MS));
    return index + 1;
}

/**
 * Inserts a copy of frame `index` right after it.
 * @returns {number} Index of the copy, or -1 at the frame limit.
 */
export function duplicateFrame(animation, index) {
    const source = animation.frames[index];
    if (!source || animation.frames.length >= MAX_CUSTOM_FRAMES) return -1;
    animation.frames.splice(index + 1, 0, { duration: source.duration, pads: copyPads(source.pads) });
    return index + 1;
}

/** Removes frame `index`; an animation always keeps at least one frame. */
export function removeFrame(animation, index) {
    if (animation.frames.length <= 1 || !animation.frames[index]) return false;
    animation.frames.splice(index, 1);
    return true;
}

/**
 * Moves frame `index` by `delta` positions.
 * @returns {number} The new index, or -1 if it cannot move.
 */
export function moveFrame(animation, index, delta) {
    const target = index + delta;
    if (!animation.frames[index] || target < 0 || target >= animation.frames.length) return -1;
    const [frame] = animation.frames.splice(index, 1);
    animation.frames.splice(target, 0, frame);
    return target;
}

/**
 * Paints one pad of a frame with a brush. Painting a pad with the colour and
 * level it already has turns it off, so a click toggles it.
 * @param {{pads: object}} frame
 * @param {number} x
 * @param {number} y
 * @param {{color: string, level: string, erase?: boolean}} brush
 * @returns {boolean} True if the frame changed.
 */
export function paintFrameCell(frame, x, y, brush) {
    const key = padKey(x, y);
    const current = frame.pads[key];
    if (brush.erase || (current && current.color === brush.color && current.level === brush.level)) {
        if (!current) return false;
        delete frame.pads[key];
        return true;
    }
    frame.pads[key] = { color: brush.color, level: brush.level };
    return true;
}

/**
 * The colours an animation uses, most visible first: each colour weighs the
 * pads it lights times how long they stay lit (frame duration). So the order
 * reflects what the animation looks like, not the order it was drawn in.
 * Equal weights keep the order of first appearance. Brightness is ignored.
 * @param {object} animation
 * @returns {string[]}
 */
export function getCustomAnimationColors(animation) {
    const weights = new Map(); // insertion order = first appearance
    animation.frames.forEach(frame => Object.values(frame.pads).forEach(cell => {
        weights.set(cell.color, (weights.get(cell.color) ?? 0) + frame.duration);
    }));
    // Array.prototype.sort is stable: ties stay in order of first appearance.
    return [...weights.keys()].sort((a, b) => weights.get(b) - weights.get(a));
}

/**
 * Sets one pad of a frame to a cell (or turns it off with null), without toggling.
 * Used while dragging a stroke across pads.
 * @returns {boolean} True if the frame changed.
 */
export function setFrameCell(frame, x, y, cell) {
    const key = padKey(x, y);
    const current = frame.pads[key];
    if (!cell) {
        if (!current) return false;
        delete frame.pads[key];
        return true;
    }
    if (current && sameCell(current, cell)) return false;
    frame.pads[key] = { color: cell.color, level: cell.level };
    return true;
}

const cellAt = (pads, x, y) => pads[padKey(x, y)] ?? null;
const sameOrOff = (a, b) => (a === null || b === null ? a === b : sameCell(a, b));

/**
 * Paint bucket: fills the region of identical pads (same colour and level, or
 * all off) connected to (x, y) horizontally or vertically.
 * @param {{pads: object}} frame
 * @param {number} x
 * @param {number} y
 * @param {{color: string, level: string}|null} cell - null clears the region.
 * @returns {boolean} True if the frame changed.
 */
export function floodFillFrame(frame, x, y, cell) {
    const target = cellAt(frame.pads, x, y);
    if (sameOrOff(target, cell)) return false;
    const pending = [[x, y]];
    const seen = new Set();
    while (pending.length > 0) {
        const [px, py] = pending.pop();
        const key = padKey(px, py);
        if (px < 0 || py < 0 || px >= GRID_SIZE || py >= GRID_SIZE || seen.has(key)) continue;
        seen.add(key);
        if (!sameOrOff(cellAt(frame.pads, px, py), target)) continue;
        setFrameCell(frame, px, py, cell);
        pending.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    return true;
}

const LAST = GRID_SIZE - 1;
const wrap = n => (n + GRID_SIZE) % GRID_SIZE;

/**
 * Whole-frame transforms: each maps a pad to its new position. Shifts wrap
 * around the edges, so moving a drawing eight times brings it back.
 */
export const FRAME_TRANSFORMS = Object.freeze({
    shiftLeft: (x, y) => [wrap(x - 1), y],
    shiftRight: (x, y) => [wrap(x + 1), y],
    shiftUp: (x, y) => [x, wrap(y - 1)],
    shiftDown: (x, y) => [x, wrap(y + 1)],
    flipHorizontal: (x, y) => [LAST - x, y],
    flipVertical: (x, y) => [x, LAST - y],
    rotateClockwise: (x, y) => [LAST - y, x],
    rotateCounterClockwise: (x, y) => [y, LAST - x]
});

/**
 * @param {object} pads - A frame's pads.
 * @param {string} name - A key of FRAME_TRANSFORMS.
 * @returns {object|null} The transformed pads (a new object), or null for an unknown transform.
 */
export function transformFramePads(pads, name) {
    const move = FRAME_TRANSFORMS[name];
    if (!move) return null;
    const result = {};
    Object.entries(pads).forEach(([key, cell]) => {
        const [x, y] = parsePadKey(key);
        result[padKey(...move(x, y))] = { ...cell };
    });
    return result;
}

/** @returns {object} A deep copy of a frame's pads (e.g. for the frame clipboard). */
export function copyFramePads(pads) {
    return copyPads(pads);
}

/**
 * Below this a frame can be skipped by the screen (two refreshes at 60 Hz).
 */
export const MIN_VISIBLE_FRAME_MS = 34;

/**
 * The shortest frame once the animation is stretched or compressed to `targetMs`
 * (e.g. synced to a sample), to warn about frames too short to be seen.
 * @param {object} animation
 * @param {number} [targetMs] - Omitted or invalid: natural speed.
 * @returns {number} Milliseconds.
 */
export function getShortestFrameMs(animation, targetMs) {
    const natural = animation.frames.reduce((sum, frame) => sum + frame.duration, 0);
    const factor = targetMs > 0 && natural > 0 ? targetMs / natural : 1;
    return Math.min(...animation.frames.map(frame => frame.duration)) * factor;
}
