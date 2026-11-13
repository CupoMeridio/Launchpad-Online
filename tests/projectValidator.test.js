import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateProject, checkProjectDeviceConsistency } from '../js/projectValidator.js';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.join(workspaceRoot, 'projects');

function createValidProject() {
    return {
        id: 'test-project',
        name: 'Test Project',
        pages: [{
            name: 'Page 1',
            sounds: Array(64).fill(null).map(() => []),
            lights: Array(64).fill(null).map(() => [])
        }]
    };
}

function findProjectConfigs(directory) {
    if (!existsSync(directory)) return [];
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
        sounds: Array(64).fill(null).map(() => [])
    }));
    assert.match(validateProject(tooManyPages).errors.join('\n'), /maximum is 8/);
});

test('rejects pages with malformed sound and light data', () => {
    const invalidSounds = createValidProject();
    invalidSounds.pages[0].sounds.pop();
    assert.match(validateProject(invalidSounds).errors.join('\n'), /sounds array must have exactly 64 elements/);

    const invalidSoundEntry = createValidProject();
    invalidSoundEntry.pages[0].sounds[0] = 42;
    assert.match(validateProject(invalidSoundEntry).errors.join('\n'), /Sound 0: must be an array of steps/);

    const invalidSoundStep = createValidProject();
    invalidSoundStep.pages[0].sounds[0] = [42];
    assert.match(validateProject(invalidSoundStep).errors.join('\n'), /Sound 0, Step 0: must be a string or empty/);

    const invalidLightEntry = createValidProject();
    invalidLightEntry.pages[0].lights[0] = 42;
    assert.match(validateProject(invalidLightEntry).errors.join('\n'), /Light 0: must be an array of steps/);

    const invalidLightStep = createValidProject();
    invalidLightStep.pages[0].lights[0] = [42];
    assert.match(validateProject(invalidLightStep).errors.join('\n'), /Light 0, Step 0: must be a string or empty/);

    const tooManySteps = createValidProject();
    tooManySteps.pages[0].sounds[0] = Array(17).fill('sample.wav');
    assert.match(validateProject(tooManySteps).errors.join('\n'), /step count exceeds maximum of 16/);
});

test('rejects optional metadata with an invalid type', () => {
    const project = createValidProject();
    project.coverImage = 42;
    assert.match(validateProject(project).errors.join('\n'), /"coverImage" must be a string or null/);

    const project2 = createValidProject();
    project2.backgroundMedia = 'backgrounds/ambient.png';
    assert.equal(validateProject(project2).isValid, true);

    project2.backgroundMedia = 123;
    assert.match(validateProject(project2).errors.join('\n'), /"backgroundMedia" must be a string or null/);
});

test('built-in projects pass validation and reference existing assets', (t) => {
    const configFiles = findProjectConfigs(projectsRoot);
    if (configFiles.length === 0) {
        t.skip('No project configuration files found in projects/ (minimal distribution)');
        return;
    }

    for (const configFile of configFiles) {
        const project = JSON.parse(readFileSync(configFile, 'utf8'));
        const result = validateProject(project);
        assert.equal(result.isValid, true, `${path.relative(workspaceRoot, configFile)}: ${result.errors.join('; ')}`);

        const assets = [
            ...project.pages.flatMap(page => page.sounds.flat()),
            project.coverImage,
            project.iconImage,
            project.backgroundMedia
        ];

        for (const asset of assets) {
            const assetFile = resolveProjectAsset(asset, path.dirname(configFile));
            if (!assetFile) continue;
            // Only enforce asset presence if its parent directory exists, so test environments
            // without optional large videos or stripped audio still pass without crashing.
            if (existsSync(path.dirname(assetFile))) {
                assert.ok(
                    existsSync(assetFile),
                    `${path.relative(workspaceRoot, configFile)} references missing asset "${asset}"`
                );
            }
        }
    }
});

test('validates optional LED animation data', () => {
    const project = createValidProject();
    project.pages[0].lights = Array(64).fill(null).map(() => ['fade_red']);
    project.pages[0].lightSyncToSound = Array(64).fill(null).map(() => [true]);
    project.pages[0].lightDurations = Array(64).fill(null).map(() => [2.5]);
    assert.equal(validateProject(project).isValid, true);

    project.pages[0].lights[4] = [42];
    project.pages[0].lightSyncToSound[2] = ['yes'];
    project.pages[0].lightDurations[3] = [120];
    const errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Light 4, Step 0: must be a string or empty/);
    assert.match(errors, /Light sync 2, Step 0: must be a boolean/);
    assert.match(errors, /Light duration 3, Step 0: must be between 0.1 and 60 seconds/);
});

test('validates visualizer configuration options', () => {
    const project = createValidProject();
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

    // Invalid types
    project.visualizer = { color1: 123 };
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Visualizer field "color1" must be a string or null/);

    project.visualizer = { gradient: 'true' };
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Visualizer field "gradient" must be a boolean or null/);

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
test('validates optional targetDevice configuration option', () => {
    const project = createValidProject();
    assert.equal(validateProject(project).isValid, true);

    project.targetDevice = 'universal';
    assert.equal(validateProject(project).isValid, true);

    project.targetDevice = 'legacy';
    assert.equal(validateProject(project).isValid, true);

    project.targetDevice = 'rgb';
    assert.equal(validateProject(project).isValid, true);

    project.targetDevice = 'invalid-device';
    let errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"targetDevice" must be one of: universal, legacy, rgb/);

    project.targetDevice = 123;
    errors = validateProject(project).errors.join('\n');
    assert.match(errors, /"targetDevice" must be one of: universal, legacy, rgb/);
});

test('checkProjectDeviceConsistency counts RGB animations on legacy projects', () => {
    const project = createValidProject();
    project.targetDevice = 'universal';
    project.pages[0].lights[0] = ['fade_blue'];
    assert.deepEqual(checkProjectDeviceConsistency(project), { rgbLightCount: 0 });

    project.targetDevice = 'legacy';
    assert.deepEqual(checkProjectDeviceConsistency(project), { rgbLightCount: 1 });

    project.pages[0].lights[0] = ['fade_red'];
    assert.deepEqual(checkProjectDeviceConsistency(project), { rgbLightCount: 0 });
});

function withCustomAnimation(animation = {}) {
    const project = createValidProject();
    project.animations = [{
        id: 'intro',
        name: 'Intro',
        playback: 'once',
        frames: [{ duration: 100, pads: { '0,0': { color: 'red', level: 'full' } } }],
        ...animation
    }];
    project.pages[0].lights[5] = ['custom:intro'];
    return project;
}

test('custom animations: a well-formed list and its references are valid', () => {
    const result = validateProject(withCustomAnimation());
    assert.deepEqual(result.errors, []);
});

test('custom animations: malformed fields are reported precisely', () => {
    const errors = validateProject(withCustomAnimation({
        id: 'Bad Id!',
        playback: 'forever',
        frames: [
            { duration: 5, pads: { '9,9': { color: 'red' }, '1,1': { color: 'nope' }, '2,2': { color: 'red', level: 'dim' } } },
            { duration: 100, pads: [] }
        ]
    })).errors.join('\n');
    assert.match(errors, /Animation 1: "id" must use lowercase letters/);
    assert.match(errors, /Animation 1: "playback" must be one of: once, hold/);
    assert.match(errors, /Animation 1, Frame 1: duration must be between 10 and 10000 ms/);
    assert.match(errors, /Frame 1, pad "9,9": is not a pad of the 8x8 grid/);
    assert.match(errors, /Frame 1, pad "1,1": has an unknown color "nope"/);
    assert.match(errors, /Frame 1, pad "2,2": level must be one of: full, medium, low/);
    assert.match(errors, /Animation 1, Frame 2: "pads" must be an object/);

    const empty = withCustomAnimation({ frames: [] });
    assert.match(validateProject(empty).errors.join('\n'), /must have between 1 and 256 frames/);

    const notArray = createValidProject();
    notArray.animations = {};
    assert.match(validateProject(notArray).errors.join('\n'), /"animations" must be an array if provided/);
});

test('custom animations: duplicate ids and dangling references are errors', () => {
    const project = withCustomAnimation();
    project.animations.push({ ...project.animations[0] });
    project.pages[0].lights[6] = ['custom:missing'];
    const errors = validateProject(project).errors.join('\n');
    assert.match(errors, /Animation 2: duplicate id "intro"/);
    assert.match(errors, /Page 1, Light 6, Step 0: custom animation "missing" is not defined/);
});

test('custom animations with RGB-only colours count for legacy targets', () => {
    const project = withCustomAnimation({ frames: [{ duration: 100, pads: { '0,0': { color: 'blue', level: 'full' } } }] });
    project.targetDevice = 'legacy';
    assert.deepEqual(checkProjectDeviceConsistency(project), { rgbLightCount: 1 });
    project.targetDevice = 'rgb';
    assert.deepEqual(checkProjectDeviceConsistency(project), { rgbLightCount: 0 });
});
