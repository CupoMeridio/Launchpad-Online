import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('project and draft layout values never overwrite the user preference', () => {
    // Runs the real ui.js/appearance.js with minimal browser stubs, because the
    // defect only shows up through the storage side effects of the real modules.
    const script = `
        const elements = {};
        for (const id of ['Launchpad', 'rotation-slider', 'rotation-input', 'size-slider', 'size-input']) {
            elements[id] = { id, value: '', style: {} };
        }
        globalThis.document = {
            visibilityState: 'visible',
            addEventListener() {},
            getElementById: id => elements[id] || null,
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ style: {}, classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, addEventListener() {}, setAttribute() {} })
        };
        globalThis.window = { addEventListener() {}, dispatchEvent() {} };
        globalThis.CustomEvent = class {
            constructor(type, options) { this.type = type; this.detail = options?.detail; }
        };
        const storage = new Map();
        globalThis.localStorage = {
            getItem: key => (storage.has(key) ? storage.get(key) : null),
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key)
        };
        const assert = (condition, message) => { if (!condition) throw new Error(message); };

        const ui = await import('./js/ui.js');
        const { applyLayout } = await import('./js/appearance.js');
        const transform = () => elements.Launchpad.style.transform;

        // The user picks 30° / 90% through the personalization menu
        ui.setLaunchpadRotation(30);
        ui.setLaunchpadSize(90);
        assert(storage.get('launchpad.rotation') === '30', 'rotation preference persisted');
        assert(storage.get('launchpad.scale') === '0.9', 'size preference persisted');

        // A project specifying 45° / 80% is applied as a transient override
        applyLayout(45, 80);
        assert(transform() === 'rotate(45deg) scale(0.8)', 'project layout applied, got ' + transform());
        assert(storage.get('launchpad.rotation') === '30', 'project rotation must not persist');
        assert(storage.get('launchpad.scale') === '0.9', 'project size must not persist');
        assert(ui.getLaunchpadRotation() === 30, 'preference getter ignores the override');
        assert(ui.getLaunchpadSize() === 90, 'preference getter ignores the override');

        // A later project without layout restores what the user had set
        applyLayout(null, null);
        assert(transform() === 'rotate(30deg) scale(0.9)', 'user preference restored, got ' + transform());

        // Moving the Studio draft slider is an override too
        ui.setLaunchpadRotation(120, false);
        assert(storage.get('launchpad.rotation') === '30', 'draft slider must not persist');
        applyLayout(null, null);
        assert(transform() === 'rotate(30deg) scale(0.9)', 'draft override reverted, got ' + transform());
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: workspaceRoot,
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});
