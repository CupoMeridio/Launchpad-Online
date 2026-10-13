import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnimationCatalog } from '../js/projectCreatorModel.js';

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const { animations } = await import('../js/lights.js');

test('catalog groups every registered animation without dropping color variants', () => {
    const catalog = buildAnimationCatalog(animations);
    const catalogNames = catalog.flatMap(group => group.variants.map(variant => variant.animation)).sort();

    assert.deepEqual(catalogNames, Object.keys(animations).sort());
    assert.ok(catalog.some(group => group.category === 'basic'));
    assert.ok(catalog.some(group => group.category === 'geometric'));
    assert.ok(catalog.some(group => group.category === 'directional'));
    assert.ok(catalog.some(group => group.category === 'multicolor'));
    assert.ok(catalog.some(group => group.category === 'characters'));
    assert.ok(catalog.some(group => group.category === 'special'));
    assert.ok(catalog.flatMap(group => group.variants).some(variant => variant.supportsDuration));
    assert.ok(catalog.flatMap(group => group.variants).some(variant => !variant.supportsDuration));

    const fadeGroup = catalog.find(group => group.id === 'fade');
    assert.ok(fadeGroup);
    assert.ok(fadeGroup.variants.every(variant => variant.supportsDuration));

    const holdGroup = catalog.find(group => group.id === 'hold');
    assert.ok(holdGroup);
    assert.ok(holdGroup.variants.every(variant => !variant.supportsDuration));

    const multicolorWave = catalog.find(group => group.id === 'wave_multi');
    assert.equal(multicolorWave.category, 'multicolor');
    assert.deepEqual(multicolorWave.variants.map(variant => variant.sequence), ['red_to_green', 'green_to_red']);

    const multicolorGroups = catalog.filter(group => group.category === 'multicolor');
    assert.ok(multicolorGroups.length > 0);
    for (const group of multicolorGroups) {
        assert.equal(group.variants.length, 2, `${group.id} should group both color sequences`);
        assert.deepEqual(group.variants.map(variant => variant.sequence).sort(), ['green_to_red', 'red_to_green']);
    }
});