export type Scope =
  | "keyword"
  | "type"
  | "constant"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "function"
  | "variable"
  | "property"
  | "punctuation";

export type SymbolKind = "function" | "type" | "module" | "variable" | "property";

export interface DelimiterSpec {
  readonly open: string;
  readonly close: string;
}

export interface SignatureSpec {
  /** A literal source fragment. Plugins never execute regular expressions. */
  readonly text: string;
  /** Distinguishes very characteristic fragments from ordinary keywords. */
  readonly weight?: number;
}

export interface LanguageGrammar {
  readonly keywords?: readonly string[];
  readonly types?: readonly string[];
  readonly constants?: readonly string[];
  /** Maps a declaration-leading keyword to the kind of the following name. */
  readonly declarations?: Readonly<Record<string, SymbolKind>>;
  readonly lineComments?: readonly string[];
  readonly blockComments?: readonly DelimiterSpec[];
  readonly strings?: readonly DelimiterSpec[];
  readonly operatorCharacters?: string;
  readonly identifierExtra?: string;
}

export interface LanguageSpec {
  /** Stable, lower-case identifier written in fenced code blocks. */
  readonly id: string;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly extensions?: readonly string[];
  readonly filenames?: readonly string[];
  /** Literal fingerprints used only when a service discarded the language tag. */
  readonly signatures?: readonly SignatureSpec[];
  readonly grammar: LanguageGrammar;
}

export interface CompiledLanguage {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly extensions: readonly string[];
  readonly filenames: readonly string[];
  readonly signatures: readonly Required<SignatureSpec>[];
  readonly grammar: Readonly<Required<LanguageGrammar>>;
  /** Prejoined tables passed directly to the MoonBit scanner. */
  readonly wire: Readonly<{
    keywords: string;
    types: string;
    constants: string;
    declarations: string;
    lineComments: string;
    blockComments: string;
    strings: string;
    operatorCharacters: string;
    identifierExtra: string;
  }>;
}

export interface ThemeSpec {
  readonly id: string;
  readonly name: string;
  readonly dark: boolean;
  readonly colors: Readonly<Record<Scope | "foreground" | "background" | "selection", string>>;
}

const UNIT = "\u001f";
const RECORD = "\u001e";
const IDENTIFIER = /^[a-z][a-z0-9-]*$/;
const COLOR = /^(#[0-9a-f]{3,8}|(?:oklch|rgb|hsl)a?\([^;]+\)|[a-z]+)$/i;

function unique(values: readonly string[], label: string): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} contains duplicates`);
  }
  return Object.freeze(normalized);
}

function delimiters(values: readonly DelimiterSpec[], label: string): readonly DelimiterSpec[] {
  return Object.freeze(
    values.map(({ open, close }) => {
      if (!open || !close) throw new Error(`${label} delimiters must be non-empty`);
      if (open.includes(UNIT) || close.includes(UNIT) || open.includes(RECORD) || close.includes(RECORD)) {
        throw new Error(`${label} contains a reserved separator`);
      }
      return Object.freeze({ open, close });
    }),
  );
}

/** Splits a readable declaration list without introducing a grammar DSL. */
export function words(source: string): readonly string[] {
  return Object.freeze(source.trim().split(/\s+/u).filter(Boolean));
}

/**
 * Validates and compiles a declarative language module.
 *
 * The returned object is deeply immutable and contains compact tables for the
 * MoonBit boundary. Invalid plugins fail during the extension build, never in
 * a user's browser.
 */
export function defineLanguage(spec: LanguageSpec): CompiledLanguage {
  if (!IDENTIFIER.test(spec.id)) throw new Error(`invalid language id: ${spec.id}`);
  if (!spec.name.trim()) throw new Error(`${spec.id}: name must be non-empty`);
  const aliases = unique([spec.id, ...(spec.aliases ?? [])].map((item) => item.toLowerCase()), `${spec.id}.aliases`);
  const extensions = unique(
    (spec.extensions ?? []).map((item) => item.replace(/^\./u, "").toLowerCase()),
    `${spec.id}.extensions`,
  );
  const filenames = unique(spec.filenames ?? [], `${spec.id}.filenames`);
  const signatures = Object.freeze(
    (spec.signatures ?? []).map(({ text, weight = 1 }) => {
      if (!text) throw new Error(`${spec.id}: signatures must be non-empty`);
      if (!Number.isSafeInteger(weight) || weight < 1) throw new Error(`${spec.id}: signature weight must be positive`);
      return Object.freeze({ text, weight });
    }),
  );
  const declarations = Object.freeze({ ...(spec.grammar.declarations ?? {}) });
  for (const [keyword, kind] of Object.entries(declarations)) {
    if (!keyword || keyword.includes(UNIT) || keyword.includes(":")) {
      throw new Error(`${spec.id}: invalid declaration keyword`);
    }
    if (!(["function", "type", "module", "variable", "property"] as const).includes(kind)) {
      throw new Error(`${spec.id}: invalid symbol kind ${kind as string}`);
    }
  }
  const grammar = Object.freeze({
    keywords: unique(spec.grammar.keywords ?? [], `${spec.id}.keywords`),
    types: unique(spec.grammar.types ?? [], `${spec.id}.types`),
    constants: unique(spec.grammar.constants ?? [], `${spec.id}.constants`),
    declarations,
    lineComments: unique(spec.grammar.lineComments ?? [], `${spec.id}.lineComments`),
    blockComments: delimiters(spec.grammar.blockComments ?? [], `${spec.id}.blockComments`),
    strings: delimiters(spec.grammar.strings ?? [], `${spec.id}.strings`),
    operatorCharacters: spec.grammar.operatorCharacters ?? "+-*/%=<>!&|^~?.",
    identifierExtra: spec.grammar.identifierExtra ?? "$",
  });
  const joinPairs = (items: readonly DelimiterSpec[]) => items.map(({ open, close }) => `${open}${RECORD}${close}`).join(UNIT);
  return Object.freeze({
    id: spec.id,
    name: spec.name,
    aliases,
    extensions,
    filenames,
    signatures,
    grammar,
    wire: Object.freeze({
      keywords: [...grammar.keywords].sort().join(UNIT),
      types: [...grammar.types].sort().join(UNIT),
      constants: [...grammar.constants].sort().join(UNIT),
      declarations: Object.entries(grammar.declarations).map(([word, kind]) => `${word}:${kind}`).join(UNIT),
      lineComments: grammar.lineComments.join(UNIT),
      blockComments: joinPairs(grammar.blockComments),
      strings: joinPairs(grammar.strings),
      operatorCharacters: grammar.operatorCharacters,
      identifierExtra: grammar.identifierExtra,
    }),
  });
}

/** Validates and freezes a theme add-on. */
export function defineTheme(spec: ThemeSpec): Readonly<ThemeSpec> {
  if (!IDENTIFIER.test(spec.id)) throw new Error(`invalid theme id: ${spec.id}`);
  for (const [name, color] of Object.entries(spec.colors)) {
    if (!COLOR.test(color)) throw new Error(`${spec.id}: invalid ${name} color`);
  }
  return Object.freeze({ ...spec, colors: Object.freeze({ ...spec.colors }) });
}
