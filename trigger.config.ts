import { defineConfig } from "@trigger.dev/sdk/v3";
import { syncVercelEnvVars } from "@trigger.dev/build/extensions/core";
import { execSync } from "child_process";

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
    extensions: [
      syncVercelEnvVars(),
      // Generate BAML client before build
      {
        name: "baml-generate",
        onBuildStart: async (context) => {
          if (context.target === "deploy") {
            console.log("Generating BAML client...");
            execSync("npx baml generate", { stdio: "inherit" });
            console.log("BAML client generated successfully");
          }
        },
      },
    ],
  },
});
