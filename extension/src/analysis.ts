/** The compact MoonBit analysis plan and the indexes the renderer sweeps it with. */
import type { Segment } from "./surfaces.ts";

export interface Token {
  start: number;
  end: number;
  scope: string;
}
export interface Definition {
  start: number;
  end: number;
  kind: string;
  line: number;
  name: string;
}
export interface Reference {
  start: number;
  end: number;
  name: string;
}
/**
 * One analyzed surface plus the span indexes rendering needs.
 *
 * Symbol spans are identifier-aligned and never overlap, so a span start
 * identifies at most one symbol. Keying by start keeps the render loop free of
 * per-token key strings; the token end is confirmed on lookup.
 */
export interface Analysis {
  language: string;
  tokens: Token[];
  definitions: Definition[];
  references: Reference[];
  definitionBySpan: Map<number, Definition>;
  referenceBySpan: Map<number, Reference>;
  definitionByName: Map<string, Definition>;
}

/** Decodes the compact line protocol emitted by MoonBit without a JSON runtime. */
export function decodeAnalysis(wire: string, source: string): Analysis | undefined {
  if (!wire) return undefined;
  const analysis: Analysis = {
    language: "",
    tokens: [],
    definitions: [],
    references: [],
    definitionBySpan: new Map(),
    referenceBySpan: new Map(),
    definitionByName: new Map(),
  };
  let cursor = 0;
  for (const line of wire.split("\n")) {
    const [tag, a = "", b = "", c = "", d = ""] = line.split("\t");
    if (tag === "L") analysis.language = a;
    else if (tag === "T") {
      const start = +a;
      const end = +b;
      // Rendering sweeps this list once, so keep the analyzer's own colocated
      // invariant (`ordered_span_after` in `src/scanner_proof/proof.mbtp`):
      // spans stay ordered and non-empty even if a plan ever arrives malformed.
      if (start >= cursor && start < end) {
        analysis.tokens.push({ start, end, scope: c });
        cursor = end;
      }
    } else if (tag === "D") {
      const definition = { start: +a, end: +b, kind: c, line: +d, name: source.slice(+a, +b) };
      analysis.definitions.push(definition);
      if (!analysis.definitionBySpan.has(definition.start))
        analysis.definitionBySpan.set(definition.start, definition);
      if (!analysis.definitionByName.has(definition.name))
        analysis.definitionByName.set(definition.name, definition);
    } else if (tag === "R") {
      const reference = { start: +a, end: +b, name: c };
      analysis.references.push(reference);
      if (!analysis.referenceBySpan.has(reference.start))
        analysis.referenceBySpan.set(reference.start, reference);
    }
  }
  return analysis.language ? analysis : undefined;
}

/** Resolves the symbol a token stands for without scanning the symbol tables. */
export function symbolAt<Item extends { start: number; end: number }>(
  index: Map<number, Item>,
  token: Token,
): Item | undefined {
  const item = index.get(token.start);
  return item && item.end === token.end ? item : undefined;
}

/**
 * Pairs every segment with the half-open token range covering it.
 *
 * Tokens are ordered, non-empty, and non-overlapping by MoonBit invariant, and
 * segments are built in source order, so both cursors only move forward. A
 * surface therefore costs segments plus tokens instead of one token scan per
 * line, which is what a large GitHub blob is made of.
 *
 * The two conditions are the executable predicates `span_precedes_segment` and
 * `span_follows_segment` colocated in `src/analysis_oracle.mbt`, where
 * `skipped_token_cannot_cover`, `stopped_token_cannot_cover`,
 * `skipped_token_skips_its_prefix`, and `stopped_token_stops_its_suffix` in
 * `src/sweep_proof/proof.mbtp` proves that skipping and stopping can
 * never drop a token that covers the segment.
 */
export function* coveredTokens(
  segments: readonly Segment[],
  tokens: readonly Token[],
): Generator<{ segment: Segment; from: number; to: number }> {
  let from = 0;
  for (const segment of segments) {
    while (from < tokens.length && tokens[from]!.end <= segment.start) from += 1;
    let to = from;
    while (to < tokens.length && tokens[to]!.start < segment.end) to += 1;
    yield { segment, from, to };
  }
}

export function hash(source: string, language: string): string {
  let value = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1)
    value = Math.imul(value ^ source.charCodeAt(index), 16_777_619);
  return `${language}:${source.length}:${value >>> 0}`;
}
