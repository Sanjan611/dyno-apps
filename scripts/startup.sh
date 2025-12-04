#!/bin/bash
# Don't use set -e here, we want to handle errors gracefully

# Parse command line arguments
SKIP_INIT=false
if [ "$1" = "--skip-init" ]; then
  SKIP_INIT=true
elif [ "$1" = "--init" ]; then
  SKIP_INIT=false
fi

echo "=== Starting Expo initialization ==="
echo "Skip init mode: $SKIP_INIT"

# Verify Node.js and Bun installation
echo "Checking Node.js and Bun..."
node --version || { echo "ERROR: Node.js not found"; exit 1; }
bun --version || { echo "ERROR: Bun not found"; exit 1; }

# Verify Expo CLI is available (pre-installed in image)
# Use bunx since we're not inside an Expo project yet
echo "Checking Expo CLI..."
bunx expo --version || { echo "ERROR: Expo CLI not found"; exit 1; }

# Navigate to app directory (volume mount point)
echo "Navigating to app directory (/my-app)..."
cd /my-app || { echo "ERROR: Failed to navigate to /my-app directory"; exit 1; }

# Create new Expo app only if not skipping init
if [ "$SKIP_INIT" = false ]; then
  echo "Creating Expo app in /my-app..."
  bun create expo-app@latest . --template blank --yes || { echo "ERROR: Failed to create Expo app"; exit 1; }
else
  echo "Skipping Expo app creation (using existing code in volume)"
fi

# Install required dependencies for web support
echo "Installing web dependencies (react-dom, react-native-web)..."
bunx expo install react-dom react-native-web || { echo "ERROR: Failed to install web dependencies"; exit 1; }

# Start Expo web server on port 19006 in the background using nohup
# This ensures Expo continues running even after the script exits
# We start Expo first so the sandbox is ready faster, then install linting tools in parallel
echo "Starting Expo web server on port 19006..."
nohup bunx expo start --web --port 19006 > /tmp/expo.log 2>&1 &
EXPO_PID=$!

echo "Expo process started with PID: $EXPO_PID"

# Install ESLint and Prettier for code quality checks (in parallel with Expo startup)
echo "Installing ESLint and Prettier..."
bun install --dev eslint @eslint/js prettier eslint-config-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-native || { echo "ERROR: Failed to install linting tools"; exit 1; }

# Create ESLint configuration (flat config format for ESLint v9+)
echo "Creating ESLint configuration..."
cat > eslint.config.mjs << 'EOF'
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  prettier,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'build/**'],
  },
];
EOF

# Create Prettier configuration
echo "Creating Prettier configuration..."
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
EOF

# Create Prettier ignore file
echo "Creating Prettier ignore file..."
cat > .prettierignore << 'EOF'
node_modules
.expo
.expo-shared
dist
build
*.log
EOF

exit 0

