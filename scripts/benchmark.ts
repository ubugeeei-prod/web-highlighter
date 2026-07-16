import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";

interface Analyzer {
  analyze_request(source: string, hint: string, filename: string): string;
}

interface Budgets {
  runtimeBrotliBytes: number;
  minimumScannerMiBPerSecond: number;
  maximumColdStartMilliseconds: number;
}

const budgets = JSON.parse(
  await readFile(new URL("../bench/budgets.json", import.meta.url), "utf8"),
) as Budgets;
const wasm = await readFile(
  new URL("../_build/wasm-gc/release/build/src/src.wasm", import.meta.url),
);
const coldStart = performance.now();
const { instance } = await WebAssembly.instantiate(
  wasm,
  {},
  {
    builtins: ["js-string"],
    importedStringConstants: "_",
  },
);
const analyzer = instance.exports as unknown as Analyzer;
analyzer.analyze_request("fn main { let value = 42 }", "moonbit", "main.mbt");
const coldStartMilliseconds = performance.now() - coldStart;

const line =
  "pub fn calculate(value : Int) -> Int { // hot path\n  let next = value * 2 + 1\n  next\n}\n";
const source = line.repeat(Math.ceil((512 * 1024) / line.length));
const runs = 6;
const start = performance.now();
for (let index = 0; index < runs; index += 1)
  analyzer.analyze_request(source, "moonbit", "bench.mbt");
const elapsedSeconds = (performance.now() - start) / 1000;
const mibPerSecond = (source.length * runs) / 1024 / 1024 / elapsedSeconds;

const content = await readFile(new URL("../dist/chromium/content.js", import.meta.url));
const engine = await readFile(new URL("../dist/chromium/engine.js", import.meta.url));
const contentBrotliBytes = brotliCompressSync(content).length;
const engineBrotliBytes = brotliCompressSync(engine).length;
const analyzerBrotliBytes = brotliCompressSync(wasm).length;
const runtimeBrotliBytes = contentBrotliBytes + engineBrotliBytes + analyzerBrotliBytes;
console.log(
  JSON.stringify(
    {
      sourceBytes: source.length,
      runs,
      scannerMiBPerSecond: Number(mibPerSecond.toFixed(2)),
      coldStartMilliseconds: Number(coldStartMilliseconds.toFixed(2)),
      contentBytes: content.length,
      engineBytes: engine.length,
      wasmBytes: wasm.length,
      runtimeBrotliBytes,
    },
    null,
    2,
  ),
);

if (mibPerSecond < budgets.minimumScannerMiBPerSecond)
  throw new Error(`scanner throughput ${mibPerSecond.toFixed(2)} MiB/s is below budget`);
if (coldStartMilliseconds > budgets.maximumColdStartMilliseconds)
  throw new Error(`cold start ${coldStartMilliseconds.toFixed(2)} ms is above budget`);
if (runtimeBrotliBytes > budgets.runtimeBrotliBytes)
  throw new Error(`runtime ${runtimeBrotliBytes} Brotli bytes is above budget`);
