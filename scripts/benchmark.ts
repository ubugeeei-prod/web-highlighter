import { readFile } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { analyze } from "../extension/src/analyzer.ts";
import { builtinLanguages } from "../plugins/builtin/catalog.ts";

interface Budgets {
  contentBrotliBytes: number;
  minimumScannerMiBPerSecond: number;
  maximumColdStartMilliseconds: number;
}

const budgets = JSON.parse(await readFile(new URL("../bench/budgets.json", import.meta.url), "utf8")) as Budgets;
const moonbit = builtinLanguages.find(({ id }) => id === "moonbit")!;
const line = 'pub fn calculate(value : Int) -> Int { // hot path\n  let next = value * 2 + 1\n  next\n}\n';
const source = line.repeat(Math.ceil(512 * 1024 / line.length));

const coldStart = performance.now();
analyze(moonbit, "fn main { let value = 42 }");
const coldStartMilliseconds = performance.now() - coldStart;

const runs = 6;
const start = performance.now();
for (let index = 0; index < runs; index += 1) analyze(moonbit, source);
const elapsedSeconds = (performance.now() - start) / 1000;
const mibPerSecond = (source.length * runs) / 1024 / 1024 / elapsedSeconds;

const content = await readFile(new URL("../dist/chromium/content.js", import.meta.url));
const contentBrotliBytes = brotliCompressSync(content).length;

console.log(JSON.stringify({
  sourceBytes: source.length,
  runs,
  scannerMiBPerSecond: Number(mibPerSecond.toFixed(2)),
  coldStartMilliseconds: Number(coldStartMilliseconds.toFixed(2)),
  contentBytes: content.length,
  contentBrotliBytes,
}, null, 2));

if (mibPerSecond < budgets.minimumScannerMiBPerSecond) {
  throw new Error(`scanner throughput ${mibPerSecond.toFixed(2)} MiB/s is below budget`);
}
if (coldStartMilliseconds > budgets.maximumColdStartMilliseconds) {
  throw new Error(`cold start ${coldStartMilliseconds.toFixed(2)} ms is above budget`);
}
if (contentBrotliBytes > budgets.contentBrotliBytes) {
  throw new Error(`content bundle ${contentBrotliBytes} bytes is above budget`);
}
