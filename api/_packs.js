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

/**
 * Vercel traces static imports, but not files read at runtime by a computed
 * path, so public/content/** is bundled with this function through
 * `includeFiles` in vercel.json. If that is ever dropped, every exam lookup
 * fails and the route would otherwise answer "Unknown exam." — which reads
 * like bad input rather than a broken deployment. This turns it into a loud,
 * accurate error instead.
 */
export function assertContentDeployed() {
  try {
    readFileSync(join(CONTENT, "index.json"), "utf8");
  } catch {
    throw Object.assign(
      new Error("practice content missing from the function bundle"),
      { status: 500, msg: "The site is misconfigured: its practice content was not deployed with the API." }
    );
  }
}
