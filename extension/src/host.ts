/** The deliberately small browser boundary around the MoonBit/Wasm engine. */
export interface Analyzer {
  analyze_request(source: string, hint: string, filename: string): Promise<string> | string;
  theme_wire(theme: string, dark: boolean): Promise<string> | string;
}

interface Segment {
  element: HTMLElement;
  text: string;
  start: number;
  end: number;
}
interface Surface {
  key: HTMLElement;
  source: string;
  segments: Segment[];
  hint: string;
  filename: string;
}
interface Token {
  start: number;
  end: number;
  scope: string;
}
interface Definition {
  start: number;
  end: number;
  kind: string;
  line: number;
  name: string;
}
interface Reference {
  start: number;
  end: number;
  name: string;
}
interface Analysis {
  language: string;
  tokens: Token[];
  definitions: Definition[];
  references: Reference[];
}

const MAX_SOURCE = 2_000_000;
const MAX_SURFACES = 48;
const languageClass = /(?:^|\s)(?:language|lang)-([\w+.#-]+)/iu;

function hintOf(element: HTMLElement): string {
  const direct =
    element.dataset.language ?? element.dataset.codeLanguage ?? element.getAttribute("data-lang");
  if (direct) return direct;
  return (
    element.className.match(languageClass)?.[1] ??
    element.closest<HTMLElement>("[data-language], [data-code-language]")?.dataset.language ??
    ""
  );
}

function filenameOf(document: Document): string {
  const labelled = document
    .querySelector<HTMLElement>(
      '[data-testid="breadcrumbs-filename"], [data-testid="breadcrumb-filename"], .final-path',
    )
    ?.textContent?.trim();
  if (labelled) return labelled.replace(/^\/+/, "");
  const path = document.location.pathname;
  const marker = path.indexOf("/blob/");
  if (marker < 0) return "";
  const tail = path.slice(marker + 6);
  try {
    return decodeURIComponent(tail.slice(tail.lastIndexOf("/") + 1));
  } catch {
    return tail;
  }
}

function makeSurface(elements: HTMLElement[], filename = ""): Surface | undefined {
  if (!elements.length) return undefined;
  const segments: Segment[] = [];
  let source = "";
  for (const [index, element] of elements.entries()) {
    const text = element.dataset.whSource ?? element.textContent ?? "";
    const start = source.length;
    source += text;
    segments.push({ element, text, start, end: source.length });
    if (index + 1 < elements.length) source += "\n";
  }
  const key = elements[0];
  if (!key || !source.trim()) return undefined;
  return { key, source, segments, hint: elements.map(hintOf).find(Boolean) ?? "", filename };
}

/** Finds code-bearing DOM only; language policy stays inside MoonBit. */
export function discoverSurfaces(document: Document): Surface[] {
  if (document.location.hostname === "github.com") {
    for (const selector of [
      '[data-testid="code-cell"]',
      "td.blob-code",
      ".react-code-line-contents",
    ]) {
      const lines = [...document.querySelectorAll<HTMLElement>(selector)].filter(
        (line) => !line.closest("pre"),
      );
      const surface = makeSurface(lines, filenameOf(document));
      if (surface) return [surface, ...genericSurfaces(document)];
    }
  }
  return genericSurfaces(document);
}

function genericSurfaces(root: ParentNode): Surface[] {
  const result: Surface[] = [];
  const seen = new Set<HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>(
    "pre > code, pre[data-language], pre[data-code-language]",
  )) {
    const target =
      element.tagName === "CODE"
        ? element
        : (element.querySelector<HTMLElement>(":scope > code") ?? element);
    if (seen.has(target)) continue;
    seen.add(target);
    const surface = makeSurface([target]);
    if (surface) result.push(surface);
  }
  return result;
}

/** Decodes the compact line protocol emitted by MoonBit without a JSON runtime. */
export function decodeAnalysis(wire: string, source: string): Analysis | undefined {
  if (!wire) return undefined;
  const analysis: Analysis = { language: "", tokens: [], definitions: [], references: [] };
  for (const line of wire.split("\n")) {
    const [tag, a = "", b = "", c = "", d = ""] = line.split("\t");
    if (tag === "L") analysis.language = a;
    else if (tag === "T") analysis.tokens.push({ start: +a, end: +b, scope: c });
    else if (tag === "D")
      analysis.definitions.push({
        start: +a,
        end: +b,
        kind: c,
        line: +d,
        name: source.slice(+a, +b),
      });
    else if (tag === "R") analysis.references.push({ start: +a, end: +b, name: c });
  }
  return analysis.language ? analysis : undefined;
}

function hash(source: string, language: string): string {
  let value = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1)
    value = Math.imul(value ^ source.charCodeAt(index), 16_777_619);
  return `${language}:${source.length}:${value >>> 0}`;
}

/** Coordinates incremental DOM injection; parsing and language selection are Wasm-owned. */
export class BrowserHost {
  readonly #fingerprints = new WeakMap<HTMLElement, string>();
  readonly #entries = new WeakMap<HTMLElement, { surface: Surface; analysis: Analysis }>();
  #observer: MutationObserver | undefined;
  #scheduled = false;
  #highlighting: Promise<number> | undefined;
  #rerun = false;

  constructor(
    readonly document: Document,
    readonly analyzer: Analyzer,
  ) {
    this.#installNavigation();
  }

  async applyTheme(theme: string, dark: boolean): Promise<void> {
    for (const line of (await this.analyzer.theme_wire(theme, dark)).split("\n")) {
      const [tag, name, color] = line.split("\t");
      if (tag === "M" && name) this.document.documentElement.dataset.whTheme = name;
      if (tag === "C" && name && color)
        this.document.documentElement.style.setProperty(`--wh-${name}`, color);
    }
  }

  highlight(): Promise<number> {
    if (this.#highlighting) {
      this.#rerun = true;
      return this.#highlighting;
    }
    const run = async () => {
      let count = 0;
      do {
        this.#rerun = false;
        count += await this.#highlightOnce();
      } while (this.#rerun);
      return count;
    };
    this.#highlighting = run().finally(() => {
      this.#highlighting = undefined;
    });
    return this.#highlighting;
  }

  async #highlightOnce(): Promise<number> {
    let count = 0;
    for (const surface of discoverSurfaces(this.document).slice(0, MAX_SURFACES)) {
      if (surface.source.length > MAX_SOURCE) continue;
      const analysis = decodeAnalysis(
        await this.analyzer.analyze_request(surface.source, surface.hint, surface.filename),
        surface.source,
      );
      if (!analysis) continue;
      const fingerprint = hash(surface.source, analysis.language);
      if (this.#fingerprints.get(surface.key) === fingerprint) continue;
      this.#render(surface, analysis);
      this.#fingerprints.set(surface.key, fingerprint);
      count += 1;
    }
    return count;
  }

  async start(): Promise<void> {
    if (this.#observer) return;
    this.#observer = new MutationObserver(() => this.#schedule());
    this.#observer.observe(this.document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    try {
      await this.highlight();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
  }

  #render(surface: Surface, analysis: Analysis): void {
    for (const segment of surface.segments) {
      const fragment = this.document.createDocumentFragment();
      const tokens = analysis.tokens.filter(
        (token) => token.end > segment.start && token.start < segment.end,
      );
      let cursor = segment.start;
      for (const token of tokens) {
        const start = Math.max(token.start, segment.start);
        const end = Math.min(token.end, segment.end);
        if (start > cursor)
          fragment.append(this.document.createTextNode(surface.source.slice(cursor, start)));
        const span = this.document.createElement("span");
        span.className = `wh-token wh-${token.scope}`;
        span.textContent = surface.source.slice(start, end);
        const definition = analysis.definitions.find(
          (item) => item.start === token.start && item.end === token.end,
        );
        const reference = analysis.references.find(
          (item) => item.start === token.start && item.end === token.end,
        );
        const symbol = definition?.name ?? reference?.name;
        if (symbol) {
          span.dataset.whSymbol = symbol;
          if (definition) {
            span.dataset.whDefinition = "true";
            span.dataset.whKind = definition.kind;
            span.dataset.whLine = String(definition.line);
          }
          if (reference) span.dataset.whReference = "true";
          span.tabIndex = 0;
        }
        fragment.append(span);
        cursor = end;
      }
      if (cursor < segment.end)
        fragment.append(this.document.createTextNode(surface.source.slice(cursor, segment.end)));
      segment.element.replaceChildren(fragment);
      segment.element.dataset.whSource = segment.text;
      segment.element.dataset.whSurface = "true";
      this.#entries.set(segment.element, { surface, analysis });
    }
    surface.key.dataset.whLanguage = analysis.language;
  }

  #entry(target: HTMLElement) {
    const segment = target.closest<HTMLElement>("[data-wh-surface]");
    return segment ? this.#entries.get(segment) : undefined;
  }

  #installNavigation(): void {
    this.document.addEventListener("pointerover", (event) => {
      const target =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>("[data-wh-symbol]")
          : null;
      const entry = target ? this.#entry(target) : undefined;
      const definition = entry?.analysis.definitions.find(
        (item) => item.name === target?.dataset.whSymbol,
      );
      if (!target || !definition) return;
      let tip = this.document.querySelector<HTMLElement>("#wh-tooltip");
      if (!tip) {
        tip = this.document.createElement("div");
        tip.id = "wh-tooltip";
        tip.className = "wh-tooltip";
        this.document.body.append(tip);
      }
      tip.textContent = `${definition.kind} ${definition.name} · line ${definition.line}`;
      const rect = target.getBoundingClientRect();
      tip.style.left = `${Math.max(8, rect.left)}px`;
      tip.style.top = `${rect.bottom + 6}px`;
      tip.hidden = false;
    });
    this.document.addEventListener("pointerout", () => {
      const tip = this.document.querySelector<HTMLElement>("#wh-tooltip");
      if (tip) tip.hidden = true;
    });
    const jump = (target: HTMLElement) => {
      const entry = this.#entry(target);
      const name = target.dataset.whSymbol;
      const definition = entry?.surface.segments
        .flatMap(({ element }) => [
          ...element.querySelectorAll<HTMLElement>('[data-wh-definition="true"]'),
        ])
        .find((item) => item.dataset.whSymbol === name);
      if (!definition) return;
      definition.scrollIntoView({ block: "center", behavior: "smooth" });
      definition.classList.remove("wh-jump-target");
      requestAnimationFrame(() => definition.classList.add("wh-jump-target"));
    };
    this.document.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement) {
        const target = event.target.closest<HTMLElement>("[data-wh-reference]");
        if (target) jump(target);
      }
    });
    this.document.addEventListener("keydown", (event) => {
      if (
        (event.key === "Enter" || event.key === " ") &&
        event.target instanceof HTMLElement &&
        event.target.matches("[data-wh-reference]")
      ) {
        event.preventDefault();
        jump(event.target);
      }
    });
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    const run = () => {
      this.#scheduled = false;
      void this.highlight().catch(() => undefined);
    };
    if ("requestIdleCallback" in globalThis) requestIdleCallback(run, { timeout: 120 });
    else setTimeout(run, 16);
  }
}
