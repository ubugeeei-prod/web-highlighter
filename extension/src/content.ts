import { builtinLanguages } from "../../plugins/builtin/catalog.ts";
import { builtinThemes } from "../../plugins/builtin/themes.ts";
import { HighlighterEngine } from "./engine.ts";

const BOOT_ATTRIBUTE = "data-wh-booted";
const DEFAULT_THEME = "adaptive";

function api(): WebHighlighterBrowserApi | undefined {
  const host = globalThis as typeof globalThis & {
    browser?: WebHighlighterBrowserApi;
    chrome?: WebHighlighterBrowserApi;
  };
  return host.browser ?? host.chrome;
}

function chooseTheme(id: unknown) {
  if (id === "auto") {
    const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "midnight" : "adaptive";
    return builtinThemes.find((theme) => theme.id === preferred) ?? builtinThemes[0]!;
  }
  return builtinThemes.find((theme) => theme.id === id) ?? builtinThemes.find((theme) => theme.id === DEFAULT_THEME)!;
}

async function boot(): Promise<void> {
  if (document.documentElement.hasAttribute(BOOT_ATTRIBUTE)) return;
  document.documentElement.setAttribute(BOOT_ATTRIBUTE, "true");
  const browserApi = api();
  const stored = await browserApi?.storage?.sync?.get({ theme: "auto" }).catch(() => ({ theme: "auto" }));
  const engine = new HighlighterEngine({
    document,
    languages: builtinLanguages,
    theme: chooseTheme(stored?.theme),
  });
  engine.start();
  browserApi?.storage?.onChanged?.addListener((changes) => {
    if (changes.theme) {
      const next = chooseTheme(changes.theme.newValue);
      for (const [name, color] of Object.entries(next.colors)) {
        document.documentElement.style.setProperty(`--wh-${name}`, color);
      }
      document.documentElement.dataset.whTheme = next.id;
    }
  });
}

void boot();
