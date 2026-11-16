import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Architectural guards on the js/ module graph. Static and dynamic imports are
// both counted: a dynamic `import()` used only to dodge a cycle is still a cycle.

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsRoot = path.join(workspaceRoot, 'js');

function listModules(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'vendor' ? [] : listModules(fullPath);
        return entry.name.endsWith('.js') ? [fullPath] : [];
    });
}

function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

function relativeImports(file) {
    const source = stripComments(readFileSync(file, 'utf8'));
    const specifiers = [
        ...source.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g),
        ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)
    ].map(match => match[1]);
    return specifiers
        .filter(specifier => specifier.startsWith('.'))
        .map(specifier => path.resolve(path.dirname(file), specifier))
        .filter(target => !target.includes(`${path.sep}vendor${path.sep}`));
}

const modules = listModules(jsRoot);
const graph = new Map(modules.map(file => [file, relativeImports(file)]));
const rel = file => path.relative(jsRoot, file).split(path.sep).join('/');

function findCycles() {
    const cycles = [];
    const state = new Map(); // undefined = unvisited, 1 = on stack, 2 = done
    const stack = [];

    const visit = (node) => {
        state.set(node, 1);
        stack.push(node);
        for (const next of graph.get(node) || []) {
            if (state.get(next) === 1) {
                cycles.push([...stack.slice(stack.indexOf(next)), next].map(rel).join(' > '));
            } else if (!state.has(next)) {
                visit(next);
            }
        }
        stack.pop();
        state.set(node, 2);
    };

    for (const node of graph.keys()) {
        if (!state.has(node)) visit(node);
    }
    return cycles;
}

test('js/ module graph has no circular imports (static or dynamic)', () => {
    assert.deepEqual(findCycles(), []);
});

test('no module imports the application entry point', () => {
    const appJs = path.join(jsRoot, 'app.js');
    const importers = [...graph].filter(([, targets]) => targets.includes(appJs)).map(([file]) => rel(file));
    assert.deepEqual(importers, []);
});

test('every js module is listed in the service worker app shell', () => {
    const swJs = readFileSync(path.join(workspaceRoot, 'service-worker.js'), 'utf8');
    const missing = modules.map(rel).filter(name => !swJs.includes(`js/${name}\``));
    assert.deepEqual(missing, []);
});
