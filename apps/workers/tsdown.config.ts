import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  // Workspace packages ship raw TypeScript (their `exports` point at ./src/*.ts),
  // so they have to be bundled rather than left as external imports.
  deps: {
    alwaysBundle: [/@trumpet-pods\/.*/u],
  },
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
});
