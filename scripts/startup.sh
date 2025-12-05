#!/bin/bash
# Don't use set -e here, we want to handle errors gracefully

# Timestamp logging helper
log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

# Parse command line arguments
SKIP_INIT=false
if [ "$1" = "--skip-init" ]; then
  SKIP_INIT=true
elif [ "$1" = "--init" ]; then
  SKIP_INIT=false
fi

log "=== Starting Expo initialization ==="
log "Skip init mode: $SKIP_INIT"
log "EXPO_TUNNEL_SUBDOMAIN: ${EXPO_TUNNEL_SUBDOMAIN:-not set}"

# Verify Node.js and Bun installation
log "Checking Node.js and Bun..."
node --version || { log "ERROR: Node.js not found"; exit 1; }
bun --version || { log "ERROR: Bun not found"; exit 1; }

# Navigate to app directory (volume mount point)
log "Navigating to app directory (/my-app)..."
cd /my-app || { log "ERROR: Failed to navigate to /my-app directory"; exit 1; }

# Create new Expo app only if not skipping init
if [ "$SKIP_INIT" = false ]; then
  log "Creating Expo app in /my-app..."
  bun create expo-app@latest . --template blank --yes || { log "ERROR: Failed to create Expo app"; exit 1; }
else
  log "Skipping Expo app creation (using existing code in volume)"
fi

# Install required dependencies for web support
# Note: @expo/ngrok is installed globally in the Docker image via npm
log "Installing web dependencies (react-dom, react-native-web)..."
bunx expo install react-dom react-native-web || { log "ERROR: Failed to install web dependencies"; exit 1; }

# Start Expo web server on port 19006 with tunnel in the background using nohup
# This ensures Expo continues running even after the script exits
# We start Expo first so the sandbox is ready faster, then install linting tools in parallel
# Note: EXPO_TUNNEL_SUBDOMAIN is set as a sandbox environment variable at creation time
log "Starting Expo web server on port 19006 with tunnel..."
nohup bunx expo start --web --port 19006 --tunnel > /tmp/expo.log 2>&1 &
EXPO_PID=$!

log "Expo process started with PID: $EXPO_PID"

# Create ESLint configuration (flat config format for ESLint v9+)
# Note: ESLint and Prettier are pre-installed globally in the Docker image
log "Creating ESLint configuration..."
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
log "Creating Prettier configuration..."
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
log "Creating Prettier ignore file..."
cat > .prettierignore << 'EOF'
node_modules
.expo
.expo-shared
dist
build
*.log
EOF

log "=== Startup script completed ==="
exit 0

