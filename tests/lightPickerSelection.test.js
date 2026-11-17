/**
 * Which light swatch the Studio highlights: only one choice at a time, so a
 * text light being chosen never shows next to the light already assigned.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserStubs } from './helpers/browserStubs.js';

installBrowserStubs();
const { isSwatchSelected } = await import('../js/creator/lightPicker.js');

const regular = (animationName, selectedLight, pendingText = null) =>
    isSwatchSelected({ selectedLight, pendingText, template: null, color: 'red', animationName });
const text = (template, color, selectedLight, pendingText = null) =>
    isSwatchSelected({ selectedLight, pendingText, template, color, animationName: template });

test('a regular light is selected when it is the one assigned', () => {
    assert.equal(regular('rain_down_red', 'rain_down_red'), true);
    assert.equal(regular('rain_up_red', 'rain_down_red'), false);
    assert.equal(regular('rain_down_red', null), false);
});

test('an assigned text light selects its template and colour only', () => {
    const light = 'scroll_left_HI_red';
    assert.equal(text('scroll_left', 'red', light), true);
    assert.equal(text('scroll_left', 'green', light), false, 'other colour');
    assert.equal(text('scroll', 'red', light), false, '"scroll" does not claim the directional scrolls');
    assert.equal(text('text', 'red', light), false);
    assert.equal(text('scroll', 'red', 'scroll_HI_red'), true);
    assert.equal(text('scroll_up', 'red', 'scroll_HI_red'), false);
});

test('a text light being chosen is the only selection, whatever is assigned', () => {
    const pending = { template: 'scroll_up', color: 'green' };
    assert.equal(text('scroll_up', 'green', 'rain_down_red', pending), true);
    assert.equal(regular('rain_down_red', 'rain_down_red', pending), false, 'the assigned light is not highlighted too');
    assert.equal(text('scroll_left', 'red', 'scroll_left_HI_red', pending), false, 'nor the assigned text light');
    assert.equal(text('scroll_up', 'green', null, pending), true, 'also on a pad without a light');
});
