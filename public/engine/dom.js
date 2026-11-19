/** Escape text for safe interpolation into HTML. */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Normalise a typed answer before comparison. Carried over from BandUp v1 so
 * previously-accepted answers keep being accepted: case, currency symbols,
 * thousands separators, articles, punctuation and a trailing full stop are
 * all ignored.
 */
export const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[$£,]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[^a-z0-9.:]/g, "")
    .replace(/\.$/, "");
