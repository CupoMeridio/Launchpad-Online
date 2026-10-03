import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('application entrypoint imports with minimal browser API stubs', () => {
    const smokeScript = `
        globalThis.document = { visibilityState: 'visible', addEventListener() {} };
        globalThis.window = { addEventListener() {}, dispatchEvent() {} };
        globalThis.requestAnimationFrame = () => 1;
        globalThis.cancelAnimationFrame = () => {};
        globalThis.CustomEvent = class {
            constructor(type, options) {
                this.type = type;
                this.detail = options?.detail;
            }
        };
        await import('./js/app.js');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', smokeScript], {
        cwd: workspaceRoot,
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});