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

    const project2 = createValidProject();
    project2.backgroundImage = 'backgrounds/wallpaper.jpg';
    project2.backgroundMedia = 'backgrounds/ambient.png';
    assert.equal(validateProject(project2).isValid, true);

    project2.backgroundMedia = 123;
    assert.match(validateProject(project2).errors.join('\n'), /"backgroundMedia" must be a string or null/);
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

test('validates optional LED animation data', () => {
    const project = createValidProject();
    project.pages[0].lights = Array(64).fill('fade_red');
    project.pages[0].lightSyncToSound = Array(64).fill(true);
    project.pages[0].lightDurations = Array(64).fill(2.5);
    assert.equal(validateProject(project).isValid, true);

    project.pages[0].lights[4] = 42;
    project.pages[0].lightSyncToSound[2] = 'yes';
    project.pages[0].lightDurations[3] = 120;
    const errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Light 4: must be a string or empty/);
    assert.match(errors, /Light sync 2: must be a boolean/);
    assert.match(errors, /Light duration 3: must be between 0.1 and 60 seconds/);
});

test('validates visualizer configuration options', () => {
    const project = createValidProject();
    project.visualizerColor1 = '#ff0055';
    project.visualizerColor2 = '#00ffff';
    project.visualizerGradient = true;
    project.visualizerGradientDirection = 'vertical';
    assert.equal(validateProject(project).isValid, true);

    project.visualizer = {
        mode: 'both',
        color1: '#ff0000',
        color2: '#00ff00',
        gradient: false,
        gradientDirection: 'horizontal'
    };
    assert.equal(validateProject(project).isValid, true);

    // Invalid enum values and colors must be rejected
    project.visualizer = { mode: 'radial' };
    let errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Visualizer field "mode" must be one of/);

    project.visualizer = { color1: 'blue' };
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Visualizer field "color1" must be a hex color/);

    project.visualizer = { gradientDirection: 'to right' };
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Visualizer field "gradientDirection" must be one of/);

    project.visualizer = null;

    // Invalid types
    project.visualizerColor1 = 123;
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"visualizerColor1" must be a string or null/);

    project.visualizerColor1 = null;
    project.visualizerGradient = 'true';
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"visualizerGradient" must be a boolean or null/);

    project.visualizerGradient = null;
    project.visualizer = 'invalid';
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /must be an object if provided/);

    project.visualizer = { mode: 123 };
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Visualizer field "mode" must be a string/);
});

test('validates launchpad layout configuration options (rotation and size)', () => {
    const project = createValidProject();
    project.launchpadRotation = 90;
    project.launchpadSize = 120;
    assert.equal(validateProject(project).isValid, true);

    project.launchpadRotation = 0;
    project.launchpadSize = 50;
    assert.equal(validateProject(project).isValid, true);

    project.launchpadRotation = 360;
    project.launchpadSize = 140;
    assert.equal(validateProject(project).isValid, true);

    // Invalid rotation
    project.launchpadRotation = -5;
    let errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"launchpadRotation" must be a number between 0 and 360/);

    project.launchpadRotation = 361;
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"launchpadRotation" must be a number between 0 and 360/);

    project.launchpadRotation = '90';
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"launchpadRotation" must be a number between 0 and 360/);

    // Invalid size
    project.launchpadRotation = null;
    project.launchpadSize = 40;
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"launchpadSize" must be a number between 50 and 140/);

    project.launchpadSize = 150;
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"launchpadSize" must be a number between 50 and 140/);

    project.launchpadSize = '100';
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"launchpadSize" must be a number between 50 and 140/);
});