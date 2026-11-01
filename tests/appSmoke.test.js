import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

test('project editor uses the existing Launchpad grid and a separate inspector', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');

    assert.equal((html.match(/id="Launchpad"/g) || []).length, 1);
    assert.match(html, /id="project-inspector"/);
    assert.match(html, /id="toggle-project-creator"/);
    assert.doesNotMatch(html, /id="app-mode-bar"/);
    assert.match(html, /id="creator-import-project"/);
    assert.match(html, /id="creator-project-zip-input"/);
    assert.match(html, /id="creator-unsaved-dialog"/);
    assert.match(html, /id="studio-mode-edit"/);
    assert.match(html, /id="studio-mode-live"/);
    assert.match(html, /id="creator-hold-hint"/);
    assert.match(html, /id="creator-assigned-light"/);
    assert.match(html, /id="studio-live-toolbar"/);
    assert.match(html, /id="studio-live-project-name"/);
    assert.match(html, /id="studio-live-page-indicator"/);
    assert.match(html, /id="studio-exit-live"/);
    assert.doesNotMatch(html, /project-creator-overlay|creator-pad-grid/);
    assert.doesNotMatch(html, /creator-sound-catalog|creator-sound-library/);
    assert.doesNotMatch(html, /creator-volume|creator-trigger-mode|project-creator-bpm/);
});

test('every project editor DOM id exists in the application shell', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
    const source = readFileSync(path.join(workspaceRoot, 'js/projectCreator.js'), 'utf8');
    const elementIds = [...source.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1]);

    for (const elementId of elementIds) {
        assert.ok(html.includes(`id="${elementId}"`), `Missing project editor element: ${elementId}`);
    }
});

test('application shell contains no emoji pictographs', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
    const emojiRegex = /\p{RGI_Emoji}/v;
    assert.equal(emojiRegex.test(html), false, 'index.html should not contain any emoji characters');
});

test('main menu integrates personalization tabs, subpanels, and appearance reset', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');

    assert.match(html, /id="customization-menu"/);
    assert.match(html, /data-menu="customization-menu"/);
    assert.match(html, /id="customization-panel-launchpad"/);
    assert.match(html, /id="customization-panel-background"/);
    assert.match(html, /id="customization-panel-visualizer"/);
    assert.match(html, /id="personalize-launchpad-menu"/);
    assert.match(html, /id="background-menu"/);
    assert.match(html, /id="visualizer-menu"/);
    assert.match(html, /id="reset-project-appearance"/);
});

test('application defines resizers for sidebar and project inspector', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');

    assert.match(html, /id="sidebar-resizer"/);
    assert.match(html, /id="inspector-resizer"/);
});

test('customization menu defines UI accent color picker and reset button', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');

    assert.match(html, /id="ui-accent-color-picker"/);
    assert.match(html, /id="ui-accent-reset-btn"/);
});

