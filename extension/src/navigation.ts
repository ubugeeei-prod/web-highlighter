import type { Analysis } from "./analyzer.ts";
import type { CodeSurface } from "./surfaces.ts";

interface NavigationEntry {
  readonly surface: CodeSurface;
  readonly analysis: Analysis;
}

const documents = new WeakSet<Document>();
const entries = new WeakMap<HTMLElement, NavigationEntry>();

function containingEntry(element: HTMLElement): NavigationEntry | undefined {
  const root = element.closest<HTMLElement>("[data-wh-surface]");
  return root ? entries.get(root) : undefined;
}

function tooltip(document: Document): HTMLElement {
  let card = document.querySelector<HTMLElement>("#wh-tooltip");
  if (!card) {
    card = document.createElement("div");
    card.id = "wh-tooltip";
    card.className = "wh-tooltip";
    card.setAttribute("role", "tooltip");
    document.body.append(card);
  }
  return card;
}

function showTooltip(target: HTMLElement): void {
  const name = target.dataset.whSymbol;
  if (!name) return;
  const entry = containingEntry(target);
  if (!entry) return;
  const definition = entry.analysis.definitions.find((item) => item.name === name);
  if (!definition) return;
  const card = tooltip(target.ownerDocument);
  card.textContent = `${definition.kind} ${definition.name} · line ${definition.line}`;
  const rect = target.getBoundingClientRect();
  card.style.left = `${Math.max(8, rect.left)}px`;
  card.style.top = `${rect.bottom + 6}px`;
  card.hidden = false;
}

function jump(target: HTMLElement): void {
  const name = target.dataset.whSymbol;
  if (!name || target.dataset.whDefinition) return;
  const entry = containingEntry(target);
  if (!entry) return;
  const selector = `[data-wh-definition="true"][data-wh-symbol="${CSS.escape(name)}"]`;
  const definition = entry.surface.segments
    .map(({ element }) => element.matches(selector) ? element : element.querySelector<HTMLElement>(selector))
    .find((element): element is HTMLElement => Boolean(element));
  if (!definition) return;
  definition.scrollIntoView({ block: "center", behavior: "smooth" });
  definition.classList.remove("wh-jump-target");
  requestAnimationFrame(() => definition.classList.add("wh-jump-target"));
}

/** Registers a rendered surface for same-file jump-to-definition and hover. */
export function registerNavigation(surface: CodeSurface, analysis: Analysis): void {
  for (const segment of surface.segments) entries.set(segment.element, { surface, analysis });
  const document = surface.key.ownerDocument;
  if (documents.has(document)) return;
  documents.add(document);
  document.addEventListener("pointerover", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-wh-symbol]") : null;
    if (target) showTooltip(target);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("[data-wh-symbol]")) tooltip(document).hidden = true;
  });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-wh-reference]") : null;
    if (target) jump(target);
  });
  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLElement && event.target.matches("[data-wh-reference]")) {
      event.preventDefault();
      jump(event.target);
    }
  });
}
