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
/**
 * One analyzed surface plus the span indexes rendering needs.
 *
 * Symbol spans are identifier-aligned and never overlap, so a span start
 * identifies at most one symbol. Keying by start keeps the render loop free of
 * per-token key strings; the token end is confirmed on lookup.
 */
interface Analysis {
  language: string;
  tokens: Token[];
  definitions: Definition[];
  references: Reference[];
  definitionBySpan: Map<number, Definition>;
  referenceBySpan: Map<number, Reference>;
  definitionByName: Map<string, Definition>;
}
interface BrowserHostOptions {
  beforeHighlight?: () => Promise<void> | void;
}

const MAX_SOURCE = 2_000_000;
const MAX_SURFACES = 48;
const transientRetryDelays = [120, 300, 800, 1800, 3600, 7200] as const;
const startupScanDelays = [60, 180, 420, 900, 1800, 3600, 7200] as const;
const languageClass = /(?:^|\s)(?:language|lang)-([\w+.#-]+)/iu;
const languageAttributes = [
  "data-language",
  "data-code-language",
  "data-code-lang",
  "data-codeblock-language",
  "data-lang",
  "data-syntax",
];
const gitHubBlobLineSelectors = [
  '[data-testid="code-cell"]',
  ".react-code-line-contents",
  "td.blob-code.js-file-line",
];
const gitLabBlobLineSelectors = [
  'pre.code > code[data-testid="content"] + code > [id^="LC"].line',
  ".blob-content [id^='LC'].line",
  ".file-content [id^='LC'].line",
];
const gitLabDiffLineSelector = '[data-testid="diff-line-code"], .line_content';
const discordHosts = new Set(["discord.com", "canary.discord.com", "ptb.discord.com"]);
const discordCodeSelectors = [
  "pre code",
  '[class*="codeContainer"] code',
  '[class*="codeBlock"] code',
  '[class*="markup"] code.hljs',
];
const discordTextSelectors = [
  '[class*="codeBlockText"]',
  '[class*="codeBlockCode"]',
  '[class*="codeBlockSyntax"]',
];
const discordRecoveryEvents = ["click", "pointerup", "focusin", "keyup"] as const;
const discordRecoveryDelays = [0, 80, 240, 600, 1200, 2400] as const;
const ignoredLanguageClasses = new Set([
  "blob-code",
  "blob-code-addition",
  "blob-code-context",
  "blob-code-deletion",
  "blob-code-hunk",
  "blob-code-inner",
  "blob-code-marker",
  "code",
  "code-line",
  "hljs",
  "js-file-line",
  "line",
  "line_content",
  "nohighlight",
  "react-code-line-contents",
  "shiki",
  "wh-token",
]);

function classHint(value: string): string {
  const explicit = value.match(languageClass)?.[1];
  if (explicit) return explicit.toLowerCase();
  for (const token of value.split(/\s+/u)) {
    const normalized = token.trim().toLowerCase();
    if (/^[a-z][a-z0-9+.#-]{1,31}$/u.test(normalized) && !ignoredLanguageClasses.has(normalized))
      return normalized;
  }
  return "";
}

function metadataHint(element: HTMLElement): string {
  for (const attribute of languageAttributes) {
    const value = element.getAttribute(attribute)?.trim();
    if (value) return value;
  }
  return "";
}

function hintOf(element: HTMLElement): string {
  const direct = metadataHint(element) || classHint(element.className);
  if (direct) return direct;
  const container = element.closest<HTMLElement>(
    languageAttributes.map((attribute) => `[${attribute}]`).join(", "),
  );
  return container ? metadataHint(container) || classHint(container.className) : "";
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

function filenameFromContainer(container: HTMLElement): string {
  for (const attribute of ["data-file-path", "data-new-path", "data-path", "data-old-path"]) {
    const value = container.getAttribute(attribute)?.trim();
    if (value) return value;
  }
  const labelled = container
    .querySelector<HTMLElement>(
      '[data-testid="file-name"], [data-testid="file-title"], .file-title-name, .diff-file-changes .file-title-name',
    )
    ?.textContent?.trim();
  return labelled ?? "";
}

function gitHubCodeTarget(element: HTMLElement): HTMLElement {
  return element.querySelector<HTMLElement>(":scope > .blob-code-inner") ?? element;
}

function makeSurface(elements: HTMLElement[], filename = ""): Surface | undefined {
  if (!elements.length) return undefined;
  const segments: Segment[] = [];
  let source = "";
  for (const [index, element] of elements.entries()) {
    const text = element.textContent ?? "";
    const start = source.length;
    source += text;
    segments.push({ element, text, start, end: source.length });
    if (index + 1 < elements.length) source += "\n";
  }
  const key = elements[0];
  if (!key || !source.trim()) return undefined;
  return { key, source, segments, hint: elements.map(hintOf).find(Boolean) ?? "", filename };
}

function firstSurfaceBySelector(
  document: Document,
  selectors: readonly string[],
  filename: string,
  target = (element: HTMLElement) => element,
): Surface | undefined {
  for (const selector of selectors) {
    const seen = new Set<HTMLElement>();
    const lines = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((line) => !line.closest("pre"))
      .map(target)
      .filter((line) => {
        if (seen.has(line)) return false;
        seen.add(line);
        return true;
      });
    const surface = makeSurface(lines, filename);
    if (surface) return surface;
  }
  return undefined;
}

function gitHubBlobSurface(document: Document): Surface | undefined {
  if (!document.location.pathname.includes("/blob/")) return undefined;
  return firstSurfaceBySelector(
    document,
    gitHubBlobLineSelectors,
    filenameOf(document),
    gitHubCodeTarget,
  );
}

function gitHubDiffSurfaces(document: Document): Surface[] {
  const groups = new Map<HTMLElement, { filename: string; lines: HTMLElement[] }>();
  for (const cell of document.querySelectorAll<HTMLElement>("td.blob-code.js-file-line")) {
    if (cell.classList.contains("blob-code-hunk")) continue;
    const container = cell.closest<HTMLElement>("[data-file-path], [data-new-path], [data-path]");
    if (!container) continue;
    const target = gitHubCodeTarget(cell);
    const group = groups.get(container);
    if (group) {
      group.lines.push(target);
    } else {
      groups.set(container, { filename: filenameFromContainer(container), lines: [target] });
    }
  }
  return [...groups.values()]
    .map(({ filename, lines }) => makeSurface(lines, filename))
    .filter((surface): surface is Surface => Boolean(surface));
}

function gitLabBlobSurface(document: Document): Surface | undefined {
  if (!document.location.pathname.includes("/-/blob/")) return undefined;
  for (const selector of gitLabBlobLineSelectors) {
    const lines = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (line) => !line.matches('[data-testid="content"]'),
    );
    const surface = makeSurface(lines, filenameOf(document));
    if (surface) return surface;
  }
  return undefined;
}

function gitLabDiffSurfaces(document: Document): Surface[] {
  if (!document.location.pathname.includes("/diff")) return [];
  const groups = new Map<HTMLElement, { filename: string; lines: HTMLElement[] }>();
  for (const line of document.querySelectorAll<HTMLElement>(gitLabDiffLineSelector)) {
    const container = line.closest<HTMLElement>(
      "[data-file-path], [data-new-path], [data-path], [data-old-path], .diff-file, .file-holder",
    );
    if (!container) continue;
    const group = groups.get(container);
    if (group) {
      group.lines.push(line);
    } else {
      groups.set(container, { filename: filenameFromContainer(container), lines: [line] });
    }
  }
  return [...groups.values()]
    .map(({ filename, lines }) => makeSurface(lines, filename))
    .filter((surface): surface is Surface => Boolean(surface));
}

function discordSurfaces(document: Document): Surface[] {
  const result: Surface[] = [];
  const seen = new Set<HTMLElement>();
  for (const selector of [...discordCodeSelectors, ...discordTextSelectors]) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(element)) continue;
      if (element.tagName !== "CODE" && element.querySelector("code, button, [role='button']"))
        continue;
      seen.add(element);
      const block = element.closest<HTMLElement>(
        'pre, [class*="codeContainer"], [class*="codeBlock"]',
      );
      if (!block) continue;
      const text = element.textContent ?? "";
      if (!element.closest("pre") && !text.includes("\n") && text.length < 80) continue;
      const surface = makeSurface([element]);
      if (surface) result.push(surface);
    }
  }
  return result;
}

/** Finds code-bearing DOM only; language policy stays inside MoonBit. */
export function discoverSurfaces(document: Document): Surface[] {
  if (document.location.hostname === "github.com") {
    const blob = gitHubBlobSurface(document);
    if (blob) return [blob, ...genericSurfaces(document)];
    const diffs = gitHubDiffSurfaces(document);
    if (diffs.length > 0) return [...diffs, ...genericSurfaces(document)];
  }
  if (document.location.pathname.includes("/-/blob/")) {
    const surface = gitLabBlobSurface(document);
    if (surface) return [surface];
    return [];
  }
  if (discordHosts.has(document.location.hostname)) {
    const discord = discordSurfaces(document);
    if (discord.length > 0) return discord;
  }
  const gitLabDiffs = gitLabDiffSurfaces(document);
  if (gitLabDiffs.length > 0) return gitLabDiffs;
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

interface Rgb {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

function parseRgb(value: string): Rgb | undefined {
  const match = value.match(/rgba?\(([^)]+)\)/iu);
  if (!match) return undefined;
  const parts = match[1]!.split(",").map((part) => part.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const alpha = parts[3] === undefined ? 1 : Number(parts[3]);
  if ([r, g, b, alpha].some((part) => !Number.isFinite(part))) return undefined;
  return { r, g, b, alpha };
}

function relativeChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * relativeChannel(r) + 0.7152 * relativeChannel(g) + 0.0722 * relativeChannel(b);
}

function visibleBackground(element: HTMLElement): Rgb | undefined {
  const view = element.ownerDocument.defaultView;
  if (!view) return undefined;
  let current: HTMLElement | null = element;
  while (current) {
    const background = parseRgb(view.getComputedStyle(current).backgroundColor);
    if (background && background.alpha > 0.2) return background;
    current = current.parentElement;
  }
  return undefined;
}

function darkThemeHint(document: Document): boolean | undefined {
  const root = document.documentElement;
  const body = document.body;
  for (const element of [root, body]) {
    if (!element) continue;
    for (const attribute of [
      "data-theme",
      "data-color-mode",
      "data-bs-theme",
      "data-color-scheme",
    ]) {
      const value = element.getAttribute(attribute)?.trim().toLowerCase();
      if (value === "dark" || value === "dimmed") return true;
      if (value === "light") return false;
    }
  }
  const classText = `${root.className} ${body?.className ?? ""}`.toLowerCase();
  if (/(^|\s)(theme-dark|dark-theme|color-theme-dark|is-dark|dark)(\s|$)/u.test(classText))
    return true;
  if (/(^|\s)(theme-light|light-theme|color-theme-light|is-light|light)(\s|$)/u.test(classText))
    return false;
  const scheme = document.defaultView
    ?.getComputedStyle(root)
    .getPropertyValue("color-scheme")
    .trim()
    .toLowerCase()
    .split(/\s+/u)[0];
  if (scheme === "dark") return true;
  if (scheme === "light") return false;
  return undefined;
}

export function documentPrefersDark(document: Document, fallback: boolean): boolean {
  const hinted = darkThemeHint(document);
  if (hinted !== undefined) return hinted;
  for (const selector of [
    "html",
    '[data-testid="code-cell"]',
    "td.blob-code",
    "[id^='LC'].line",
    gitLabDiffLineSelector,
    "pre code",
    "pre",
    "body",
  ]) {
    const element = document.querySelector<HTMLElement>(selector);
    const background = element ? visibleBackground(element) : undefined;
    if (background) return luminance(background) < 0.28;
  }
  return fallback;
}

/** Decodes the compact line protocol emitted by MoonBit without a JSON runtime. */
export function decodeAnalysis(wire: string, source: string): Analysis | undefined {
  if (!wire) return undefined;
  const analysis: Analysis = {
    language: "",
    tokens: [],
    definitions: [],
    references: [],
    definitionBySpan: new Map(),
    referenceBySpan: new Map(),
    definitionByName: new Map(),
  };
  let cursor = 0;
  for (const line of wire.split("\n")) {
    const [tag, a = "", b = "", c = "", d = ""] = line.split("\t");
    if (tag === "L") analysis.language = a;
    else if (tag === "T") {
      const start = +a;
      const end = +b;
      // Rendering sweeps this list once, so keep the analyzer's own contract
      // (`ordered_span_after` in `src/proof`): spans stay ordered and non-empty
      // even if a plan ever arrives malformed.
      if (start >= cursor && start < end) {
        analysis.tokens.push({ start, end, scope: c });
        cursor = end;
      }
    } else if (tag === "D") {
      const definition = { start: +a, end: +b, kind: c, line: +d, name: source.slice(+a, +b) };
      analysis.definitions.push(definition);
      if (!analysis.definitionBySpan.has(definition.start))
        analysis.definitionBySpan.set(definition.start, definition);
      if (!analysis.definitionByName.has(definition.name))
        analysis.definitionByName.set(definition.name, definition);
    } else if (tag === "R") {
      const reference = { start: +a, end: +b, name: c };
      analysis.references.push(reference);
      if (!analysis.referenceBySpan.has(reference.start))
        analysis.referenceBySpan.set(reference.start, reference);
    }
  }
  return analysis.language ? analysis : undefined;
}

/** Resolves the symbol a token stands for without scanning the symbol tables. */
function symbolAt<Item extends { start: number; end: number }>(
  index: Map<number, Item>,
  token: Token,
): Item | undefined {
  const item = index.get(token.start);
  return item && item.end === token.end ? item : undefined;
}

/**
 * Pairs every segment with the half-open token range covering it.
 *
 * Tokens are ordered, non-empty, and non-overlapping by MoonBit contract, and
 * segments are built in source order, so both cursors only move forward. A
 * surface therefore costs segments plus tokens instead of one token scan per
 * line, which is what a large GitHub blob is made of.
 *
 * The two conditions are the executable predicates `span_precedes_segment` and
 * `span_follows_segment` in `src/proof`, where `skipped_token_cannot_cover`,
 * `stopped_token_cannot_cover`, `skipped_token_skips_its_prefix`, and
 * `stopped_token_stops_its_suffix` prove that skipping and stopping can never
 * drop a token that covers the segment.
 */
function* coveredTokens(
  segments: readonly Segment[],
  tokens: readonly Token[],
): Generator<{ segment: Segment; from: number; to: number }> {
  let from = 0;
  for (const segment of segments) {
    while (from < tokens.length && tokens[from]!.end <= segment.start) from += 1;
    let to = from;
    while (to < tokens.length && tokens[to]!.start < segment.end) to += 1;
    yield { segment, from, to };
  }
}

/** Finds the rendered definition of a symbol without materializing every span. */
function definitionElement(surface: Surface, name: string): HTMLElement | undefined {
  for (const { element } of surface.segments)
    for (const item of element.querySelectorAll<HTMLElement>('[data-wh-definition="true"]'))
      if (item.dataset.whSymbol === name) return item;
  return undefined;
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
  readonly #discordRecoveryListeners: Array<{
    type: (typeof discordRecoveryEvents)[number];
    listener: EventListener;
    options: AddEventListenerOptions;
  }> = [];
  readonly #timers: number[] = [];
  #observer: MutationObserver | undefined;
  #scheduled = false;
  #highlighting: Promise<number> | undefined;
  #transientRetries = 0;
  #rerun = false;

  constructor(
    readonly document: Document,
    readonly analyzer: Analyzer,
    readonly options: BrowserHostOptions = {},
  ) {
    this.#installNavigation();
    if (discordHosts.has(this.document.location.hostname)) this.#installDiscordRecovery();
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
    let sawTransientFailure = false;
    await this.#runBeforeHighlight();
    for (const surface of discoverSurfaces(this.document).slice(0, MAX_SURFACES)) {
      if (surface.source.length > MAX_SOURCE) continue;
      let wire = "";
      try {
        wire = await this.analyzer.analyze_request(surface.source, surface.hint, surface.filename);
      } catch {
        sawTransientFailure = true;
        continue;
      }
      const analysis = decodeAnalysis(wire, surface.source);
      if (!analysis) continue;
      const fingerprint = hash(surface.source, analysis.language);
      if (
        this.#fingerprints.get(surface.key) === fingerprint &&
        this.#renderedSurfaceIsIntact(surface, analysis)
      )
        continue;
      this.#render(surface, analysis);
      this.#fingerprints.set(surface.key, fingerprint);
      count += 1;
    }
    if (sawTransientFailure) this.#scheduleTransientRetry();
    else this.#transientRetries = 0;
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
    for (const delay of startupScanDelays) this.#setTimer(delay, () => this.#schedule());
    await this.highlight().catch(() => undefined);
  }

  stop(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    for (const { type, listener, options } of this.#discordRecoveryListeners)
      this.document.removeEventListener(type, listener, options);
    this.#discordRecoveryListeners.length = 0;
    const view = this.document.defaultView;
    if (view) {
      for (const timer of this.#timers) view.clearTimeout(timer);
    }
    this.#timers.length = 0;
  }

  #render(surface: Surface, analysis: Analysis): void {
    for (const { segment, from, to } of coveredTokens(surface.segments, analysis.tokens)) {
      const fragment = this.document.createDocumentFragment();
      let cursor = segment.start;
      for (let index = from; index < to; index += 1) {
        const token = analysis.tokens[index]!;
        // `clip_span_start` / `clip_span_end`: proved to stay inside both the
        // token and the segment, so every slice below is in range.
        const start = Math.max(token.start, segment.start);
        const end = Math.min(token.end, segment.end);
        if (start > cursor)
          fragment.append(this.document.createTextNode(surface.source.slice(cursor, start)));
        const span = this.document.createElement("span");
        span.className = `wh-token wh-${token.scope}`;
        span.textContent = surface.source.slice(start, end);
        const definition = symbolAt(analysis.definitionBySpan, token);
        const reference = symbolAt(analysis.referenceBySpan, token);
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

  /** Detects framework hydration that replaced our spans without changing the source text. */
  #renderedSurfaceIsIntact(surface: Surface, analysis: Analysis): boolean {
    for (const { segment, from, to } of coveredTokens(surface.segments, analysis.tokens)) {
      if (segment.element.dataset.whSurface !== "true") return false;
      if (segment.element.querySelectorAll(":scope > .wh-token").length !== to - from) return false;
    }
    return true;
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
      const symbol = target?.dataset.whSymbol;
      const entry = target ? this.#entry(target) : undefined;
      const definition = symbol ? entry?.analysis.definitionByName.get(symbol) : undefined;
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
      const definition = entry && name ? definitionElement(entry.surface, name) : undefined;
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

  #installDiscordRecovery(): void {
    const isCodeInteraction = (event: Event): boolean =>
      event.target instanceof HTMLElement &&
      Boolean(
        event.target.closest(
          'pre, code, [class*="codeContainer"], [class*="codeBlock"], [class*="markup"]',
        ),
      );
    const recover: EventListener = (event) => {
      if (!isCodeInteraction(event)) return;
      const view = this.document.defaultView;
      if (!view) return;
      for (const delay of discordRecoveryDelays) {
        this.#setTimer(delay, () => {
          void this.highlight().catch(() => undefined);
        });
      }
    };
    for (const type of discordRecoveryEvents) {
      const options: AddEventListenerOptions = { capture: true, passive: true };
      this.document.addEventListener(type, recover, options);
      this.#discordRecoveryListeners.push({ type, listener: recover, options });
    }
  }

  async #runBeforeHighlight(): Promise<void> {
    try {
      await this.options.beforeHighlight?.();
    } catch {
      // Theme and startup retries are best-effort; code discovery must stay alive.
    }
  }

  #scheduleTransientRetry(): void {
    if (this.#transientRetries >= transientRetryDelays.length) return;
    const delay = transientRetryDelays[this.#transientRetries]!;
    this.#transientRetries += 1;
    this.#setTimer(delay, () => this.#schedule());
  }

  #setTimer(delay: number, callback: () => void): void {
    const view = this.document.defaultView;
    if (!view) return;
    const timer = view.setTimeout(() => {
      const index = this.#timers.indexOf(timer);
      if (index >= 0) this.#timers.splice(index, 1);
      callback();
    }, delay);
    this.#timers.push(timer);
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
