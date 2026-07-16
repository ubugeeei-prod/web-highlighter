import type { Analysis, Definition, SemanticToken } from "./analyzer.ts";
import type { ThemeSpec } from "./plugin-api.ts";
import type { CodeSurface, SurfaceSegment } from "./surfaces.ts";

function definitionAt(analysis: Analysis, start: number, end: number): Definition | undefined {
  return analysis.definitions.find((item) => item.start === start && item.end === end);
}

function referenceAt(analysis: Analysis, start: number, end: number): string | undefined {
  return analysis.references.find((item) => item.start === start && item.end === end)?.name;
}

function tokenElement(
  document: Document,
  source: string,
  token: SemanticToken,
  localStart: number,
  localEnd: number,
  analysis: Analysis,
): HTMLElement {
  const element = document.createElement("span");
  element.className = `wh-token wh-${token.scope}`;
  element.textContent = source.slice(localStart, localEnd);
  const definition = definitionAt(analysis, token.start, token.end);
  const reference = referenceAt(analysis, token.start, token.end);
  if (definition) {
    element.dataset.whSymbol = definition.name;
    element.dataset.whDefinition = "true";
    element.dataset.whKind = definition.kind;
    element.dataset.whLine = String(definition.line);
    element.tabIndex = 0;
  } else if (reference) {
    element.dataset.whSymbol = reference;
    element.dataset.whReference = "true";
    element.tabIndex = 0;
  }
  return element;
}

function renderSegment(segment: SurfaceSegment, surface: CodeSurface, analysis: Analysis): void {
  const document = segment.element.ownerDocument;
  const fragment = document.createDocumentFragment();
  const tokens = analysis.tokens.filter((token) => token.end > segment.start && token.start < segment.end);
  let cursor = segment.start;
  for (const token of tokens) {
    const start = Math.max(token.start, segment.start);
    const end = Math.min(token.end, segment.end);
    if (start > cursor) fragment.append(document.createTextNode(surface.source.slice(cursor, start)));
    fragment.append(tokenElement(document, surface.source, token, start, end, analysis));
    cursor = end;
  }
  if (cursor < segment.end) fragment.append(document.createTextNode(surface.source.slice(cursor, segment.end)));
  segment.element.replaceChildren(fragment);
  segment.element.dataset.whSource = segment.text;
  segment.element.dataset.whSurface = "true";
}

/** Applies immutable analysis spans while preserving each service's line nodes. */
export function renderSurface(surface: CodeSurface, analysis: Analysis, languageId: string): void {
  for (const segment of surface.segments) renderSegment(segment, surface, analysis);
  surface.key.dataset.whLanguage = languageId;
}

/** Installs a theme through CSS variables; changing themes never reparses code. */
export function applyTheme(document: Document, theme: Readonly<ThemeSpec>): void {
  const root = document.documentElement;
  root.dataset.whTheme = theme.id;
  for (const [name, color] of Object.entries(theme.colors)) root.style.setProperty(`--wh-${name}`, color);
}
