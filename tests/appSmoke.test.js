import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
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
    const creatorDir = path.join(workspaceRoot, 'js', 'creator');
    const source = readdirSync(creatorDir)
        .filter(name => name.endsWith('.js'))
        .map(name => readFileSync(path.join(creatorDir, name), 'utf8'))
        .join('\n');
    // Ids looked up directly or passed to the creator's listen('<id>', ...) helper.
    const elementIds = [...source.matchAll(/(?:getElementById|listen)\('([^']+)'/g)].map(match => match[1]);
    assert.ok(elementIds.length > 50, 'creator modules must be scanned');

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

test('application defines resizers for sidebar and project inspector with accessibility attributes', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');

    assert.match(html, /id="sidebar-resizer"[^>]*role="separator"/);
    assert.match(html, /id="sidebar-resizer"[^>]*aria-valuenow="260"/);
    assert.match(html, /id="sidebar-resizer"[^>]*aria-valuemin="200"/);
    assert.match(html, /id="sidebar-resizer"[^>]*aria-valuemax="520"/);

    assert.match(html, /id="inspector-resizer"[^>]*role="separator"/);
    assert.match(html, /id="inspector-resizer"[^>]*aria-valuenow="310"/);
    assert.match(html, /id="inspector-resizer"[^>]*aria-valuemin="260"/);
    assert.match(html, /id="inspector-resizer"[^>]*aria-valuemax="650"/);
});

test('accent reset button does not use !important or hardcoded colors', () => {
    const css = readFileSync(path.join(workspaceRoot, 'css', 'sidebar.css'), 'utf8');
    const resetRuleMatch = css.match(/\.menu-dropdown \.accent-reset-btn\s*\{([^}]+)\}/);
    assert.ok(resetRuleMatch, 'accent-reset-btn rule exists in sidebar.css');
    assert.strictEqual(resetRuleMatch[1].includes('!important'), false, 'accent-reset-btn should not have !important declarations');
    assert.strictEqual(resetRuleMatch[1].includes('#2b2b2b'), false, 'accent-reset-btn should use CSS custom properties instead of hardcoded hex');
});

test('customization menu defines UI accent color picker and reset button', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');

    assert.match(html, /id="ui-accent-color-picker"/);
    assert.match(html, /id="ui-accent-reset-btn"/);
});

test('launchpad pads use color-mix emissive LED layer and synchronized glow', () => {
    const css = readFileSync(path.join(workspaceRoot, 'css', 'launchpad.css'), 'utf8');

    assert.ok(css.includes('--led-color'), 'launchpad.css defines --led-color custom property');
    assert.ok(css.includes('--led-level'), 'launchpad.css defines --led-level custom property');
    assert.ok(css.includes('color-mix(in srgb, var(--led-color'), 'launchpad.css mixes LED layer with pad base');
});

test('white LED styling provides dynamic dark contrast ring and monotonic glow', () => {
    const css = readFileSync(path.join(workspaceRoot, 'css', 'launchpad.css'), 'utf8');
    assert.match(css, /\[data-led-color="white"\]/);
    assert.match(css, /var\(--led-level\) \* 1\.5px/);
    assert.match(css, /0 0 calc\(var\(--led-level\) \* 16px\) rgba\(255, 255, 255/);
});

test('creator target warning element exists and uses CSS custom properties', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
    assert.match(html, /id="creator-target-warning"/);
    const css = readFileSync(path.join(workspaceRoot, 'css', 'style.css'), 'utf8');
    assert.match(css, /--warning-color:\s*#ffaa00;/);
    assert.match(css, /--warning-bg:\s*rgba\(255,\s*170,\s*0,\s*0\.12\);/);
    assert.match(css, /--warning-border:\s*rgba\(255,\s*170,\s*0,\s*0\.3\);/);
    const creatorCss = readFileSync(path.join(workspaceRoot, 'css', 'creator.css'), 'utf8');
    assert.match(creatorCss, /color:\s*var\(--warning-color\);/);
});

test('component stylesheets are present and registered in app shell', () => {
    const swJs = readFileSync(path.join(workspaceRoot, 'service-worker.js'), 'utf8');
    assert.match(swJs, /css\/sidebar\.css/);
    assert.match(swJs, /css\/creator\.css/);

    const creatorLoaderJs = readFileSync(path.join(workspaceRoot, 'js', 'creatorLoader.js'), 'utf8');
    assert.match(creatorLoaderJs, /css\/creator\.css/);
});

test('--pad-rest is declared per model skin and wired to white LED styling for monotonic brightness', () => {
    const css = readFileSync(path.join(workspaceRoot, 'css', 'launchpad.css'), 'utf8');

    // Base skin pad-rest
    assert.match(css, /--pad-rest:\s*#d3d3d3;/);
    // MK3 skin pad-rest
    assert.match(css, /\.launchpad-model-mk3[\s\S]*?--pad-rest:\s*#e2e4e8;/);
    // Pro skin pad-rest
    assert.match(css, /\.launchpad-model-pro[\s\S]*?--pad-rest:\s*#dce0e6;/);

    // White LED rules map pad-base to pad-rest
    assert.match(css, /\[data-led-color="white"\][\s\S]*?--pad-base:\s*var\(--pad-rest\);/);
});

test('resizer bars use dedicated handle color custom properties and avoid text-bright for backgrounds', () => {
    const css = readFileSync(path.join(workspaceRoot, 'css', 'style.css'), 'utf8');

    assert.match(css, /--resizer-handle-color:\s*rgba\(255,\s*255,\s*255,\s*0\.2\);/);
    assert.match(css, /--resizer-handle-active:\s*#ffffff;/);
    assert.match(css, /\.sidebar-resizer::after\s*\{[^}]*background-color:\s*var\(--resizer-handle-color\);/);
    assert.match(css, /\.sidebar-resizer:hover::after[^}]*background-color:\s*var\(--resizer-handle-active\);/);
    assert.match(css, /\.inspector-resizer::after\s*\{[^}]*background-color:\s*var\(--resizer-handle-color\);/);
    assert.match(css, /\.inspector-resizer:hover::after[^}]*background-color:\s*var\(--resizer-handle-active\);/);

    // Ensure --text-bright is strictly used for text color across the entire stylesheet
    const backgroundWithTextBright = css.match(/background(?:-color)?:\s*var\(--text-bright\)/);
    assert.equal(backgroundWithTextBright, null, '--text-bright must not be used as a background color');
});

test('app entrypoint forwards ?debug query to service-worker registration in debug mode', () => {
    const appJs = readFileSync(path.join(workspaceRoot, 'js', 'app.js'), 'utf8');
    const swJs = readFileSync(path.join(workspaceRoot, 'service-worker.js'), 'utf8');

    assert.match(appJs, /service-worker\.js\?debug=1/);
    assert.match(swJs, /new URL\(self\.location\.href\)\.searchParams\.has\('debug'\)/);
});
