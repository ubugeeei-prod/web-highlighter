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
  for (const [name, id] of [
    ["Follow system", "auto"],
    ["Adaptive", "adaptive"],
    ["Midnight", "midnight"],
  ]) {
    theme.add(new Option(name, id));
  }
  const stored = await browserApi.storage?.sync?.get({ theme: "auto" });
  theme.value = typeof stored?.theme === "string" ? stored.theme : "auto";
  theme.addEventListener(
    "change",
    () => void browserApi.storage?.sync?.set({ theme: theme.value }),
  );

  const status = document.querySelector<HTMLElement>("#status")!;
  document.querySelector<HTMLButtonElement>("#enable")!.addEventListener("click", async () => {
    const [tab] = (await browserApi.tabs?.query({ active: true, currentWindow: true })) ?? [];
    if (!tab?.id || !tab.url) return;
    const url = new URL(tab.url);
    const granted = await browserApi.permissions?.request({
      origins: [`${url.protocol}//${url.host}/*`],
    });
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
