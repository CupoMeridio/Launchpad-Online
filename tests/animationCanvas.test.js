/**
 * The Studio's custom animation canvas on a (fake) legacy Launchpad: how many
 * LED messages drawing sends, and which parts of the panel it re-renders.
 * Legacy Launchpads take LED messages slowly, so a drag must send only the
 * pads that changed, while a click still repaints (and corrects) every pad.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs } from './helpers/browserStubs.js';

const { elements, launchpad } = installBrowserStubs();
// The Studio also fills <select> elements, which the generic stubs lack.
const getStubElement = globalThis.document.getElementById;
globalThis.document.getElementById = (id) => {
    const element = getStubElement(id);
    element.options ??= [];
    return element;
};

const { initializeProjectCreator, openCreator } = await import('../js/creator/index.js');
const { creatorSession } = await import('../js/projectCreatorState.js');
const { getPadSource } = await import('../js/interaction.js');
const { setDeviceProfile } = await import('../js/physicalInterface.js');
const { LaunchpadLegacy } = await import('../js/midi-profiles/LaunchpadLegacy.js');

/** A legacy Launchpad whose output records every LED message (3 bytes each). */
function connectLegacyLaunchpad() {
    const messages = [];
    const output = {
        send(bytes) {
            for (let i = 0; i < bytes.length; i += 3) messages.push([bytes[i], bytes[i + 1], bytes[i + 2]]);
        }
    };
    setDeviceProfile(new LaunchpadLegacy(output, null));
    return messages;
}

/** Counts re-renders of the brush palette (part of the editor panel). */
function countPanelRenders() {
    const palette = elements.get('creator-anim-palette') ?? globalThis.document.getElementById('creator-anim-palette');
    const original = palette.replaceChildren.bind(palette);
    const counter = { renders: 0 };
    palette.replaceChildren = (...children) => {
        counter.renders++;
        return original(...children);
    };
    return counter;
}

initializeProjectCreator();
openCreator();
creatorSession.setCreatorView('animations');
creatorSession.createAnimation('Strokes');
const pads = getPadSource();

test('a drag sends one LED message per pad crossed; a click repaints every pad', () => {
    const messages = connectLegacyLaunchpad();
    assert.equal(messages.length, 64, 'connecting shows the frame being drawn');
    messages.length = 0;

    pads.onPadPress(0); // click: paints (0,0) and repaints the whole Launchpad
    assert.equal(messages.length, 64);
    messages.length = 0;

    [1, 2, 3, 2].forEach(index => pads.onPadDrag(index)); // dragging on, then back over (2,0)
    pads.onDragEnd();
    assert.deepEqual(messages, [[0x90, 0x01, 3], [0x90, 0x02, 3], [0x90, 0x03, 3]], 'red, only the 3 new pads');
    assert.equal(launchpad.pads[3].classList.contains('active'), true, 'the screen follows too');

    messages.length = 0;
    pads.onPadPress(9); // the next click corrects any LED changed by something else
    assert.equal(messages.length, 64);
});

test('erasing by dragging sends only the pads turned off', () => {
    const messages = connectLegacyLaunchpad();
    creatorSession.clearActiveFrame();
    pads.onPadPress(0);
    [1, 2].forEach(index => pads.onPadDrag(index));
    pads.onDragEnd();
    messages.length = 0;

    pads.onPadPress(1); // starts on a lit pad: the stroke erases
    messages.length = 0;
    pads.onPadDrag(2);
    pads.onPadDrag(5); // already off: nothing to send
    pads.onDragEnd();
    assert.deepEqual(messages, [[0x90, 0x02, 0]]);
});

test('drawing does not re-render the editor panel; changing frame does', () => {
    connectLegacyLaunchpad();
    const counter = countPanelRenders();

    pads.onPadPress(20);
    pads.onPadDrag(21);
    pads.onPadDrag(22);
    pads.onDragEnd();
    creatorSession.transformFrames('shiftDown');
    assert.equal(counter.renders, 0);

    creatorSession.addFrame();
    assert.equal(counter.renders, 1);
});

test('a reconnected device gets the whole frame, then only the changes', () => {
    connectLegacyLaunchpad();
    pads.onPadPress(30);
    const messages = connectLegacyLaunchpad(); // e.g. unplugged and plugged back in
    assert.equal(messages.length, 64, 'the whole frame, including the pads drawn before');
    assert.deepEqual(messages.find(([, key]) => key === 0x36), [0x90, 0x36, 3], 'pad (6,3) is red');
    messages.length = 0;
    pads.onPadDrag(31);
    pads.onDragEnd();
    assert.equal(messages.length, 1);
});

test('a light without colours never borrows a colour: dashed swatch and ring instead', async () => {
    const { paintLightSwatch, getAnimationColor } = await import('../js/creator/lightPicker.js');
    const { createElement } = await import('./helpers/browserStubs.js');

    const swatch = createElement('span');
    paintLightSwatch(swatch, ['blue']);
    assert.equal(swatch.classList.contains('is-colorless'), false);
    assert.ok(swatch.style['--preset-color'], 'a real blue light keeps its colour');
    paintLightSwatch(swatch, []);
    assert.equal(swatch.classList.contains('is-colorless'), true);
    assert.equal(swatch.style['--preset-color'], undefined, 'no stand-in colour');
    assert.equal(getAnimationColor('no-such-light'), null, 'unknown lights: same state as empty ones');

    // An empty custom animation on a pad: dashed ring, no colour.
    creatorSession.setCreatorView('pads');
    const id = creatorSession.createAnimation('Empty');
    creatorSession.setActivePadIndex(40);
    creatorSession.assignStepLight(40, 0, `custom:${id}`);
    const pad = launchpad.pads[40];
    assert.equal(pad.classList.contains('creator-pad-colorless'), true);
    assert.equal(pad.style['--creator-led-color'], undefined);

    // Its first painted pad gives it a colour.
    creatorSession.setCreatorView('animations');
    creatorSession.paintPad(0, 0);
    creatorSession.setCreatorView('pads');
    assert.equal(pad.classList.contains('creator-pad-colorless'), false);
    assert.ok(pad.style['--creator-led-color']);
});

test('the pad ring shows the most visible colour of a custom animation', async () => {
    const { webColorMap } = await import('../js/webInterface.js'); // the swatches' palette
    creatorSession.setCreatorView('animations');
    const id = creatorSession.createAnimation('Mostly blue');
    creatorSession.setBrush({ color: 'red', erase: false, tool: 'pencil' });
    creatorSession.paintPad(0, 0); // red drawn first, on one pad
    creatorSession.setBrush({ color: 'green' });
    creatorSession.paintPad(0, 1); // then green, on one pad
    creatorSession.setBrush({ color: 'blue' });
    [1, 2, 3, 4].forEach(x => creatorSession.paintPad(x, 0));

    creatorSession.setCreatorView('pads');
    creatorSession.setActivePadIndex(50);
    creatorSession.assignStepLight(50, 0, `custom:${id}`);
    assert.equal(launchpad.pads[50].style['--creator-led-color'], webColorMap.blue.baseColor, 'blue (4 pads); the old "middle colour in drawing order" rule gave green');
});
