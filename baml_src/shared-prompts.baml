// These template_string sections can be referenced in agent prompts to avoid duplication

template_string ProjectContext #"
  # Project Context
  Dyno Apps is designed to build cross-platform mobile apps using:
  - **React Native**: The JavaScript framework for building native mobile applications
  - **Expo**: A framework and platform for React Native that simplifies development with built-in tools and services
  - **TypeScript**: For type-safe code (when applicable)
  - **Production-Ready Standards**: Follow best practices for scalable, maintainable code
"#

template_string EnvironmentContext(working_dir: string) #"
  # Environment Context
  Current working directory: {{ working_dir }}
  
  **IMPORTANT: All file operations must use absolute paths starting with {{ working_dir }}. Do NOT explore the root directory or any directories outside of {{ working_dir }}.**
"#

template_string ExpoBestPractices #"
  # React Native/Expo Best Practices

  ## Folder Structure (Based on Expo Best Practices)
  Follow these organizational patterns for React Native/Expo projects:

  - **src/ folder**: Separate app code from config files. Place the main app folder at `/src/app` or `/src` root instead of project root for better organization
  - **components/ folder**: Reusable components outside the app directory (since file-based routing limits what can go in /app)
    - Each component should have one named export
    - Filename matches component name (PascalCase, e.g., `Button.tsx` exports `Button`)
    - For complex components, use a folder with `index.tsx` as the main file (e.g., `components/Table/index.tsx`)
  - **screens/ folder**: Screen-level components for larger apps that need separation from route files
  - **utils/ folder**: Standalone utilities (date formatters, currency converters, data transformers)
  - **hooks/ folder**: Reusable custom React hooks (e.g., `useAuth`, `useFetch`)
  - **server/ folder**: Server-side utilities and API route helpers (separate from client code)
  - **Platform-specific code**: Use file extensions for platform variants:
    - `.web.tsx` / `.web.ts` - Web-specific implementations
    - `.native.tsx` / `.native.ts` - Native (iOS/Android) implementations
    - `.ios.tsx` / `.ios.ts` - iOS-specific implementations
    - `.android.tsx` / `.android.ts` - Android-specific implementations
    - Always provide a default version without platform extension as fallback
    - Platform-specific components must have identical props interface

  ## Component Structure Guidelines

  - **Functional Components**: Always use functional components with hooks, never class components
  - **TypeScript Types**: Define props using TypeScript interfaces (e.g., `interface ButtonProps { label: string }`)
  - **Named Exports**: Use named exports matching the component name (e.g., `export function Button() {}`)
  - **File Naming**: PascalCase for component files (e.g., `Button.tsx`, `UserProfile.tsx`)
  - **Style Organization**: Keep `StyleSheet.create()` at the bottom of component files, not in separate files. This is a modern best practice that makes styles easier to see and work with.
  - **Import Ordering**: Organize imports in this order:
    1. React and React Native imports
    2. Third-party library imports
    3. Local component imports
    4. Utility/hook imports
    5. Type imports (if separate)
"#

template_string ComponentExamples #"
  ## Code Examples

  ### Basic Component Example
  ```tsx
  import React from 'react';
  import { View, Text, StyleSheet } from 'react-native';

  interface WelcomeProps {
    name: string;
  }

  export function Welcome({ name }: WelcomeProps) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Welcome, {name}!</Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    text: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
    },
  });
  ```

  ### Recommended Folder Structure:
  ```
  src/
    app/              # Expo Router routes (file-based routing)
    components/       # Reusable components
    screens/          # Screen-level components
    utils/            # Utility functions
    hooks/            # Custom hooks
    server/           # Server-side utilities
  ```
"#

template_string PlatformSpecificExample #"
  ### Component with Platform-Specific Code Example
  ```tsx
  // Button.tsx (default)
  import React from 'react';
  import { TouchableOpacity, Text, StyleSheet } from 'react-native';

  interface ButtonProps {
    label: string;
    onPress: () => void;
  }

  export function Button({ label, onPress }: ButtonProps) {
    return (
      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Text style={styles.text}>{label}</Text>
      </TouchableOpacity>
    );
  }

  const styles = StyleSheet.create({
    button: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#007AFF',
    },
    text: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
  ```

  ```tsx
  // Button.web.tsx (web-specific)
  import React from 'react';
  import { TouchableOpacity, Text, StyleSheet } from 'react-native';

  interface ButtonProps {
    label: string;
    onPress: () => void;
  }

  export function Button({ label, onPress }: ButtonProps) {
    return (
      <TouchableOpacity 
        style={styles.button} 
        onPress={onPress}
        accessibilityRole="button"
      >
        <Text style={styles.text}>{label}</Text>
      </TouchableOpacity>
    );
  }

  const styles = StyleSheet.create({
    button: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#007AFF',
      cursor: 'pointer',
    },
    text: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
  ```
"#

template_string CodeQualityRules #"
  ## Code Quality Rules

  - **Never use class components** - Always use functional components
  - **Always define TypeScript interfaces** for component props
  - **Always place StyleSheet.create() at the bottom** of the file, after the component
  - **Use Platform.select()** for simple platform differences (e.g., different padding values)
  - **Use platform-specific files** only when implementations are completely different
  - **Keep components focused** - Split large components into smaller, reusable pieces
  - **Use meaningful variable names** - Follow React Native/Expo naming conventions
  - **Handle errors gracefully** - Use try/catch for async operations, provide fallbacks

  ## Lint Error Handling (CRITICAL)

  - **ALWAYS fix lint errors before proceeding** - After writing a file, lint check results will be included in the response
  - **Read lint results carefully** - The lint output will show ESLint errors and warnings with file paths, line numbers, and specific issues
  - **Fix lint errors immediately** - If lint errors are reported for a file you just wrote, you MUST fix them before:
    - Moving to the next todo item
    - Writing other files
    - Marking the current todo as completed
  - **Do NOT write the same file repeatedly** - If you see lint errors, read the file first to see what's wrong, then fix it in a single write operation
  - **Address all lint errors** - Both ESLint errors and warnings should be addressed. Errors are critical and must be fixed, warnings should be fixed when possible
  - **Verify fixes** - After fixing lint errors, the next lint check should show no errors for that file. If errors persist, re-read the file and fix the remaining issues
  - **If lint errors persist after multiple attempts**, read the file to understand the current state, then make a comprehensive fix addressing all reported issues at once
"#
