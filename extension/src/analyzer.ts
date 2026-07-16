import { analyze_handle_wire, compile_language_wire } from "../../_build/js/release/build/src/src.js";
import type { CompiledLanguage, Scope, SymbolKind } from "./plugin-api.ts";

export interface Span {
  readonly start: number;
  readonly end: number;
}

export interface SemanticToken extends Span {
  readonly scope: Scope;
}

export interface Definition extends Span {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly line: number;
}

export interface Reference extends Span {
  readonly name: string;
}

export interface Analysis {
  readonly tokens: readonly SemanticToken[];
  readonly definitions: readonly Definition[];
  readonly references: readonly Reference[];
}

const EMPTY: Analysis = Object.freeze({ tokens: [], definitions: [], references: [] });
const handles = new WeakMap<CompiledLanguage, number>();

function handleOf(language: CompiledLanguage): number {
  const known = handles.get(language);
  if (known !== undefined) return known;
  const wire = language.wire;
  const handle = compile_language_wire(
    wire.keywords,
    wire.types,
    wire.constants,
    wire.declarations,
    wire.lineComments,
    wire.blockComments,
    wire.strings,
    wire.operatorCharacters,
    wire.identifierExtra,
  );
  handles.set(language, handle);
  return handle;
}

/** Calls the MoonBit scanner and decodes its allocation-light line protocol. */
export function analyze(language: CompiledLanguage, source: string): Analysis {
  if (!source) return EMPTY;
  const encoded = analyze_handle_wire(source, handleOf(language));
  const tokens: SemanticToken[] = [];
  const definitions: Definition[] = [];
  const references: Reference[] = [];
  for (const line of encoded.split("\n")) {
    if (!line) continue;
    const fields = line.split("\t");
    const start = Number(fields[1]);
    const end = Number(fields[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > source.length) {
      throw new Error("MoonBit analyzer returned an invalid span");
    }
    if (fields[0] === "T") {
      tokens.push({ start, end, scope: fields[3] as Scope });
    } else if (fields[0] === "D") {
      definitions.push({ start, end, name: source.slice(start, end), kind: fields[3] as SymbolKind, line: Number(fields[4]) });
    } else if (fields[0] === "R") {
      references.push({ start, end, name: fields[3] ?? source.slice(start, end) });
    } else {
      throw new Error("MoonBit analyzer returned an unknown record");
    }
  }
  return { tokens, definitions, references };
}
