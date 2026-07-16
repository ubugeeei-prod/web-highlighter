import { BrowserHost, type Analyzer } from "./host.ts";

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
  if (!browserApi) return;
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
    const host = new BrowserHost(document, analyzer);
    const readTheme = async () => {
      const stored = await browserApi.storage?.sync
        ?.get({ theme: "auto" })
        .catch(() => ({ theme: "auto" }));
      await host.applyTheme(
        typeof stored?.theme === "string" ? stored.theme : "auto",
        matchMedia("(prefers-color-scheme: dark)").matches,
      );
    };
    await readTheme();
    await host.start();
    browserApi.storage?.onChanged?.addListener(() => void readTheme());
  } catch (error) {
    document.documentElement.removeAttribute("data-wh-booted");
    console.warn("Web Highlighter could not start", error);
  }
}

void boot();
