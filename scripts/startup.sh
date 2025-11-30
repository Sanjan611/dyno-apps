#!/bin/bash
# Don't use set -e here, we want to handle errors gracefully

echo "=== Starting Expo initialization ==="

# Verify Node.js/npm installation
echo "Checking Node.js and npm..."
node --version || { echo "ERROR: Node.js not found"; exit 1; }
npm --version || { echo "ERROR: npm not found"; exit 1; }

# Install Expo CLI globally
echo "Installing Expo CLI..."
npm install -g @expo/cli || { echo "ERROR: Failed to install Expo CLI"; exit 1; }

# Create new Expo app with blank template (non-interactive)
echo "Creating Expo app..."
npx create-expo-app@latest my-app --template blank --yes || { echo "ERROR: Failed to create Expo app"; exit 1; }

# Navigate to app directory
echo "Navigating to app directory..."
cd my-app || { echo "ERROR: Failed to navigate to app directory"; exit 1; }

# Install required dependencies for web support
echo "Installing web dependencies (react-dom, react-native-web)..."
npx expo install react-dom react-native-web || { echo "ERROR: Failed to install web dependencies"; exit 1; }

# Start Expo web server on port 19006 in the background using nohup
# This ensures Expo continues running even after the script exits
# We start Expo first so the sandbox is ready faster, then install linting tools in parallel
echo "Starting Expo web server on port 19006..."
nohup npx expo start --web --port 19006 > /tmp/expo.log 2>&1 &
EXPO_PID=$!

echo "Expo process started with PID: $EXPO_PID"

# Install ESLint and Prettier for code quality checks (in parallel with Expo startup)
echo "Installing ESLint and Prettier..."
npm install --save-dev eslint @eslint/js prettier eslint-config-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-native || { echo "ERROR: Failed to install linting tools"; exit 1; }

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

# Wait a bit to ensure Expo starts
echo "Waiting for Expo to initialize..."
sleep 15

# Verify Expo is still running
if ps -p $EXPO_PID > /dev/null 2>&1; then
  echo "✓ Expo server is running (PID: $EXPO_PID)"
else
  echo "✗ WARNING: Expo process may have exited"
  echo "Checking expo.log for errors:"
  tail -20 /tmp/expo.log || echo "Could not read expo.log"
fi

# Check if port 19006 is listening
echo "Checking if port 19006 is listening..."
if command -v ss > /dev/null; then
  ss -tlnp | grep 19006 || echo "Port 19006 not found in ss output"
elif command -v netstat > /dev/null; then
  netstat -tlnp | grep 19006 || echo "Port 19006 not found in netstat output"
fi

echo "=== Expo initialization script completed ==="
echo "Expo should be running in the background. Check /tmp/expo.log for details."

# Exit the script - Expo will continue running in the background
exit 0

