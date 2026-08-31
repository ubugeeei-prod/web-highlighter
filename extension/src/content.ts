import { BrowserHost, documentPrefersDark, type Analyzer } from "./host.ts";

function api(): WebHighlighterBrowserApi | undefined {
  const host = globalThis as typeof globalThis & {
    browser?: WebHighlighterBrowserApi;
    chrome?: WebHighlighterBrowserApi;
  };
  return host.browser ?? host.chrome;
}

async function boot(): Promise<void> {
  if (document.documentElement.dataset.whBooted) return;
  document.documentElement.dataset.whBooted = "true";
  const browserApi = api();
  if (!browserApi) {
    document.documentElement.removeAttribute("data-wh-booted");
    return;
  }
  try {
    const request = async (message: unknown): Promise<string> => {
      const response = (await browserApi.runtime.sendMessage(message)) as {
        ok?: boolean;
        wire?: unknown;
        error?: unknown;
      };
      if (!response?.ok || typeof response.wire !== "string")
        throw new Error(typeof response?.error === "string" ? response.error : "engine failed");
      return response.wire;
    };
    const analyzer: Analyzer = {
      analyze_request: (source, hint, filename) =>
        request({ kind: "analyze", source, hint, filename }),
      theme_wire: (theme, dark) => request({ kind: "theme", theme, dark }),
    };
    let selectedTheme = "auto";
    const readStoredTheme = async () => {
      const stored = await browserApi.storage?.sync
        ?.get({ theme: "auto" })
        .catch(() => ({ theme: "auto" }));
      selectedTheme = typeof stored?.theme === "string" ? stored.theme : "auto";
    };
    const host = new BrowserHost(document, analyzer, {
      beforeHighlight: () =>
        host.applyTheme(
          selectedTheme,
          documentPrefersDark(document, matchMedia("(prefers-color-scheme: dark)").matches),
        ),
    });
    const applyTheme = async () => {
      await host.applyTheme(
        selectedTheme,
        documentPrefersDark(document, matchMedia("(prefers-color-scheme: dark)").matches),
      );
    };
    await readStoredTheme();
    await applyTheme().catch(() => undefined);
    await host.start();
    browserApi.storage?.onChanged?.addListener((changes) => {
      const theme = changes.theme?.newValue;
      if (typeof theme === "string") selectedTheme = theme;
      void applyTheme()
        .catch(() => undefined)
        .then(() => host.highlight())
        .catch(() => undefined);
    });
  } catch (error) {
    document.documentElement.removeAttribute("data-wh-booted");
    console.warn("Web Highlighter could not start", error);
  }
}

void boot();
