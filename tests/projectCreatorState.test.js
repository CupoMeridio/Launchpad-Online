import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCreatorSession } from '../js/projectCreatorState.js';
import { MAX_PROJECT_PAGES } from '../js/constants.js';
import { createDraft } from '../js/projectCreatorModel.js';

test('ProjectCreatorSession lifecycle: open, state initialization, and close', () => {
    const session = new ProjectCreatorSession();
    assert.equal(session.isEditorActive(), false);
    assert.equal(session.getDraft(), null);

    session.open();
    assert.equal(session.isEditorActive(), true);
    assert.ok(session.getDraft());
    assert.equal(session.getActivePageIndex(), 0);
    assert.equal(session.getActivePadIndex(), 0);
    assert.equal(session.getActiveStepIndex(), 0);
    assert.equal(session.getStudioSubMode(), 'edit');
    assert.equal(session.getActiveCreatorView(), 'pads');
    assert.equal(session.isDirty(), false);

    session.close();
    assert.equal(session.isEditorActive(), false);
    assert.equal(session.getDraft(), null);
    assert.equal(session.getActivePadIndex(), null);
});

test('ProjectCreatorSession navigation: page bounds and pad bounds', () => {
    const session = new ProjectCreatorSession();
    session.open();

    // Invalid page index
    assert.equal(session.setActivePageIndex(-1), false);
    assert.equal(session.setActivePageIndex(5), false);
    assert.equal(session.getActivePageIndex(), 0);

    // Pad selection
    assert.equal(session.setActivePadIndex(15), true);
    assert.equal(session.getActivePadIndex(), 15);
    assert.equal(session.getActiveStepIndex(), 0);

    // Out of bounds pad selection
    assert.equal(session.setActivePadIndex(64), false);
    assert.equal(session.setActivePadIndex(-1), false);
    assert.equal(session.getActivePadIndex(), 15);

    // Null pad selection
    assert.equal(session.setActivePadIndex(null), true);
    assert.equal(session.getActivePadIndex(), null);
});

test('ProjectCreatorSession page addition and removal with limits', () => {
    const session = new ProjectCreatorSession();
    session.open();
    assert.equal(session.getDraft().pages.length, 1);

    // Add page
    assert.equal(session.addPage(), true);
    assert.equal(session.getDraft().pages.length, 2);
    assert.equal(session.getActivePageIndex(), 1);
    assert.equal(session.isDirty(), true);

    // Add up to MAX_PROJECT_PAGES
    while (session.getDraft().pages.length < MAX_PROJECT_PAGES) {
        assert.equal(session.addPage(), true);
    }
    assert.equal(session.getDraft().pages.length, MAX_PROJECT_PAGES);
    assert.equal(session.addPage(), false);

    // Remove page
    assert.equal(session.removePage(MAX_PROJECT_PAGES - 1), true);
    assert.equal(session.getDraft().pages.length, MAX_PROJECT_PAGES - 1);

    // Cannot remove down to 0
    while (session.getDraft().pages.length > 1) {
        session.removePage();
    }
    assert.equal(session.getDraft().pages.length, 1);
    assert.equal(session.removePage(), false);
    assert.equal(session.getDraft().pages.length, 1);
});

test('ProjectCreatorSession multisampling step management', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.setActivePadIndex(4);

    assert.equal(session.getActiveStepIndex(), 0);

    // Add step
    const step1 = session.addStep();
    assert.equal(step1, 1);
    assert.equal(session.getActiveStepIndex(), 1);

    const step2 = session.addStep();
    assert.equal(step2, 2);
    assert.equal(session.getActiveStepIndex(), 2);

    // Set step light and timing
    session.assignStepLight(4, 2, 'rain_down_red');
    session.setStepLightDuration(4, 2, 1.5);
    session.setStepLightSync(4, 2, false);

    const currentStep = session.getCurrentStep();
    assert.equal(currentStep.light, 'rain_down_red');
    assert.equal(currentStep.duration, 1.5);
    assert.equal(currentStep.syncToSound, false);

    // Remove step
    assert.equal(session.removeStep(4, 2), true);
    assert.equal(session.getActiveStepIndex(), 1);

    // Step addition limit
    while (session.addStep(4) !== -1) {
        // loop until max
    }
    assert.equal(session.addStep(4), -1);
});

test('ProjectCreatorSession pad config: edit mode vs live mode round-robin', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.setActivePadIndex(8);

    // Add 3 steps to pad 8
    session.addStep(8); // step 1
    session.addStep(8); // step 2

    session.assignStepLight(8, 0, 'step0_light');
    session.assignStepLight(8, 1, 'step1_light');
    session.assignStepLight(8, 2, 'step2_light');

    // In EDIT mode:
    // If querying activePadIndex (8), config returns the activeStepIndex (which is currently 2)
    session.setActiveStepIndex(1);
    const cfgEditActive = session.getPadPlayback(8);
    assert.equal(cfgEditActive.step.light, 'step1_light');

    // If querying another pad (e.g. 9), config returns step 0
    const cfgEditOther = session.getPadPlayback(9);
    assert.equal(cfgEditOther.step.light, null);

    // In LIVE mode:
    session.setStudioSubMode('live');
    assert.equal(session.getStudioSubMode(), 'live');

    // Mock round-robin cursor advancing: 0, 1, 2, 3 (modulo 3 -> 0, 1, 2, 0)
    let mockCursor = 0;
    const mockCursorFn = () => mockCursor;

    mockCursor = 0;
    const live0 = session.getPadPlayback(8, mockCursorFn);
    assert.equal(live0.stepIndex, 0);
    assert.equal(live0.step.light, 'step0_light');

    mockCursor = 1;
    const live1 = session.getPadPlayback(8, mockCursorFn);
    assert.equal(live1.stepIndex, 1);
    assert.equal(live1.step.light, 'step1_light');

    mockCursor = 2;
    const live2 = session.getPadPlayback(8, mockCursorFn);
    assert.equal(live2.stepIndex, 2);
    assert.equal(live2.step.light, 'step2_light');

    mockCursor = 3; // wraps around to 0
    const live3 = session.getPadPlayback(8, mockCursorFn);
    assert.equal(live3.stepIndex, 0);
    assert.equal(live3.step.light, 'step0_light');
});

test('ProjectCreatorSession dirty tracking', () => {
    const session = new ProjectCreatorSession();
    session.open();
    assert.equal(session.isDirty(), false);

    session.markModified();
    assert.equal(session.isDirty(), true);

    session.markSaved();
    assert.equal(session.isDirty(), false);
});

function recordChanges(session) {
    const notifications = [];
    session.subscribe(changes => notifications.push(changes.map(change => ({ ...change }))));
    return notifications;
}

test('session notifies what changed, and marks the draft modified only for edits', () => {
    const session = new ProjectCreatorSession();
    const notifications = recordChanges(session);

    session.open();
    assert.deepEqual(notifications.pop(), [{ type: 'draft' }]);
    assert.equal(session.isDirty(), false);

    session.setActivePadIndex(3);
    assert.deepEqual(notifications.pop(), [{ type: 'selection' }]);
    assert.equal(session.isDirty(), false, 'selection is not an edit');

    session.assignStepLight(3, 0, 'fade_red');
    assert.deepEqual(notifications.pop(), [{ type: 'pads', field: 'light' }]);
    assert.equal(session.isDirty(), true);

    session.removeStepLight();
    assert.deepEqual(notifications.pop(), [{ type: 'pads', field: 'light' }]);
    assert.equal(session.getCurrentStep().light, null);

    session.setStepLightDuration(undefined, undefined, '1.26');
    assert.deepEqual(notifications.pop(), [{ type: 'pads', field: 'duration' }]);
    assert.equal(session.getCurrentStep().duration, 1.3);
    assert.equal(session.setStepLightDuration(undefined, undefined, 'abc'), false);
    assert.equal(notifications.length, 0, 'rejected edits notify nothing');
});

test('session batch coalesces several mutations into one notification', () => {
    const session = new ProjectCreatorSession();
    session.open();
    const notifications = recordChanges(session);

    const result = session.batch(() => {
        session.setPendingTextAnimation(null);
        session.assignStepLight(0, 0, 'wave_blue');
        return 'done';
    });

    assert.equal(result, 'done');
    assert.equal(notifications.length, 1);
    assert.deepEqual(notifications[0].map(change => change.type), ['lightPicker', 'pads']);
});

test('session metadata and appearance edits are validated and notified', () => {
    const session = new ProjectCreatorSession();
    session.open();
    const notifications = recordChanges(session);

    assert.equal(session.setName('Live Set'), true);
    assert.equal(session.setName('Live Set'), false, 'unchanged name is a no-op');
    assert.equal(session.setTargetDevice('legacy'), true);
    assert.equal(session.setTargetDevice('not-a-device'), true, 'unknown targets normalize to universal');
    assert.equal(session.getDraft().targetDevice, 'universal');

    const file = { name: 'cover.png' };
    assert.equal(session.setAppearanceAsset('skin', file), true);
    assert.equal(session.setAppearanceAsset('name', 'x'), false, 'only appearance assets are accepted');
    assert.equal(session.getDraft().appearance.skin, file);

    session.updateVisualizer({ mode: 'both', color1: 'not-a-colour?' });
    assert.equal(session.getDraft().appearance.visualizer.mode, 'both');
    assert.equal(session.getDraft().appearance.visualizer.color2, '#00aaff', 'untouched settings are kept');

    session.setLayout({ size: 90 });
    assert.equal(session.getDraft().appearance.size, 90);
    assert.equal(session.getDraft().appearance.rotation, null, 'unspecified layout stays unset');

    assert.deepEqual(notifications.flat(), [
        { type: 'meta', field: 'name' },
        { type: 'meta', field: 'targetDevice' },
        { type: 'meta', field: 'targetDevice' },
        { type: 'theme', aspect: 'skin' },
        { type: 'theme', aspect: 'visualizer', keys: ['mode', 'color1'] },
        { type: 'theme', aspect: 'layout' }
    ]);
});

test('session tracks whether an import is still current', () => {
    const session = new ProjectCreatorSession();
    session.open();
    const first = session.nextImportId();
    assert.equal(session.isImportCurrent(first), true);
    const second = session.nextImportId();
    assert.equal(session.isImportCurrent(first), false, 'a newer import supersedes it');
    assert.equal(session.isImportCurrent(second), true);
    session.close();
    assert.equal(session.isImportCurrent(second), false, 'closing the editor cancels it');
});

test('assignStepSample decodes into the selected step and notifies once assigned', async () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.setActivePadIndex(5);
    const notifications = recordChanges(session);

    const result = await session.assignStepSample({ name: 'kick.wav' }, async () => ({ duration: 1 }));
    assert.equal(result, 'assigned');
    assert.equal(session.getCurrentStep().sample.name, 'kick.wav');
    assert.deepEqual(session.getCurrentStep().buffer, { duration: 1 });
    assert.deepEqual(notifications.pop(), [{ type: 'pads', field: 'sample' }]);

    const failed = await session.assignStepSample({ name: 'bad.wav' }, async () => { throw new Error('decode'); });
    assert.equal(failed, 'failed');
    assert.equal(notifications.length, 0);
});

test('animation editor: create, select, rename, playback and delete with reference cleanup', () => {
    const session = new ProjectCreatorSession();
    session.open();
    const notifications = recordChanges(session);

    const first = session.createAnimation('Intro');
    const second = session.createAnimation();
    assert.deepEqual([first, second], ['anim-1', 'anim-2']);
    assert.equal(session.getActiveAnimation().id, 'anim-2', 'a new animation is selected');
    assert.equal(session.isDirty(), true);

    assert.equal(session.selectAnimation('anim-1'), true);
    assert.equal(session.renameAnimation('Opening'), true);
    assert.equal(session.setAnimationPlayback('hold'), true);
    assert.equal(session.setAnimationPlayback('forever'), false);
    assert.deepEqual(session.getActiveAnimation(), {
        id: 'anim-1', name: 'Opening', playback: 'hold', frames: [{ duration: 100, pads: {} }]
    });

    session.setActivePadIndex(2);
    session.assignStepLight(2, 0, 'custom:anim-1');
    notifications.length = 0;

    assert.equal(session.deleteAnimation(), true);
    assert.equal(session.getCurrentStep().light, null, 'pads lose the deleted light');
    assert.equal(session.getActiveAnimation().id, 'anim-2', 'the neighbour is selected');
    assert.deepEqual(notifications, [[{ type: 'animations', field: 'list' }, { type: 'pads', field: 'light' }]]);
});

test('animation editor: frame operations keep a sensible selection', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.createAnimation('Chase');

    assert.equal(session.setFrameDuration(250), true);
    assert.equal(session.setFrameDuration(1), false, 'out of range');
    session.paintPad(0, 0);
    assert.equal(session.duplicateActiveFrame(), true);
    assert.equal(session.getActiveFrameIndex(), 1);
    assert.deepEqual(session.getActiveFrame(), { duration: 250, pads: { '0,0': { color: 'red', level: 'full' } } });

    assert.equal(session.addFrame(), true);
    assert.equal(session.getActiveFrameIndex(), 2);
    assert.deepEqual(session.getActiveFrame(), { duration: 250, pads: {} }, 'new frames are empty, same duration');

    assert.equal(session.moveActiveFrame(-2), true);
    assert.equal(session.getActiveFrameIndex(), 0);
    assert.deepEqual(session.getActiveAnimation().frames.map(f => Object.keys(f.pads).length), [0, 1, 1]);
    assert.equal(session.moveActiveFrame(-1), false, 'already first');

    assert.equal(session.deleteActiveFrame(), true);
    assert.equal(session.getActiveAnimation().frames.length, 2);
    session.deleteActiveFrame();
    assert.equal(session.deleteActiveFrame(), false, 'the last frame cannot be deleted');
});

test('animation editor: the brush paints, toggles and erases pads', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.createAnimation();
    const pads = () => session.getActiveFrame().pads;

    session.paintPad(1, 1);
    assert.deepEqual(pads(), { '1,1': { color: 'red', level: 'full' } });
    session.paintPad(1, 1);
    assert.deepEqual(pads(), {}, 'same brush again toggles the pad off');

    session.setBrush({ color: 'green', level: 'low' });
    session.paintPad(2, 2);
    session.paintPad(3, 3);
    assert.deepEqual(pads()['2,2'], { color: 'green', level: 'low' });

    session.setBrush({ erase: true });
    session.paintPad(2, 2);
    assert.equal(session.paintPad(5, 5), false, 'erasing an empty pad changes nothing');
    assert.deepEqual(Object.keys(pads()), ['3,3']);

    assert.equal(session.setBrush({ level: 'dim' }), false);
    assert.equal(session.clearActiveFrame(), true);
    assert.equal(session.clearActiveFrame(), false);
});

test('animation editor: opening a draft selects its first animation', () => {
    const session = new ProjectCreatorSession();
    const draft = createDraft('With animations', null, {
        animations: [{ id: 'a', name: 'A', playback: 'once', frames: [{ duration: 100, pads: {} }] }]
    });
    session.open(draft);
    assert.equal(session.getActiveAnimation().id, 'a');
    assert.equal(session.setCreatorView('animations'), true);
});

test('animation editor: dragging a stroke paints or erases like its first pad', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.createAnimation();
    const lit = () => Object.keys(session.getActiveFrame().pads).sort();

    session.paintPad(0, 0); // paints: the stroke paints
    session.continueStroke(1, 0);
    session.continueStroke(1, 0); // dragging back over a pad does not toggle it off
    session.continueStroke(2, 0);
    assert.deepEqual(lit(), ['0,0', '1,0', '2,0']);
    session.endStroke();
    assert.equal(session.continueStroke(3, 0), false, 'no stroke after the release');

    session.paintPad(1, 0); // toggles a lit pad off: the stroke erases
    session.continueStroke(2, 0);
    session.continueStroke(4, 4);
    assert.deepEqual(lit(), ['0,0']);

    session.selectFrame(0);
    assert.equal(session.continueStroke(5, 5), false, 'changing frame ends the stroke');
});

test('animation editor: the fill tool fills a region and starts no stroke', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.createAnimation();
    assert.equal(session.setBrush({ tool: 'bucket' }), false);
    assert.equal(session.setBrush({ tool: 'fill', color: 'blue' }), true);

    assert.equal(session.paintPad(4, 4), true);
    assert.equal(Object.keys(session.getActiveFrame().pads).length, 64);
    assert.equal(session.continueStroke(0, 0), false);
    assert.equal(session.paintPad(4, 4), false, 'already filled with this colour');

    session.setBrush({ erase: true });
    session.paintPad(0, 0);
    assert.deepEqual(session.getActiveFrame().pads, {});
});

test('animation editor: transforms, copy and paste, onion skin', () => {
    const session = new ProjectCreatorSession();
    session.open();
    session.createAnimation();
    session.paintPad(0, 0);
    session.addFrame();
    session.paintPad(0, 7);

    assert.equal(session.transformFrames('shiftRight'), true);
    assert.deepEqual(Object.keys(session.getActiveFrame().pads), ['1,7']);
    assert.deepEqual(Object.keys(session.getActiveAnimation().frames[0].pads), ['0,0'], 'other frames untouched');
    assert.equal(session.transformFrames('flipVertical', true), true);
    assert.deepEqual(session.getActiveAnimation().frames.map(f => Object.keys(f.pads)), [['0,7'], ['1,0']]);
    assert.equal(session.transformFrames('explode'), false);

    assert.equal(session.hasFrameClipboard(), false);
    assert.equal(session.pasteIntoActiveFrame(), false);
    session.copyActiveFrame();
    session.getActiveFrame().pads['1,0'].color = 'green';
    session.createAnimation('Other'); // the clipboard survives switching animation
    assert.equal(session.pasteIntoActiveFrame(), true);
    assert.deepEqual(session.getActiveFrame().pads, { '1,0': { color: 'red', level: 'full' } }, 'a copy, not a reference');

    assert.equal(session.getPreviousFrame(), null, 'the first frame has none');
    session.addFrame();
    assert.deepEqual(session.getPreviousFrame().pads, { '1,0': { color: 'red', level: 'full' } });
    assert.equal(session.isOnionSkinEnabled(), false);
    assert.equal(session.setOnionSkin(true), true);
    assert.equal(session.setOnionSkin(true), false);

    session.deleteAnimation();
    assert.equal(session.hasFrameClipboard(), true, 'tools outlive deletions');
    session.close();
    session.open();
    assert.equal(session.hasFrameClipboard(), false, 'a new session starts clean');
    assert.equal(session.isOnionSkinEnabled(), false);
});
