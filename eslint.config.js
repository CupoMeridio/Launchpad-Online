import globals from 'globals';

const unusedVarsRule = [
    'error',
    {
        args: 'all',
        argsIgnorePattern: '^_',
        vars: 'all',
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_'
    }
];

export default [
    {
        ignores: [
            'js/vendor/**',
            'node_modules/**',
            'temp_*.js'
        ]
    },
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                AudioContext: 'readonly',
                webkitAudioContext: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': unusedVarsRule,
            // Diagnostics go through js/logger.js (debug flag, single sink).
            'no-console': 'error',
            // Structural limits. Existing offenders carry an inline
            // `eslint-disable-next-line ... -- Known debt` directive; unused
            // directives are reported, so fixing one forces removing its waiver.
            complexity: ['error', 15],
            'max-depth': ['error', 4],
            'max-params': ['error', 5]
        }
    },
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error'
        }
    },
    {
        files: ['js/logger.js'],
        rules: {
            'no-console': 'off'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': unusedVarsRule
        }
    },
    {
        files: ['service-worker.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.serviceworker
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': unusedVarsRule
        }
    }
];
