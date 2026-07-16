import { BrowserHost, loadAnalyzer } from "./host.ts";

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
    const analyzer = await loadAnalyzer(browserApi.runtime.getURL("analyzer.wasm"));
    const host = new BrowserHost(document, analyzer);
    const readTheme = async () => {
      const stored = await browserApi.storage?.sync
        ?.get({ theme: "auto" })
        .catch(() => ({ theme: "auto" }));
      host.applyTheme(
        typeof stored?.theme === "string" ? stored.theme : "auto",
        matchMedia("(prefers-color-scheme: dark)").matches,
      );
    };
    await readTheme();
    host.start();
    browserApi.storage?.onChanged?.addListener(() => void readTheme());
  } catch (error) {
    document.documentElement.removeAttribute("data-wh-booted");
    console.warn("Web Highlighter could not start", error);
  }
}

void boot();
