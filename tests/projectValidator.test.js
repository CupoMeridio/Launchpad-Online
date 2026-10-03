import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateProject } from '../js/projectValidator.js';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.join(workspaceRoot, 'projects');

function createValidProject() {
    return {
        id: 'test-project',
        name: 'Test Project',
        pages: [{
            name: 'Page 1',
            sounds: Array(64).fill(''),
            lights: Array(64).fill('')
        }]
    };
}

function findProjectConfigs(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return findProjectConfigs(entryPath);
        return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
    });
}

function resolveProjectAsset(assetPath, projectDirectory) {
    if (!assetPath || assetPath.startsWith('http')) return null;
    if (assetPath.startsWith('/')) {
        return path.join(workspaceRoot, assetPath.replace(/^\/+/, ''));
    }
    if (assetPath.startsWith('assets/')) {
        return path.join(workspaceRoot, assetPath);
    }
    return path.resolve(projectDirectory, assetPath);
}

test('accepts a project with the required schema', () => {
    assert.deepEqual(validateProject(createValidProject()), { isValid: true, errors: [] });
});

test('rejects missing project fields and invalid page counts', () => {
    const missingId = createValidProject();
    delete missingId.id;
    assert.match(validateProject(missingId).errors.join('\n'), /valid "id" field/);

    const tooManyPages = createValidProject();
    tooManyPages.pages = Array.from({ length: 9 }, (_, index) => ({
        name: `Page ${index + 1}`,
        sounds: Array(64).fill('')
    }));
    assert.match(validateProject(tooManyPages).errors.join('\n'), /maximum is 8/);
});

test('rejects pages with malformed sound and light data', () => {
    const invalidSounds = createValidProject();
    invalidSounds.pages[0].sounds.pop();
    assert.match(validateProject(invalidSounds).errors.join('\n'), /sounds array must have exactly 64 elements/);

    const invalidSoundEntry = createValidProject();
    invalidSoundEntry.pages[0].sounds[0] = 42;
    assert.match(validateProject(invalidSoundEntry).errors.join('\n'), /Sound 0: must be a string or empty/);

    const invalidLightEntry = createValidProject();
    invalidLightEntry.pages[0].lights[0] = 42;
    assert.match(validateProject(invalidLightEntry).errors.join('\n'), /Light 0: must be a string or empty/);
});

test('rejects optional metadata with an invalid type', () => {
    const project = createValidProject();
    project.coverImage = 42;
    assert.match(validateProject(project).errors.join('\n'), /"coverImage" must be a string or null/);
});

test('built-in projects pass validation and reference existing assets', () => {
    const configFiles = findProjectConfigs(projectsRoot);
    assert.ok(configFiles.length > 0, 'No project configuration JSON files were found');

    for (const configFile of configFiles) {
        const project = JSON.parse(readFileSync(configFile, 'utf8'));
        const result = validateProject(project);
        assert.equal(result.isValid, true, `${path.relative(workspaceRoot, configFile)}: ${result.errors.join('; ')}`);

        const assets = [
            ...project.pages.flatMap(page => page.sounds),
            project.coverImage,
            project.iconImage,
            project.backgroundVideo
        ];

        for (const asset of assets) {
            const assetFile = resolveProjectAsset(asset, path.dirname(configFile));
            if (!assetFile) continue;
            assert.ok(
                existsSync(assetFile),
                `${path.relative(workspaceRoot, configFile)} references missing asset "${asset}"`
            );
        }
    }
});