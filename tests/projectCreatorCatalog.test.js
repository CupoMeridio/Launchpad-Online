import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnimationCatalog } from '../js/projectCreatorModel.js';

globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const { animations } = await import('../js/lights.js');

test('catalog groups every registered animation without dropping color variants', () => {
    const catalog = buildAnimationCatalog(animations);
    const catalogNames = catalog.flatMap(group => group.variants.map(variant => variant.animation)).sort();

    // Every animation is listed, except the former names kept for old projects.
    const listed = Object.keys(animations).filter(name => !animations[name].aliasOf).sort();
    assert.deepEqual(catalogNames, listed);
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
    assert.deepEqual(fadeGroup.variants.map(variant => variant.color), [
        'red', 'orange', 'amber', 'yellow', 'green', 'blue', 'cyan', 'purple', 'pink', 'white'
    ]);
    assert.equal(fadeGroup.variants.find(v => v.color === 'red').tier, 'legacy');
    assert.equal(fadeGroup.variants.find(v => v.color === 'blue').tier, 'rgb');

    const legacyCatalog = buildAnimationCatalog(animations, 'legacy');
    const legacyFade = legacyCatalog.find(group => group.id === 'fade');
    assert.ok(legacyFade);
    assert.deepEqual(legacyFade.variants.map(variant => variant.color), ['red', 'orange', 'amber', 'yellow', 'green']);
    assert.ok(legacyFade.variants.every(variant => variant.tier === 'legacy'));

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

test('firework and hearts come in every colour; their former names stay playable but unlisted', () => {
    const catalog = buildAnimationCatalog(animations);
    const group = id => catalog.find(g => g.id === id);
    const allColours = ['red', 'orange', 'amber', 'yellow', 'green', 'blue', 'cyan', 'purple', 'pink', 'white'];
    for (const id of ['heart_fill', 'heart_simple', 'heart_wave']) {
        assert.deepEqual(group(id).variants.map(v => v.color), allColours, id);
        assert.equal(animations[id].aliasOf, `${id}_red`, 'the former red-only name is an alias');
        assert.equal(typeof animations[id].on, 'function', 'and still plays');
    }
    const firework = group('firework').variants;
    assert.equal(firework.length, 11, 'the random multicolour firework plus one per colour');
    assert.deepEqual(firework.find(v => v.animation === 'firework').swatchColors, ['red', 'amber', 'green']);
    assert.equal(firework.find(v => v.color === 'blue').tier, 'rgb');

    for (const [name, anim] of Object.entries(animations)) {
        if (anim.aliasOf) assert.ok(animations[anim.aliasOf], `${name} -> ${anim.aliasOf} exists`);
    }
});
