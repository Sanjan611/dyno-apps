// Coding agent for modifying React Native App.js files

// Output structure for the coding agent
class CodeGenerationResult {
  code string
}

// Client for Claude Sonnet 3.5
client<llm> ClaudeSonnet {
  provider anthropic
  options {
    model "claude-sonnet-4-5-20250929"
    api_key env.ANTHROPIC_API_KEY
  }
}

// Function to generate/modify App.js code based on user prompt
function GenerateAppJsCode(
  userPrompt: string,
  currentAppJs: string
) -> CodeGenerationResult {
  client ClaudeSonnet
  prompt #"
You are a React Native/Expo coding assistant. Your task is to modify the App.js file in a React Native Expo application based on user requirements.

Instructions:
- You will receive the current App.js code and a user prompt describing what changes to make
- Modify the App.js file according to the user's requirements
- Return the complete, valid React Native code for App.js in the required JSON format
- Ensure the code follows React Native best practices
- Maintain proper imports and component structure
- Use React Native components (View, Text, StyleSheet, etc.) and Expo APIs as needed
- Make sure the code is production-ready and follows React Native conventions
- The code should be returned as a string in the JSON response

Current App.js code:
```javascript
{{ currentAppJs }}
```

User requirements:
{{ userPrompt }}

Please provide the complete updated App.js code in the required JSON format:
  "#
}

// Test the coding agent with a simple prompt to create a basic app
test create_simple_app {
  functions [GenerateAppJsCode]
  args {
    userPrompt "Create a simple React Native app with a button that says 'Hello World'"
    currentAppJs #"
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
    "#
  }
}

