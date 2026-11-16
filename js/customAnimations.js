/**
 * CUSTOM ANIMATIONS RUNTIME (customAnimations.js)
 *
 * Plays user-drawn animations (see customAnimationModel.js) on the virtual and
 * physical Launchpad through the shared fade engine, and makes them available
 * in the animation registry as `custom:<id>`, next to the built-in ones, so
 * pads, previews and releases treat them like any other light.
 *
 * Two scopes are registered: the active project's animations and, while the
 * Studio is open, the draft's. The draft wins, so edits preview immediately.
 */

import { fader, activeAnimations } from './animationEngine.js';
import { animations } from './animationLibrary.js';
import {
    compileCustomAnimation,
    scaleCompiledEvents,
    customLightName,
    parseCustomLightName,
    padKey
} from './customAnimationModel.js';

/**
 * One running instance of a custom animation on a pad.
 * - once: plays its events (scaled to the requested duration) and ends;
 * - loop (hold): repeats at natural speed until stopped.
 */
class CustomAnimationPlayback {
    /**
     * @param {{events: object[], duration: number}} compiled
     * @param {{loop: boolean, targetDuration?: number, onFinish?: function(): void}} options
     */
    constructor(compiled, { loop, targetDuration, onFinish }) {
        this.loop = loop;
        this.events = loop ? compiled.events : scaleCompiledEvents(compiled, targetDuration);
        this.cycle = loop || !(targetDuration > 0) ? compiled.duration : targetDuration;
        this.startTime = performance.now();
        this.cursor = 0;
        this.stopped = false;
        this.litPads = new Map(); // key -> [x, y]
        this.onFinish = onFinish;
    }

    update(now) {
        if (this.stopped) return true;
        let elapsed = now - this.startTime;
        if (this.loop && elapsed >= this.cycle) {
            const cycles = Math.floor(elapsed / this.cycle);
            this.startTime += cycles * this.cycle;
            elapsed -= cycles * this.cycle;
            this.cursor = 0;
        }
        while (this.cursor < this.events.length && elapsed >= this.events[this.cursor].time) {
            this.trigger(this.events[this.cursor]);
            this.cursor++;
        }
        // Finished only once the whole duration has elapsed, so a restart during the
        // last frame can still stop it and clear its pads.
        const finished = !this.loop && this.cursor >= this.events.length && elapsed >= this.cycle;
        if (finished) this.onFinish?.();
        return finished;
    }

    trigger(event) {
        // Scheduled start, not "now": a late tick must not shift the rest of the animation.
        fader.add(event.p, event.color, event.dur, 'steady', { level: event.level, start: this.startTime + event.time });
        this.litPads.set(padKey(...event.p), event.p);
    }

    /** Ends the playback and turns off the pads it lit. */
    stop() {
        if (this.stopped) return;
        this.stopped = true;
        this.litPads.forEach(p => fader.add(p, 'off', 0, 'instant'));
        this.onFinish?.();
    }
}

// ----------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------

/** @type {{project: Map<string, object>, draft: Map<string, object>}} id -> { animation, compiled } */
const scopes = { project: new Map(), draft: new Map() };
/** Running playbacks by `<id>@<x>,<y>`: pressing the pad again restarts it. */
const playbacks = new Map();
/** The Studio preview, by animation id (at most one runs). */
let preview = null;

function resolve(id) {
    return scopes.draft.get(id) ?? scopes.project.get(id) ?? null;
}

function play(id, x, y, durationMs) {
    const entry = resolve(id);
    if (!entry) return;
    const key = `${id}@${padKey(x, y)}`;
    playbacks.get(key)?.stop();

    const playback = new CustomAnimationPlayback(entry.compiled, {
        loop: entry.animation.playback === 'hold',
        targetDuration: durationMs,
        onFinish: () => {
            if (playbacks.get(key) === playback) playbacks.delete(key);
        }
    });
    playbacks.set(key, playback);
    activeAnimations.add(playback);
    playback.update(playback.startTime); // Light frame 0 now, not on the next tick
}

function stop(id, x, y) {
    playbacks.get(`${id}@${padKey(x, y)}`)?.stop();
}

function registryEntry(id, animation) {
    return {
        custom: true,
        type: animation.playback === 'hold' ? 'momentary' : 'fixed',
        on: (x, y, durationMs) => play(id, x, y, durationMs),
        off: (x, y) => stop(id, x, y)
    };
}

/**
 * Registers the custom animations of a scope, replacing that scope's previous ones.
 * @param {'project'|'draft'} scope
 * @param {object[]} list - Normalized animations.
 */
export function setCustomAnimations(scope, list) {
    const affected = new Set([...scopes.project.keys(), ...scopes.draft.keys()]);
    scopes[scope] = new Map(list.map(animation => [animation.id, { animation, compiled: compileCustomAnimation(animation) }]));
    scopes[scope].forEach((_, id) => affected.add(id));

    affected.forEach(id => {
        const entry = resolve(id);
        if (entry) {
            animations[customLightName(id)] = registryEntry(id, entry.animation);
        } else {
            delete animations[customLightName(id)];
            stopAllPlaybacks(id);
        }
    });
}

/** Stops every running instance of a removed animation, so none of its pads stay lit. */
function stopAllPlaybacks(id) {
    playbacks.forEach((playback, key) => {
        if (key.startsWith(`${id}@`)) playback.stop();
    });
    if (preview?.id === id) preview.playback.stop();
}

/**
 * Natural duration of a custom light, used when the light is not synced to a sound.
 * @param {string} lightName
 * @returns {number|null} Seconds, or null for lights that are not custom animations.
 */
export function getCustomAnimationDuration(lightName) {
    const id = parseCustomLightName(lightName);
    const entry = id === null ? null : resolve(id);
    return entry ? entry.compiled.duration / 1000 : null;
}

/**
 * Plays an animation once at its natural speed, whatever its playback mode
 * (Studio preview). A new preview replaces the previous one.
 * @param {string} id
 * @returns {number} The preview length in ms (0 if the animation is unknown).
 */
export function previewCustomAnimation(id) {
    const entry = resolve(id);
    preview?.playback.stop();
    preview = null;
    if (!entry) return 0;
    const playback = new CustomAnimationPlayback(entry.compiled, { loop: false });
    preview = { id, playback };
    activeAnimations.add(playback);
    playback.update(playback.startTime);
    return entry.compiled.duration;
}
