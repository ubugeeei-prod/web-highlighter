interface WasmAnalyzer {
  analyze_request(source: string, hint: string, filename: string): string;
  theme_wire(theme: string, dark: boolean): string;
}

interface EngineRequest {
  kind: "analyze" | "theme";
  source?: string;
  hint?: string;
  filename?: string;
  theme?: string;
  dark?: boolean;
}

interface EngineResponse {
  ok: boolean;
  wire?: string;
  error?: string;
}

const MAX_SOURCE = 2_000_000;
let analyzer: Promise<WasmAnalyzer> | undefined;

function api(): WebHighlighterBrowserApi {
  const host = globalThis as typeof globalThis & {
    browser?: WebHighlighterBrowserApi;
    chrome?: WebHighlighterBrowserApi;
  };
  const browserApi = host.browser ?? host.chrome;
  if (!browserApi) throw new Error("WebExtension API is unavailable");
  return browserApi;
}

/** Compiles MoonBit in the extension origin, where MV3 permits packaged Wasm. */
async function loadAnalyzer(): Promise<WasmAnalyzer> {
  const bytes = await fetch(api().runtime.getURL("analyzer.wasm")).then((response) => {
    if (!response.ok) throw new Error(`analyzer load failed: ${response.status}`);
    return response.arrayBuffer();
  });
  const instantiate = WebAssembly.instantiate as unknown as (
    bytes: BufferSource,
    imports: WebAssembly.Imports,
    options: { builtins: string[]; importedStringConstants: string },
  ) => Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  const { instance } = await instantiate(
    bytes,
    {},
    {
      builtins: ["js-string"],
      importedStringConstants: "_",
    },
  );
  return instance.exports as unknown as WasmAnalyzer;
}

function getAnalyzer(): Promise<WasmAnalyzer> {
  analyzer ??= loadAnalyzer().catch((error) => {
    analyzer = undefined;
    throw error;
  });
  return analyzer;
}

function validRequest(message: unknown): message is EngineRequest {
  if (typeof message !== "object" || message === null) return false;
  const kind = (message as { kind?: unknown }).kind;
  return kind === "analyze" || kind === "theme";
}

async function handle(message: unknown): Promise<EngineResponse> {
  if (!validRequest(message)) return { ok: false, error: "invalid engine request" };
  if (message.kind === "theme") {
    if (typeof message.theme !== "string" || typeof message.dark !== "boolean")
      return { ok: false, error: "invalid theme request" };
    const engine = await getAnalyzer();
    return { ok: true, wire: engine.theme_wire(message.theme, message.dark) };
  }
  if (
    message.kind !== "analyze" ||
    typeof message.source !== "string" ||
    typeof message.hint !== "string" ||
    typeof message.filename !== "string" ||
    message.source.length > MAX_SOURCE
  )
    return { ok: false, error: "invalid analysis request" };
  const engine = await getAnalyzer();
  return {
    ok: true,
    wire: engine.analyze_request(message.source, message.hint, message.filename),
  };
}

api().runtime.onMessage.addListener((message, _sender, respond) => {
  void handle(message)
    .then(respond)
    .catch((error: unknown) =>
      respond({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});
