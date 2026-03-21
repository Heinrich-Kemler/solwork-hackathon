export const JOB_CATEGORIES = [
  "Development",
  "Design",
  "Marketing",
  "Writing",
  "Video/Media",
  "Research",
  "Data",
  "Other",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

/**
 * Extract metadata (category + skills) from job description.
 * We store them as a JSON suffix: \n---\n{"category":"...","skills":["..."]}
 */
export interface JobMeta {
  category: JobCategory | "";
  skills: string[];
}

export function encodeJobMeta(
  description: string,
  meta: JobMeta
): string {
  if (!meta.category && meta.skills.length === 0) return description;
  return `${description}\n---\n${JSON.stringify(meta)}`;
}

export function decodeJobMeta(description: string): {
  cleanDescription: string;
  meta: JobMeta;
} {
  const sep = "\n---\n";
  const idx = description.lastIndexOf(sep);
  if (idx === -1) {
    return { cleanDescription: description, meta: { category: "", skills: [] } };
  }
  const clean = description.slice(0, idx);
  try {
    const meta = JSON.parse(description.slice(idx + sep.length));
    return {
      cleanDescription: clean,
      meta: {
        category: meta.category || "",
        skills: Array.isArray(meta.skills) ? meta.skills : [],
      },
    };
  } catch {
    return { cleanDescription: description, meta: { category: "", skills: [] } };
  }
}
