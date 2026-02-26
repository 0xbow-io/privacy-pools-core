import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true, // Use Vitest's global API without importing it in each file
        environment: "node", // Use the Node.js environment
        include: ["test/**/*.spec.ts"], // Include test files
        exclude: ["node_modules", "dist"], // Exclude certain directories
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"], // Coverage reporters
            exclude: [".rollup.cache", "node_modules", "dist", "src/index.ts", ...configDefaults.exclude], // Files to exclude from coverage
        },
        globalSetup: [
            './test/unit/serve-artifacts.ts',
        ],
    },
    resolve: {
        alias: {
            // Setup path alias based on tsconfig paths
            "@": path.resolve(__dirname, "src"),
        },
    },
});
