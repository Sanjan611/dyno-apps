"use client";

import { Copy } from "lucide-react";

export default function CodeViewer() {
  const sampleCode = `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Your App</Text>
      <Text style={styles.subtitle}>
        Built with Dyno Apps
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
});`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleCode);
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">App.tsx</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm font-mono">
          <code className="text-gray-300">{sampleCode}</code>
        </pre>
      </div>
    </div>
  );
}
