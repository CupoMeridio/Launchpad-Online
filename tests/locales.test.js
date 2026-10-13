import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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