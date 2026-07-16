export type Service = "github" | "discord" | "slack" | "chatgpt" | "generic";

export interface SurfaceSegment {
  readonly element: HTMLElement;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface CodeSurface {
  /** Stable DOM identity used for idempotence and navigation lookup. */
  readonly key: HTMLElement;
  readonly service: Service;
  readonly source: string;
  readonly segments: readonly SurfaceSegment[];
  readonly languageHint?: string;
  readonly filename?: string;
}

const LANGUAGE_CLASS = /(?:^|\s)(?:language|lang)-([\w+.#-]+)/iu;

function textOf(element: HTMLElement): string {
  return element.dataset.whSource ?? element.textContent ?? "";
}

function hintOf(element: HTMLElement): string | undefined {
  const direct = element.dataset.language ?? element.getAttribute("data-lang") ?? element.getAttribute("data-code-language");
  if (direct) return direct;
  const match = element.className.match(LANGUAGE_CLASS);
  if (match?.[1]) return match[1];
  const labelled = element.closest<HTMLElement>("[data-language], [data-code-language]");
  return labelled?.dataset.language ?? labelled?.dataset.codeLanguage;
}

function surface(
  elements: readonly HTMLElement[],
  service: Service,
  metadata: { languageHint?: string; filename?: string } = {},
): CodeSurface | undefined {
  if (elements.length === 0) return undefined;
  const segments: SurfaceSegment[] = [];
  let source = "";
  for (const [index, element] of elements.entries()) {
    const text = textOf(element);
    const start = source.length;
    source += text;
    segments.push({ element, text, start, end: source.length });
    if (index + 1 < elements.length) source += "\n";
  }
  if (!source.trim()) return undefined;
  const key = elements[0];
  if (!key) return undefined;
  const languageHint = metadata.languageHint ?? elements.map(hintOf).find(Boolean);
  return {
    key,
    service,
    source,
    segments,
    ...(languageHint ? { languageHint } : {}),
    ...(metadata.filename ? { filename: metadata.filename } : {}),
  };
}

function candidates(root: ParentNode, selector: string): HTMLElement[] {
  const result = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (root instanceof HTMLElement && root.matches(selector)) result.unshift(root);
  return result;
}

function genericSurfaces(root: ParentNode, service: Service): CodeSurface[] {
  const found: CodeSurface[] = [];
  const seen = new Set<HTMLElement>();
  for (const element of candidates(root, "pre > code, pre[data-language], pre[data-code-language]")) {
    const target = element.tagName === "CODE" ? element : element.querySelector<HTMLElement>(":scope > code") ?? element;
    if (seen.has(target)) continue;
    seen.add(target);
    const item = surface([target], service);
    if (item) found.push(item);
  }
  return found;
}

function githubFilename(document: Document, location: Location): string | undefined {
  const breadcrumb = document.querySelector<HTMLElement>(
    '[data-testid="breadcrumbs-filename"], [data-testid="breadcrumb-filename"], .final-path',
  )?.textContent?.trim();
  if (breadcrumb) return breadcrumb.replace(/^\/+/, "");
  const marker = location.pathname.indexOf("/blob/");
  if (marker < 0) return undefined;
  const tail = location.pathname.slice(marker + 6);
  const last = tail.slice(tail.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function githubSurfaces(document: Document, root: ParentNode, location: Location): CodeSurface[] {
  const result: CodeSurface[] = [];
  const filename = githubFilename(document, location);
  const lineSelectors = [
    "td.blob-code",
    '[data-testid="code-cell"]',
    ".react-code-line-contents",
    '[data-code-text="true"]',
  ];
  for (const selector of lineSelectors) {
    const lines = candidates(document, selector).filter((line) => !line.closest("pre"));
    if (lines.length > 0) {
      const item = surface(lines, "github", filename ? { filename } : {});
      if (item) result.push(item);
      break;
    }
  }
  for (const item of genericSurfaces(root, "github")) {
    if (!result.some((known) => known.segments.some((segment) => segment.element.contains(item.key)))) {
      result.push(item);
    }
  }
  return result;
}

/** Discovers service-specific code surfaces without depending on private APIs. */
export function discoverSurfaces(document: Document, root: ParentNode = document): CodeSurface[] {
  const host = document.location.hostname;
  if (host === "github.com" || host.endsWith(".github.com")) return githubSurfaces(document, root, document.location);
  if (host === "discord.com" || host.endsWith(".discord.com")) return genericSurfaces(root, "discord");
  if (host === "chatgpt.com" || host === "chat.openai.com") return genericSurfaces(root, "chatgpt");
  if (host.endsWith(".slack.com")) return genericSurfaces(root, "slack");
  return genericSurfaces(root, "generic");
}
