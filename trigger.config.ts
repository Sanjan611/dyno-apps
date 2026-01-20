import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID!,
  dirs: ["./trigger"],
  maxDuration: 3600, // 1 hour max - coding agent can run for extended periods
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1, // We handle retries internally via BAML
    },
  },
  build: {
    // BAML uses native bindings that conflict with esbuild bundling
    external: ["@boundaryml/baml"],
  },
});
