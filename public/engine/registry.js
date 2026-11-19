// Loads exam packs. Environment-agnostic: the caller injects `load`, so the
// browser can fetch and the server can read from disk using the same code and
// the very same content files.

/** Turn a content id into its path under content/. */
export function pathOf(id, kind) {
  const parts = String(id).split("/");
  if (kind === "exam") return `exams/${parts[0]}/exam.json`;
  const [examId, ...rest] = parts;
  if (kind === "form") return `exams/${examId}/forms/${rest[rest.length - 1]}.json`;
  if (kind === "rubric") return `exams/${examId}/rubrics/${rest[rest.length - 1]}.json`;
  if (kind === "tips") return `exams/${examId}/tips/${rest[rest.length - 1]}.json`;
  if (kind === "learning") return `exams/${examId}/learning/${rest[rest.length - 1]}.json`;
  // items: <examId>/<skill>/<name>
  return `exams/${examId}/items/${rest.join("/")}.json`;
}

export function createRegistry({ load }) {
  const cache = new Map();
  const once = async (path) => {
    if (!cache.has(path)) cache.set(path, load(path));
    try { return await cache.get(path); }
    catch (e) { cache.delete(path); throw e; }
  };

  const api = {
    /** Every exam this build ships, in display order. */
    async exams() {
      const index = await once("index.json");
      const list = await Promise.all(index.exams.map((id) => api.exam(id)));
      return list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    },

    exam: (examId) => once(pathOf(examId, "exam")),
    item: (itemId) => once(pathOf(itemId, "item")),
    form: (formId) => once(pathOf(formId, "form")),
    tips: (examId, skill) => once(pathOf(`${examId}/${skill}`, "tips")),
    learning: (examId, name) => once(pathOf(`${examId}/${name}`, "learning")),
    rubric: (examId, name) => once(pathOf(`${examId}/${name}`, "rubric")),

    /** A section of an exam, by skill. */
    async section(examId, skill) {
      const exam = await api.exam(examId);
      const s = exam.sections.find((x) => x.skill === skill);
      if (!s) throw new Error(`${examId} has no ${skill} section`);
      return s;
    },

    /**
     * The exam whose items a section actually uses. IELTS General Training
     * shares Listening and Speaking with Academic, so this returns
     * "ielts-academic" for those and "ielts-general" for the rest.
     */
    async itemSourceOf(examId, skill) {
      const s = await api.section(examId, skill);
      return s.sharesItemsWith || examId;
    },

    /** Resolve a whole form into the item sets each section needs. */
    async loadForm(formId) {
      const form = await api.form(formId);
      const sections = await Promise.all(
        form.sections.map(async (s) => {
          if (s.set) return { ...s, set: await api.item(s.set) };
          if (s.tasks) return { ...s, tasks: await Promise.all(s.tasks.map((t) => api.item(t))) };
          return s;
        })
      );
      return { ...form, sections };
    },
  };

  return api;
}

/** Browser registry: fetches from the served content folder. */
export const browserRegistry = (base = "content/") =>
  createRegistry({
    load: async (path) => {
      const r = await fetch(base + path, { cache: "no-cache" });
      if (!r.ok) throw new Error(`content ${path}: HTTP ${r.status}`);
      return r.json();
    },
  });
