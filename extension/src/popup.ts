import { builtinThemes } from "../../plugins/builtin/themes.ts";

function api(): WebHighlighterBrowserApi {
  const host = globalThis as typeof globalThis & {
    browser?: WebHighlighterBrowserApi;
    chrome?: WebHighlighterBrowserApi;
  };
  const browserApi = host.browser ?? host.chrome;
  if (!browserApi) throw new Error("WebExtension API is unavailable");
  return browserApi;
}

async function main(): Promise<void> {
  const browserApi = api();
  const theme = document.querySelector<HTMLSelectElement>("#theme")!;
  for (const item of [{ id: "auto", name: "Follow system" }, ...builtinThemes]) {
    theme.add(new Option(item.name, item.id));
  }
  const stored = await browserApi.storage?.sync?.get({ theme: "auto" });
  theme.value = typeof stored?.theme === "string" ? stored.theme : "auto";
  theme.addEventListener("change", () => void browserApi.storage?.sync?.set({ theme: theme.value }));

  const enable = document.querySelector<HTMLButtonElement>("#enable")!;
  const status = document.querySelector<HTMLElement>("#status")!;
  enable.addEventListener("click", async () => {
    const [tab] = (await browserApi.tabs?.query({ active: true, currentWindow: true })) ?? [];
    if (!tab?.id || !tab.url) return;
    const url = new URL(tab.url);
    const origin = `${url.protocol}//${url.host}/*`;
    const granted = await browserApi.permissions?.request({ origins: [origin] });
    if (!granted) {
      status.textContent = "Permission was not granted.";
      return;
    }
    await Promise.all([
      browserApi.scripting?.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] }),
      browserApi.scripting?.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }),
    ]);
    status.textContent = `Enabled on ${url.host}`;
  });
}

void main();
