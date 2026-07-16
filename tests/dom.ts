import { Window } from "happy-dom";

export interface TestWindow {
  readonly document: Document;
  readonly HTMLElement: typeof HTMLElement;
  readonly Element: typeof Element;
  readonly Node: typeof Node;
  readonly MutationObserver: typeof MutationObserver;
  readonly CSS: typeof CSS;
  readonly PointerEvent: typeof PointerEvent;
}

/** Installs one isolated happy-dom window for a test case. */
export function testWindow(url: string): TestWindow {
  const happyWindow = new Window({ url });
  const window = happyWindow as unknown as TestWindow;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = window;
  globals.document = window.document;
  globals.HTMLElement = window.HTMLElement;
  globals.Element = window.Element;
  globals.Node = window.Node;
  globals.MutationObserver = window.MutationObserver;
  globals.CSS = window.CSS;
  globals.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(performance.now());
    return 1;
  };
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    this.dataset.scrolled = "true";
  };
  return window;
}
