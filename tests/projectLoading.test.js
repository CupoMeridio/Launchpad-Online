import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPathResolver, normalizeProjectData } from '../js/projectModel.js';
import { LAUNCHPAD_PADS, DEFAULT_LIGHT_DURATION_SEC } from '../js/constants.js';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsRoot = path.join(workspaceRoot, 'projects');

test('createPathResolver correctly resolves relative paths and preserves absolute/special URLs', () => {
    const resolve = createPathResolver('projects/Virtual Riot - Idols/project.json');

    // Relative project paths should get prefixed with the directory
    assert.equal(resolve('samples/drop1.wav'), 'projects/Virtual Riot - Idols/samples/drop1.wav');
    assert.equal(resolve('icon.png'), 'projects/Virtual Riot - Idols/icon.png');

    // Root paths should remain unchanged
    assert.equal(resolve('/assets/icons/Logo.png'), '/assets/icons/Logo.png');

    // assets/ paths should remain unchanged
    assert.equal(resolve('assets/videos/Neon Tunnel.webm'), 'assets/videos/Neon Tunnel.webm');

    // External http/https URLs should remain unchanged
    assert.equal(resolve('https://example.com/sound.wav'), 'https://example.com/sound.wav');
    assert.equal(resolve('http://example.com/sound.wav'), 'http://example.com/sound.wav');

    // Falsy values
    assert.equal(resolve(''), '');
    assert.equal(resolve(null), null);
});

test('normalizeProjectData produces canonical 64-pad arrays with timing and appearance', () => {
    const rawProject = {
        id: 'test-project',
        name: 'Test Project',
        coverImage: 'cover.jpg',
        iconImage: 'icon.png',
        backgroundMedia: 'assets/videos/bg.webm',
        visualizer: {
            mode: 'bars',
            color1: '#00ffcc',
            color2: '#ff00aa',
            gradient: true,
            gradientDirection: 'horizontal'
        },
        pages: [
            {
                name: 'Page 1',
                sounds: [
                    ['sample1.wav', 'sample1_alt.wav'],
                    ['sample2.wav']
                ],
                lights: [
                    ['fade_blue'],
                    ['strobe_green']
                ],
                lightSyncToSound: [
                    [false]
                ],
                lightDurations: [
                    [1.2]
                ]
            }
        ]
    };

    const normalized = normalizeProjectData(rawProject, 'projects/test/project.json');

    // Exactly 64 pad entries for 1 page
    assert.equal(normalized.sounds.length, LAUNCHPAD_PADS);
    assert.equal(normalized.lights.length, LAUNCHPAD_PADS);
    assert.equal(normalized.lightSyncToSound.length, LAUNCHPAD_PADS);
    assert.equal(normalized.lightDurations.length, LAUNCHPAD_PADS);

    // Resolved sound paths
    assert.deepEqual(normalized.sounds[0], ['projects/test/sample1.wav', 'projects/test/sample1_alt.wav']);
    assert.deepEqual(normalized.sounds[1], ['projects/test/sample2.wav']);
    assert.deepEqual(normalized.sounds[2], []);

    // Lights
    assert.deepEqual(normalized.lights[0], ['fade_blue']);
    assert.deepEqual(normalized.lights[1], ['strobe_green']);
    assert.deepEqual(normalized.lights[2], []);

    // Light sync defaults
    assert.deepEqual(normalized.lightSyncToSound[0], [false]);
    assert.deepEqual(normalized.lightSyncToSound[1], [true]); // defaulted

    // Light durations defaults
    assert.deepEqual(normalized.lightDurations[0], [1.2]);
    assert.deepEqual(normalized.lightDurations[1], [DEFAULT_LIGHT_DURATION_SEC]); // defaulted

    // Appearance normalized
    assert.equal(normalized.appearance.skin, 'projects/test/cover.jpg');
    assert.equal(normalized.appearance.icon, 'projects/test/icon.png');
    assert.equal(normalized.appearance.background, 'assets/videos/bg.webm');
    assert.equal(normalized.appearance.visualizer.mode, 'bars');
    assert.equal(normalized.appearance.visualizer.gradient, true);
});

test('normalizeProjectData handles multi-page projects and empty steps gracefully', () => {
    const rawProject = {
        id: 'multi-page',
        name: 'Multi Page',
        pages: [
            { name: 'P1', sounds: [], lights: [] },
            { name: 'P2', sounds: [], lights: [] }
        ]
    };

    const normalized = normalizeProjectData(rawProject, '');
    assert.equal(normalized.sounds.length, LAUNCHPAD_PADS * 2);
    assert.equal(normalized.lights.length, LAUNCHPAD_PADS * 2);
    assert.equal(normalized.lightSyncToSound.length, LAUNCHPAD_PADS * 2);
    assert.equal(normalized.lightDurations.length, LAUNCHPAD_PADS * 2);
});

test('smoke test: built-in projects normalize cleanly when present on disk', (t) => {
    if (!existsSync(projectsRoot)) {
        t.skip('projects directory is not present');
        return;
    }

    const testProjects = [
        {
            name: 'Virtual Riot - Idols',
            config: path.join(projectsRoot, 'Virtual Riot - Idols', 'Virtual Riot - Idols.json')
        },
        {
            name: 'Krewella - Alive',
            config: path.join(projectsRoot, 'Krewella - Alive (Cash Cash x Kalkutta Remix)', 'Krewella - Alive (Cash Cash x Kalkutta Remix).json')
        }
    ];

    for (const item of testProjects) {
        if (!existsSync(item.config)) continue;

        const raw = JSON.parse(readFileSync(item.config, 'utf8'));
        const configPath = path.relative(workspaceRoot, item.config).replace(/\\/g, '/');
        const normalized = normalizeProjectData(raw, configPath);

        assert.ok(normalized.project, `${item.name}: project must be defined`);
        assert.equal(normalized.sounds.length, raw.pages.length * LAUNCHPAD_PADS);
        assert.equal(normalized.lights.length, raw.pages.length * LAUNCHPAD_PADS);
        assert.equal(normalized.lightSyncToSound.length, raw.pages.length * LAUNCHPAD_PADS);
        assert.equal(normalized.lightDurations.length, raw.pages.length * LAUNCHPAD_PADS);
    }
});
