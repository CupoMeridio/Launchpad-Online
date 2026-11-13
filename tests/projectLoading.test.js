import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPathResolver, normalizeProjectData, collectSoundUrls, assignStepBuffers } from '../js/projectModel.js';
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

test('normalizeProjectData produces 64 pads of PadSteps per page with timing and appearance', () => {
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

    // Exactly 64 pads for 1 page
    assert.equal(normalized.pages.length, 1);
    assert.equal(normalized.pages[0].length, LAUNCHPAD_PADS);

    // Pad 0: two steps (longest of sounds/lights); per-step fields line up,
    // missing values take their defaults.
    assert.deepEqual(normalized.pages[0][0], [
        { soundUrl: 'projects/test/sample1.wav', buffer: null, light: 'fade_blue', syncToSound: false, duration: 1.2 },
        { soundUrl: 'projects/test/sample1_alt.wav', buffer: null, light: null, syncToSound: true, duration: DEFAULT_LIGHT_DURATION_SEC }
    ]);

    // Pad 1: defaults for sync and duration
    assert.deepEqual(normalized.pages[0][1], [
        { soundUrl: 'projects/test/sample2.wav', buffer: null, light: 'strobe_green', syncToSound: true, duration: DEFAULT_LIGHT_DURATION_SEC }
    ]);

    // Unassigned pad: no steps
    assert.deepEqual(normalized.pages[0][2], []);

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
    assert.equal(normalized.pages.length, 2);
    normalized.pages.forEach(page => {
        assert.equal(page.length, LAUNCHPAD_PADS);
        assert.ok(page.every(steps => steps.length === 0));
    });
});

test('collectSoundUrls deduplicates shared samples and assignStepBuffers attaches them to every step', () => {
    const normalized = normalizeProjectData({
        id: 'shared',
        name: 'Shared',
        pages: [
            { name: 'P1', sounds: [['kick.wav', 'snare.wav'], ['kick.wav']] },
            { name: 'P2', sounds: [['snare.wav', 'missing.wav']] }
        ]
    }, 'projects/x/x.json');

    assert.deepEqual(collectSoundUrls(normalized).sort(), [
        'projects/x/kick.wav', 'projects/x/missing.wav', 'projects/x/snare.wav'
    ]);

    const kick = { name: 'kick' };
    const snare = { name: 'snare' };
    assignStepBuffers(normalized, new Map([
        ['projects/x/kick.wav', kick],
        ['projects/x/snare.wav', snare]
    ]));

    assert.equal(normalized.pages[0][0][0].buffer, kick);
    assert.equal(normalized.pages[0][0][1].buffer, snare);
    assert.equal(normalized.pages[0][1][0].buffer, kick, 'shared sample reuses the same decoded buffer');
    assert.equal(normalized.pages[1][0][0].buffer, snare);
    assert.equal(normalized.pages[1][0][1].buffer, null, 'failed samples leave the step silent');
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
        assert.equal(normalized.pages.length, raw.pages.length);
        normalized.pages.forEach(page => assert.equal(page.length, LAUNCHPAD_PADS));
        assert.ok(collectSoundUrls(normalized).length > 0, `${item.name}: must reference samples`);
    }
});
