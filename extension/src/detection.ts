import type { CompiledLanguage } from "./plugin-api.ts";

export interface DetectionInput {
  readonly languageHint?: string;
  readonly filename?: string;
  readonly source: string;
}

function basename(path: string): string {
  return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
}

/**
 * Chooses a language deterministically: explicit hint, filename, then literals.
 *
 * Signature detection requires a score of two. A lone common keyword can never
 * recolor an unlabelled block, which is important on prose-heavy chat pages.
 */
export function detectLanguage(
  languages: readonly CompiledLanguage[],
  input: DetectionInput,
): CompiledLanguage | undefined {
  const hint = input.languageHint?.trim().toLowerCase().replace(/^language-/u, "");
  if (hint) {
    const explicit = languages.find((language) => language.aliases.includes(hint));
    if (explicit) return explicit;
  }
  if (input.filename) {
    const name = basename(input.filename);
    const lower = name.toLowerCase();
    const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
    const exact = languages.find(
      (language) => language.filenames.includes(name) || language.extensions.includes(extension),
    );
    if (exact) return exact;
  }
  let best: CompiledLanguage | undefined;
  let bestScore = 1;
  for (const language of languages) {
    let score = 0;
    for (const signature of language.signatures) {
      if (input.source.includes(signature.text)) score += signature.weight;
    }
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  }
  return best;
}
