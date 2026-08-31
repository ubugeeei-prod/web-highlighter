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
const discordRecoveryDelays = [0, 80, 240, 600] as const;
const ignoredLanguageClasses = new Set([
  "blob-code",
  "blob-code-addition",
  "blob-code-context",
  "blob-code-deletion",
  "blob-code-hunk",
  "blob-code-inner",
  "blob-code-marker",
  "code",
  "hljs",
  "js-file-line",
  "line",
  "line_content",
  "nohighlight",
  "react-code-line-contents",
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

export function documentPrefersDark(document: Document, fallback: boolean): boolean {
  for (const selector of [
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
  readonly #discordRecoveryListeners: Array<{
    type: (typeof discordRecoveryEvents)[number];
    listener: EventListener;
    options: AddEventListenerOptions;
  }> = [];
  #discordRecoveryTimers: number[] = [];
  #observer: MutationObserver | undefined;
  #scheduled = false;
  #highlighting: Promise<number> | undefined;
  #rerun = false;

  constructor(
    readonly document: Document,
    readonly analyzer: Analyzer,
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
    for (const surface of discoverSurfaces(this.document).slice(0, MAX_SURFACES)) {
      if (surface.source.length > MAX_SOURCE) continue;
      const analysis = decodeAnalysis(
        await this.analyzer.analyze_request(surface.source, surface.hint, surface.filename),
        surface.source,
      );
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
    for (const { type, listener, options } of this.#discordRecoveryListeners)
      this.document.removeEventListener(type, listener, options);
    this.#discordRecoveryListeners.length = 0;
    const view = this.document.defaultView;
    if (view) {
      for (const timer of this.#discordRecoveryTimers) view.clearTimeout(timer);
    }
    this.#discordRecoveryTimers = [];
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

  /** Detects framework hydration that replaced our spans without changing the source text. */
  #renderedSurfaceIsIntact(surface: Surface, analysis: Analysis): boolean {
    return surface.segments.every((segment) => {
      if (segment.element.dataset.whSurface !== "true") return false;
      const expected = analysis.tokens.filter(
        (token) => token.end > segment.start && token.start < segment.end,
      ).length;
      return segment.element.querySelectorAll(":scope > .wh-token").length === expected;
    });
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
        const timer = view.setTimeout(() => {
          this.#discordRecoveryTimers = this.#discordRecoveryTimers.filter(
            (item) => item !== timer,
          );
          void this.highlight().catch(() => undefined);
        }, delay);
        this.#discordRecoveryTimers.push(timer);
      }
    };
    for (const type of discordRecoveryEvents) {
      const options: AddEventListenerOptions = { capture: true, passive: true };
      this.document.addEventListener(type, recover, options);
      this.#discordRecoveryListeners.push({ type, listener: recover, options });
    }
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
