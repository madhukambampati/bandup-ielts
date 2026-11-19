// Server-side pack loader. Reads the very same files the browser fetches, so
// there is one source of truth for practice content and no "keep in sync" step.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRegistry } from "../public/engine/registry.js";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "content");

export const registry = createRegistry({
  load: async (path) => JSON.parse(readFileSync(join(CONTENT, path), "utf8")),
});
