/** Service DOM discovery: finds code-bearing nodes without any language policy. */
export interface Segment {
  element: HTMLElement;
  text: string;
  start: number;
  end: number;
}
export interface Surface {
  key: HTMLElement;
  source: string;
  segments: Segment[];
  hint: string;
  filename: string;
}

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
export const gitLabDiffLineSelector = '[data-testid="diff-line-code"], .line_content';
export const discordHosts = new Set(["discord.com", "canary.discord.com", "ptb.discord.com"]);
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
  "html-div",
  "js-file-line",
  "line",
  "line_content",
  "nohighlight",
  "plain",
  "plaintext",
  "react-code-line-contents",
  "react-code-text",
  "react-file-line",
  "shiki",
  "text",
  "txt",
  "wh-token",
]);

function classHint(value: string): string {
  const explicit = value.match(languageClass)?.[1]?.toLowerCase();
  if (explicit && !ignoredLanguageClasses.has(explicit)) return explicit;
  for (const token of value.split(/\s+/u)) {
    const normalized = token.trim().toLowerCase();
    if (/^(?:language|lang)-/u.test(normalized)) continue;
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

/**
 * Resolves the node that actually holds one line of code.
 *
 * GitHub nests a blob line as `.react-code-line-contents > div > #LC1`, and the
 * `LC` node is the one carrying the line anchor, so patching the wrapper would
 * replace the anchor along with the text. Diff rows wrap their text in
 * `.blob-code-inner` instead. Older flat rows are already the code node.
 */
function gitHubCodeTarget(element: HTMLElement): HTMLElement {
  return (
    element.querySelector<HTMLElement>(":scope > .blob-code-inner") ??
    element.querySelector<HTMLElement>(':scope [data-testid="code-cell"], :scope [id^="LC"]') ??
    element
  );
}

function makeSurface(
  elements: HTMLElement[],
  filename = "",
  fallbackHint = "",
): Surface | undefined {
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
  return {
    key,
    source,
    segments,
    hint: elements.map(hintOf).find(Boolean) ?? fallbackHint,
    filename,
  };
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

function discordVisibleLanguage(block: HTMLElement): string {
  for (const selector of [
    '[class*="codeLanguage"]',
    '[class*="codeLang"]',
    '[class*="languageName"]',
  ]) {
    const value = block.querySelector<HTMLElement>(selector)?.textContent?.trim();
    if (value && /^[\w+.#-]{1,32}$/u.test(value)) return value.toLowerCase();
  }
  return "";
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
      const surface = makeSurface([element], "", hintOf(block) || discordVisibleLanguage(block));
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
