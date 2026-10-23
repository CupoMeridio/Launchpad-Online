import assert from 'node:assert/strict';
import test from 'node:test';

// Setup minimal mocks for Node.js test environment
globalThis.window = {
    addEventListener() {},
    dispatchEvent() {}
};
globalThis.document = {
    getElementById(id) {
        return null;
    },
    querySelectorAll() {
        return [];
    }
};
globalThis.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = String(v); }
};

const { 
    buildClassicHtml, 
    buildMk3Html, 
    buildProHtml, 
    buildProMk3Html,
    getEffectiveModel, 
    setModelPreference, 
    setDetectedHardwareModel,
    LAUNCHPAD_MODELS 
} = await import('../js/launchpadView.js');

test('buildClassicHtml generates exactly 64 playable pads and 8 page buttons', () => {
    const html = buildClassicHtml();

    // Check 64 pads with data-index
    const padMatches = [...html.matchAll(/class="grid-item" data-index="(\d+)"/g)];
    assert.equal(padMatches.length, 64, 'Classic model must generate 64 playable pads');
    for (let i = 0; i < 64; i++) {
        assert.ok(html.includes(`data-index="${i}"`), `Missing pad index ${i}`);
    }

    // Check 8 scene/page buttons with data-page 0..7
    const pageMatches = [...html.matchAll(/class="grid-item-menu" data-page="(\d+)"/g)];
    assert.equal(pageMatches.length, 8, 'Classic model must generate 8 page buttons');
    for (let p = 0; p < 8; p++) {
        assert.ok(html.includes(`data-page="${p}"`), `Missing page index ${p}`);
    }

    // Check top buttons a1..a8
    for (let a = 1; a <= 8; a++) {
        assert.ok(html.includes(`id="a${a}"`), `Missing top button a${a}`);
    }

    // Check classic silkscreens
    assert.ok(html.includes('Session'));
    assert.ok(html.includes('Volume'));
    assert.ok(html.includes('assets/icons/triangle.png'));
    assert.ok(html.includes('id="image-container"'), 'Classic model must include #image-container');
});

test('buildMk3Html generates 64 pads, 8 scene buttons and modern MK3 icons', () => {
    const html = buildMk3Html();

    // Check 64 pads
    const padMatches = [...html.matchAll(/class="grid-item" data-index="(\d+)"/g)];
    assert.equal(padMatches.length, 64, 'MK3 model must generate 64 playable pads');

    // Check 8 scene buttons
    const pageMatches = [...html.matchAll(/data-page="(\d+)"/g)];
    assert.equal(pageMatches.length, 8, 'MK3 model must generate 8 scene buttons');

    // Check top buttons a1..a8 with modern labels
    assert.ok(html.includes('id="a1"'));
    assert.ok(html.includes('id="a8"'));
    assert.ok(html.includes('Session'));
    assert.ok(html.includes('Drums'));
    assert.ok(html.includes('Keys'));
    assert.ok(html.includes('User'));

    // Check corner logo badge
    assert.ok(html.includes('mk3-logo-img'));
    assert.ok(html.includes('id="image-container"'), 'MK3 model must include #image-container');
});

test('buildProHtml generates 64 central pads and all 32 perimeter buttons with round or squircle shapes', () => {
    // Pro 2015 (round buttons)
    const proClassicHtml = buildProHtml({ isMk3: false });
    assert.ok(proClassicHtml.includes('pro-round-btn'), 'Pro 2015 must use round button class');
    assert.ok(!proClassicHtml.includes('pro-squircle-btn'));
    assert.ok(proClassicHtml.includes('Delete'), 'Pro 2015 layout includes Delete');

    // Pro MK3 (squircle buttons, Shift & Setup in corners, dual split bottom row)
    const proMk3Html = buildProHtml({ isMk3: true });
    assert.ok(proMk3Html.includes('pro-squircle-btn'), 'Pro MK3 must use squircle button class');
    assert.ok(!proMk3Html.includes('pro-round-btn'));
    assert.ok(proMk3Html.includes('Clear'), 'Pro MK3 layout includes Clear');
    assert.ok(proMk3Html.includes('Setup'), 'Pro MK3 includes Setup button in bottom-left corner');
    assert.ok(proMk3Html.includes('pro-split-column'), 'Pro MK3 includes split bottom columns');
    assert.ok(proMk3Html.includes('pro-split-top'), 'Pro MK3 includes upper slim track select buttons');
    assert.ok(proMk3Html.includes('pro-split-bottom'), 'Pro MK3 includes lower function buttons');
    assert.ok(proMk3Html.includes('Capture MIDI'), 'Pro MK3 includes Capture MIDI subtext');

    // Also verify buildProMk3Html directly produces identical output
    assert.equal(buildProMk3Html(), proMk3Html);

    // Common Pro properties
    for (const html of [proClassicHtml, proMk3Html]) {
        // Check 64 central pads
        const padMatches = [...html.matchAll(/class="grid-item" data-index="(\d+)"/g)];
        assert.equal(padMatches.length, 64, 'Pro model must generate 64 playable pads');

        // Check 8 scene buttons on right
        const pageMatches = [...html.matchAll(/data-page="(\d+)"/g)];
        assert.equal(pageMatches.length, 8, 'Pro model must generate 8 scene buttons');

        // Check 8 top buttons (a1..a8)
        for (let a = 1; a <= 8; a++) {
            assert.ok(html.includes(`id="a${a}"`), `Missing top button a${a}`);
        }
        assert.ok(html.includes('Shift'));
        assert.ok(html.includes('Undo'));

        // Check 8 left auxiliary buttons
        const leftMatches = [...html.matchAll(/grid-item-pro-left/g)];
        assert.equal(leftMatches.length, 8, 'Pro model must have 8 left buttons');

        // Check 8 bottom auxiliary buttons
        const bottomMatches = [...html.matchAll(/grid-item-pro-bottom/g)];
        assert.equal(bottomMatches.length, 8, 'Pro model must have 8 bottom buttons');
        assert.ok(html.includes('Record Arm'));
        assert.ok(html.includes('Stop Clip'));

        // Auxiliary buttons must NOT carry data-index or data-page to avoid sound/page conflicts
        const auxMatches = [...html.matchAll(/grid-item-pro-aux[^>]*>/g)];
        for (const [tag] of auxMatches) {
            assert.ok(!tag.includes('data-index='), 'Auxiliary button must not have data-index');
            assert.ok(!tag.includes('data-page='), 'Auxiliary button must not have data-page');
        }

        // Check top-right corner customizable icon container
        assert.ok(html.includes('id="image-container"'), 'Pro model must include #image-container');
        assert.ok(html.includes('pro-corner-top-right'), 'Pro model must include top-right corner');
        assert.ok(html.includes('pro-corner-top-left'), 'Pro model must include top-left corner');
    }
});

test('model preference resolution respects auto-detection and manual override for all supported models', () => {
    // Default / Auto with no hardware -> Classic
    setModelPreference(LAUNCHPAD_MODELS.AUTO);
    setDetectedHardwareModel(null);
    assert.equal(getEffectiveModel(), 'classic');

    // Auto with detected MK3 -> MK3
    setDetectedHardwareModel('mk3');
    assert.equal(getEffectiveModel(), 'mk3');

    // Auto with detected Pro (2015) -> Pro
    setDetectedHardwareModel('pro');
    assert.equal(getEffectiveModel(), 'pro');

    // Auto with detected Pro MK3 -> Pro MK3
    setDetectedHardwareModel('pro-mk3');
    assert.equal(getEffectiveModel(), 'pro-mk3');

    // Manual overrides
    setModelPreference(LAUNCHPAD_MODELS.CLASSIC);
    assert.equal(getEffectiveModel(), 'classic');

    setModelPreference(LAUNCHPAD_MODELS.MK3);
    assert.equal(getEffectiveModel(), 'mk3');

    setModelPreference(LAUNCHPAD_MODELS.PRO);
    assert.equal(getEffectiveModel(), 'pro');

    setModelPreference(LAUNCHPAD_MODELS.PRO_MK3);
    assert.equal(getEffectiveModel(), 'pro-mk3');

    // Reset back to Auto
    setModelPreference(LAUNCHPAD_MODELS.AUTO);
    setDetectedHardwareModel(null);
    assert.equal(getEffectiveModel(), 'classic');
});

test('custom top-right icon is preserved when switching between Launchpad models', async () => {
    const { setTopRightIconFile, getCurrentIconUrl, resetTopRightIcon } = await import('../js/ui.js');

    // Simulate loading a project with custom icon
    await setTopRightIconFile('projects/Virtual Riot - Idols/icon.png');
    assert.equal(getCurrentIconUrl(), 'projects/Virtual Riot - Idols/icon.png', 'Project icon URL must be stored in currentIconUrl');

    // Switching model must retain the active icon URL
    setModelPreference(LAUNCHPAD_MODELS.MK3);
    assert.equal(getCurrentIconUrl(), 'projects/Virtual Riot - Idols/icon.png');

    setModelPreference(LAUNCHPAD_MODELS.PRO);
    assert.equal(getCurrentIconUrl(), 'projects/Virtual Riot - Idols/icon.png');

    setModelPreference(LAUNCHPAD_MODELS.PRO_MK3);
    assert.equal(getCurrentIconUrl(), 'projects/Virtual Riot - Idols/icon.png');

    setModelPreference(LAUNCHPAD_MODELS.CLASSIC);
    assert.equal(getCurrentIconUrl(), 'projects/Virtual Riot - Idols/icon.png');

    // Resetting icon restores default
    await resetTopRightIcon();
    assert.equal(getCurrentIconUrl(), null);
});

test('Classic model defines mode buttons (4-7), while other models omit them; mode selection is preserved on sync', async () => {
    // 1. Classic layout defines mode buttons for all 4 official modes (4, 5, 6, 7)
    const classicHtml = buildClassicHtml();
    for (let mode = 4; mode <= 7; mode++) {
        assert.ok(
            classicHtml.includes(`data-mode="${mode}"`),
            `Classic layout must include mode button with data-mode="${mode}"`
        );
    }

    // 2. MK3 and Pro layouts do NOT attach data-mode, avoiding false User 1 / User 2 mode mappings
    for (const [name, html] of [
        ['MK3', buildMk3Html()],
        ['Pro', buildProHtml({ isMk3: false })],
        ['Pro MK3', buildProHtml({ isMk3: true })]
    ]) {
        assert.ok(!html.includes('data-mode='), `${name} layout must not have data-mode attributes`);
    }

    // 2. Verify updateModeButtonHighlight correctly updates .selected
    const { updateModeButtonHighlight } = await import('../js/webInterface.js');

    class MockClassList {
        constructor() {
            this.classes = new Set();
        }
        add(c) { this.classes.add(c); }
        remove(c) { this.classes.delete(c); }
        toggle(c, force) {
            if (force === undefined) {
                if (this.classes.has(c)) this.classes.delete(c);
                else this.classes.add(c);
            } else if (force) {
                this.classes.add(c);
            } else {
                this.classes.delete(c);
            }
        }
        contains(c) { return this.classes.has(c); }
    }

    const mockButtons = [4, 5, 6, 7].map(m => ({
        dataset: { mode: String(m) },
        classList: new MockClassList()
    }));

    const origQSA = globalThis.document.querySelectorAll;
    globalThis.document.querySelectorAll = (selector) => {
        if (selector.includes('[data-mode]')) {
            return mockButtons;
        }
        return [];
    };

    try {
        // Highlight mode 5 (User 1)
        updateModeButtonHighlight(5);
        assert.equal(mockButtons[0].classList.contains('selected'), false); // mode 4
        assert.equal(mockButtons[1].classList.contains('selected'), true);  // mode 5
        assert.equal(mockButtons[2].classList.contains('selected'), false); // mode 6
        assert.equal(mockButtons[3].classList.contains('selected'), false); // mode 7

        // Highlight mode 6 (User 2)
        updateModeButtonHighlight(6);
        assert.equal(mockButtons[0].classList.contains('selected'), false);
        assert.equal(mockButtons[1].classList.contains('selected'), false);
        assert.equal(mockButtons[2].classList.contains('selected'), true);  // mode 6
        assert.equal(mockButtons[3].classList.contains('selected'), false);
    } finally {
        globalThis.document.querySelectorAll = origQSA;
    }
});

test('Launchpad sticker styles support all models: square on modern models, perimeter aux on Pro, visible labels', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const cssPath = resolve(__dirname, '../css/launchpad.css');
    const cssContent = readFileSync(cssPath, 'utf8');

    // Verify perimeter buttons have sticker styles, excluding the chassis corners
    assert.ok(cssContent.includes('.grid-item-pro-aux:not(.pro-corner-button)::before'), 'CSS must include stickers for Pro auxiliary buttons, excluding corners');
    assert.ok(!cssContent.includes('.pro-corner-button::before') && !cssContent.includes('.pro-corner-button:not'), 'CSS must not put stickers on corner buttons (spigoli)');

    // Verify modern MK3 has square/squircle stickers (9%)
    assert.ok(cssContent.includes('.launchpad-model-mk3.has-stickers .grid-item-menu::before'), 'CSS must specify MK3 menu sticker rounding');
    assert.ok(cssContent.includes('.launchpad-model-pro-mk3.has-stickers .pro-squircle-btn:not(.pro-corner-button)::before') ||
              cssContent.includes('.launchpad-model-pro-mk3.has-stickers .grid-item-menu::before'), 'CSS must specify Pro MK3 squircle sticker rounding');

    // Verify labels and icons stay above black stickers
    assert.ok(cssContent.includes('.Launchpad.has-stickers .mk3-btn-text'));
    assert.ok(cssContent.includes('.Launchpad.has-stickers .pro-btn-text'));
    assert.ok(cssContent.includes('.Launchpad.has-stickers .mk3-icon'));
    assert.ok(cssContent.includes('.Launchpad.has-stickers .pro-icon'));
    assert.ok(cssContent.includes('z-index: 2;'), 'Labels/icons must have higher z-index than stickers');
});
