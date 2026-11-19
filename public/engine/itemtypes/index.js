// The item-type registry. A new interaction is one module added here, and every
// existing exam is untouched.
import * as gapFill from "./gap-fill.js";
import * as tfng from "./tfng.js";
import * as mcqSingle from "./mcq-single.js";

const MODULES = [gapFill, tfng, mcqSingle];

export const types = new Map(MODULES.map((m) => [m.type, m]));

export function get(type) {
  const m = types.get(type);
  if (!m) throw new Error(`Unknown item type "${type}". Register a module in engine/itemtypes/index.js.`);
  return m;
}

export const known = () => [...types.keys()].sort();
