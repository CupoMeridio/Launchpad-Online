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
            'no-unused-vars': unusedVarsRule
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
