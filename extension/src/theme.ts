/** Theme-mode detection from the page's own colors and root hints. */
import { gitLabDiffLineSelector } from "./surfaces.ts";

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
