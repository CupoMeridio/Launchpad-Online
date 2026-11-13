import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCreatorSession } from '../js/projectCreatorState.js';
import { MAX_PROJECT_PAGES } from '../js/constants.js';

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
    assert.equal(currentStep.lightDuration, 1.5);
    assert.equal(currentStep.lightSyncToSound, false);

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
