import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeNames = ['de', 'en', 'es', 'fr', 'it'];

test('all supported locales define the same translation keys', () => {
    const canonicalKeys = Object.keys(JSON.parse(readFileSync(path.join(workspaceRoot, 'locales/it.json'), 'utf8'))).sort();

    for (const localeName of localeNames.filter(name => name !== 'it')) {
        const locale = JSON.parse(readFileSync(path.join(workspaceRoot, `locales/${localeName}.json`), 'utf8'));
        assert.deepEqual(Object.keys(locale).sort(), canonicalKeys, `${localeName} has inconsistent translation keys`);
    }
});
test('supported languages, locale files and the language menu agree', async () => {
    const { SUPPORTED_LANGUAGES } = await import('../js/i18n.js');
    const files = readdirSync(path.join(workspaceRoot, 'locales')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    const html = readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
    const select = html.match(/<select id="language-select">([\s\S]*?)<\/select>/)[1];
    const options = [...select.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);

    assert.deepEqual([...SUPPORTED_LANGUAGES].sort(), files.sort(), 'every supported language has a locale file');
    assert.deepEqual([...SUPPORTED_LANGUAGES].sort(), [...options].sort(), 'every supported language is in the menu');
});
