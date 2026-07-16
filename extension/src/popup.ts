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
  const status = document.querySelector<HTMLElement>("#status")!;
  theme.add(new Option("Follow system", "auto"));
  try {
    const response = (await browserApi.runtime.sendMessage({ kind: "themes" })) as {
      ok?: boolean;
      wire?: unknown;
      error?: unknown;
    };
    if (!response?.ok || typeof response.wire !== "string")
      throw new Error(typeof response?.error === "string" ? response.error : "engine failed");
    for (const line of response.wire.split("\n")) {
      const [tag, id, name] = line.split("\t");
      if (tag === "T" && id && name) theme.add(new Option(name, id));
    }
  } catch {
    status.textContent = "Theme catalog is temporarily unavailable.";
  }
  const stored = await browserApi.storage?.sync?.get({ theme: "auto" });
  theme.value = typeof stored?.theme === "string" ? stored.theme : "auto";
  theme.addEventListener(
    "change",
    () => void browserApi.storage?.sync?.set({ theme: theme.value }),
  );
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
