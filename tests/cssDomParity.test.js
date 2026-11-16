import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as csstree from 'css-tree';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function getJsFiles(dir) {
    const files = [];
    for (const f of readdirSync(dir)) {
        const full = path.join(dir, f);
        if (statSync(full).isDirectory()) {
            if (f !== 'node_modules' && f !== '.git' && f !== 'vendor') {
                files.push(...getJsFiles(full));
            }
        } else if (f.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

test('all CSS stylesheets parse cleanly with css-tree with zero syntax or bracket errors', () => {
    const cssFiles = ['style.css', 'sidebar.css', 'creator.css', 'launchpad.css'];
    const parseErrors = [];

    for (const file of cssFiles) {
        const cssPath = path.join(workspaceRoot, 'css', file);
        const cssContent = readFileSync(cssPath, 'utf8');

        csstree.parse(cssContent, {
            filename: file,
            positions: true,
            onParseError(err) {
                parseErrors.push(`${file}:${err.line}:${err.column} ${err.message}`);
            }
        });
    }

    assert.deepEqual(parseErrors, [], `Found CSS syntax/parse errors:\n${parseErrors.join('\n')}`);
});

test('CSS selectors dynamically match DOM and JS identifiers bidirectionally', () => {
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
    const jsFiles = getJsFiles(path.join(workspaceRoot, 'js'));
    const combinedJs = jsFiles.map(f => readFileSync(f, 'utf8')).join('\n');
    const knownDomText = html + '\n' + combinedJs;

    // Dynamically extract classes from HTML
    const domClasses = new Set();
    for (const m of html.matchAll(/class="([^"]+)"/g)) {
        m[1].split(/\s+/).filter(Boolean).forEach(c => domClasses.add(c));
    }
    // Dynamically extract classes from JS
    for (const m of combinedJs.matchAll(/classList\.(?:add|remove|toggle|contains)\(([^)]+)\)/g)) {
        const arg = m[1].split(',')[0].trim().replace(/^['"`](.*)['"`]$/, '$1');
        if (arg && !arg.includes(' ') && !arg.includes('+') && !arg.includes('$')) {
            domClasses.add(arg);
        }
    }
    for (const m of combinedJs.matchAll(/className\s*=\s*['"`]([^`"'\s]+)['"`]/g)) {
        domClasses.add(m[1]);
    }
    for (const m of combinedJs.matchAll(/querySelector(?:All)?\(['"`]([^'"`]+)['"`]\)/g)) {
        for (const cm of m[1].matchAll(/\.([a-zA-Z0-9\-_]+)/g)) {
            domClasses.add(cm[1]);
        }
    }

    // Extract classes and IDs from CSS AST across all stylesheets
    const cssClasses = new Set();
    const cssIds = new Set();
    const cssFiles = ['style.css', 'sidebar.css', 'creator.css', 'launchpad.css'];

    for (const file of cssFiles) {
        const css = readFileSync(path.join(workspaceRoot, 'css', file), 'utf8');
        const ast = csstree.parse(css);
        csstree.walk(ast, {
            enter(node) {
                if (node.type === 'ClassSelector') {
                    cssClasses.add(node.name);
                } else if (node.type === 'IdSelector') {
                    cssIds.add(node.name);
                }
            }
        });
    }

    // 1. Every class in HTML/JS must have a rule in CSS
    const missingInCss = [];
    for (const c of domClasses) {
        if (!cssClasses.has(c)) {
            missingInCss.push(c);
        }
    }
    assert.deepEqual(missingInCss, [], `Classes used in DOM/JS missing from CSS:\n${missingInCss.join(', ')}`);

    // 2. Every class declared in CSS AST must correspond to real HTML or JS usage
    const unusedInDom = [];
    for (const c of cssClasses) {
        if (!knownDomText.includes(c)) {
            unusedInDom.push(c);
        }
    }
    assert.deepEqual(unusedInDom, [], `Classes declared in CSS but unused in DOM/JS:\n${unusedInDom.join(', ')}`);

    // 3. Verify main element is styled directly
    const styleCss = readFileSync(path.join(workspaceRoot, 'css', 'style.css'), 'utf8');
    assert.match(styleCss, /main\s*\{[^}]*justify-content:\s*center;[^}]*\}/, 'main element must be styled directly');

    // 4. Verify critical IDs are styled
    const criticalIds = ['visualizer-canvas-top', 'visualizer-canvas-bottom', 'customization-menu', 'openSidebar'];
    for (const id of criticalIds) {
        assert.ok(cssIds.has(id), `CSS must define an ID rule for #${id}`);
    }

    // 5. Verify zero phantom classes exist in AST
    const forbiddenPhantomClasses = [
        'main-content', 'media-background', 'video-controls', 'slider-group',
        'input-container', 'slider-input', 'input-unit', 'color-picker',
        'settings-select', 'top-right-icon-container', 'top-right-icon',
        'launchpad-stickers-container', 'menu-option-text', 'personalize-menu-options',
        'spacer'
    ];
    for (const phantom of forbiddenPhantomClasses) {
        assert.equal(cssClasses.has(phantom), false, `CSS must NOT declare phantom class .${phantom}`);
    }
});

test('every notification type has its own style rule', async () => {
    // Types are applied through a template literal (`notification ${type}`), which
    // the static class scan above cannot see: check them from their declaration.
    const { NOTIFICATION_TYPES } = await import('../js/notifications.js');
    const ast = csstree.parse(readFileSync(path.join(workspaceRoot, 'css', 'style.css'), 'utf8'));
    const selectors = new Set();
    csstree.walk(ast, {
        visit: 'Selector',
        enter(node) {
            selectors.add(csstree.generate(node));
        }
    });

    const unstyled = NOTIFICATION_TYPES.filter(type => !selectors.has(`.notification.${type}`));
    assert.deepEqual(unstyled, [], `Notification types without a .notification.<type> rule: ${unstyled.join(', ')}`);
});
