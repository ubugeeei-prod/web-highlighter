import { discordHosts, discoverSurfaces, type Surface } from "./surfaces.ts";
import { coveredTokens, decodeAnalysis, hash, symbolAt, type Analysis } from "./analysis.ts";

/** The deliberately small browser boundary around the MoonBit/Wasm engine. */
export interface Analyzer {
  analyze_request(source: string, hint: string, filename: string): Promise<string> | string;
  theme_wire(theme: string, dark: boolean): Promise<string> | string;
}

interface BrowserHostOptions {
  beforeHighlight?: () => Promise<void> | void;
}

const MAX_SOURCE = 2_000_000;
const MAX_SURFACES = 48;
const transientRetryDelays = [120, 300, 800, 1800, 3600, 7200] as const;
const startupScanDelays = [60, 180, 420, 900, 1800, 3600, 7200] as const;

const discordRecoveryEvents = ["click", "pointerup", "focusin", "keyup"] as const;
const discordRecoveryDelays = [0, 80, 240, 600, 1200, 2400] as const;

/** Finds the rendered definition of a symbol without materializing every span. */
function definitionElement(surface: Surface, name: string): HTMLElement | undefined {
  for (const { element } of surface.segments)
    for (const item of element.querySelectorAll<HTMLElement>('[data-wh-definition="true"]'))
      if (item.dataset.whSymbol === name) return item;
  return undefined;
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
