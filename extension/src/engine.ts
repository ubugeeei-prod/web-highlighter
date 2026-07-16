import { analyze } from "./analyzer.ts";
import { detectLanguage } from "./detection.ts";
import { registerNavigation } from "./navigation.ts";
import type { CompiledLanguage, ThemeSpec } from "./plugin-api.ts";
import { applyTheme, renderSurface } from "./renderer.ts";
import { discoverSurfaces } from "./surfaces.ts";

const MAX_SOURCE_LENGTH = 2_000_000;
const MAX_SURFACES_PER_PASS = 48;

function fingerprint(source: string, language: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${language}:${source.length}:${hash >>> 0}`;
}

export interface EngineOptions {
  readonly document: Document;
  readonly languages: readonly CompiledLanguage[];
  readonly theme: Readonly<ThemeSpec>;
}

/** Incremental DOM coordinator. The MoonBit analyzer itself remains DOM-free. */
export class HighlighterEngine {
  readonly #document: Document;
  readonly #languages: readonly CompiledLanguage[];
  readonly #fingerprints = new WeakMap<HTMLElement, string>();
  #observer: MutationObserver | undefined;
  #scheduled = false;

  constructor(options: EngineOptions) {
    this.#document = options.document;
    this.#languages = options.languages;
    applyTheme(options.document, options.theme);
  }

  highlight(root: ParentNode = this.#document): number {
    let count = 0;
    for (const surface of discoverSurfaces(this.#document, root).slice(0, MAX_SURFACES_PER_PASS)) {
      if (surface.source.length > MAX_SOURCE_LENGTH) continue;
      const language = detectLanguage(this.#languages, {
        source: surface.source,
        ...(surface.languageHint ? { languageHint: surface.languageHint } : {}),
        ...(surface.filename ? { filename: surface.filename } : {}),
      });
      if (!language) continue;
      const nextFingerprint = fingerprint(surface.source, language.id);
      if (this.#fingerprints.get(surface.key) === nextFingerprint) continue;
      const result = analyze(language, surface.source);
      renderSurface(surface, result, language.id);
      registerNavigation(surface, result);
      this.#fingerprints.set(surface.key, nextFingerprint);
      count += 1;
    }
    return count;
  }

  start(): void {
    if (this.#observer) return;
    this.highlight();
    this.#observer = new MutationObserver(() => this.#schedule());
    this.#observer.observe(this.#document.documentElement, { childList: true, characterData: true, subtree: true });
  }

  stop(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    const run = () => {
      this.#scheduled = false;
      this.highlight();
    };
    if ("requestIdleCallback" in globalThis) globalThis.requestIdleCallback(run, { timeout: 120 });
    else setTimeout(run, 16);
  }
}
