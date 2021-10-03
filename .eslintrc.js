module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    "env": {
        "es6": true,
        "jest": true,
        "node": true
    },
    "parserOptions": {
        "ecmaVersion": 2019,
        "sourceType": "module"
    },
    "extends": [
        "eslint:recommended",
        "plugin:jest/recommended",
        "plugin:import/recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "rules": {
        "arrow-body-style": [
            "error",
            "always"
        ],
        "curly": "error",
        "import/order": [
            "error",
            {
                "newlines-between": "always"
            }
        ]
    },
    "settings": {
        "import/extensions": [
            ".ts"
        ],
        "import/resolver": {
            "node": {
                "extensions": [
                    ".ts"
                ]
            }
        }
    }
};