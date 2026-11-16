import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = { querySelectorAll: () => [], getElementById: () => null };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const { parseDynamicLight } = await import('../js/lights.js');

test('scroll lights: text and colour, direction left by default', () => {
    assert.deepEqual(parseDynamicLight('scroll_HELLO_green'), { kind: 'scroll', text: 'HELLO', color: 'green', direction: 'left' });
});

test('scroll lights with an explicit direction, including from-top/from-bottom aliases', () => {
    assert.deepEqual(parseDynamicLight('scroll_up_HI_red'), { kind: 'scroll', text: 'HI', color: 'red', direction: 'up' });
    assert.deepEqual(parseDynamicLight('scroll_RIGHT_HI_red'), { kind: 'scroll', text: 'HI', color: 'red', direction: 'right' });
    assert.deepEqual(parseDynamicLight('scroll_top_HI_red'), { kind: 'scroll', text: 'HI', color: 'red', direction: 'down' });
    assert.deepEqual(parseDynamicLight('scroll_bottom_HI_red'), { kind: 'scroll', text: 'HI', color: 'red', direction: 'up' });
});

test('a direction word is only a direction when text and colour follow it', () => {
    // Three parts: "up" is the text and "HI" the colour (historical behaviour, kept).
    assert.deepEqual(parseDynamicLight('scroll_up_HI'), { kind: 'scroll', text: 'up', color: 'HI', direction: 'left' });
    // A non-direction second part: extra parts are ignored.
    assert.deepEqual(parseDynamicLight('scroll_HELLO_green_extra'), { kind: 'scroll', text: 'HELLO', color: 'green', direction: 'left' });
});

test('text lights', () => {
    assert.deepEqual(parseDynamicLight('text_ANNA_red'), { kind: 'text', text: 'ANNA', color: 'red' });
});

test('incomplete or ordinary names are not dynamic lights', () => {
    assert.equal(parseDynamicLight('scroll_HELLO'), null);
    assert.equal(parseDynamicLight('scroll__green'), null, 'empty text');
    assert.equal(parseDynamicLight('text_ANNA'), null);
    assert.equal(parseDynamicLight('fade_red'), null);
    assert.equal(parseDynamicLight('scrolling_X_red'), null);
});
