# Architecture

Web Highlighter is an injected-language-support product, not an embeddable highlighting library. Its primary architectural boundary is between product policy in MoonBit and unstable website DOMs in the browser host.

## Layers

1. `src/model.mbt` defines immutable language, compiled grammar, symbol, token, and theme data.
2. `src/compile.mbt` builds the lexeme, codepoint, alias, filename, and signature indexes once per catalog.
3. `src/contract.mbt` is the executable analysis oracle the scanner tests assert against.
4. `src/catalog.mbt` composes the built-in catalog from `src/languages_requested.mbt`, `src/languages_curated.mbt`, and `src/languages_notable.mbt`, one file per selection round.
5. Proof contracts are colocated with their owners: `src/cursor_contract/` for
   UTF-16 cursor motion, `src/scanner_contract/` for spans and output budgets,
   `src/model_contract/` for source budgets, `src/detection_contract/` for
   evidence dominance, and `src/sweep_contract/` for the segment algebra the
   renderer walks.
6. `src/detection.mbt` selects support by indexed hint, filename, extension, or dominant weighted literal evidence.
7. `src/cursor.mbt` holds the UTF-16 cursor and delimiter primitives; `src/scanner.mbt` performs one bounded lexical and symbol pass without constructing an AST.
8. `src/theme.mbt` selects a declarative theme and emits semantic-role colors.
9. `src/addon.mbt` composes add-on contributions; `src/validation.mbt` rejects malformed or ambiguous ones.
10. `src/wire.mbt` defines the compact tab-delimited protocol in an importable core library.
11. `cmd/analyzer` is the thin executable package that exports three Wasm-GC functions.
12. `extension/src/engine.ts` owns the Wasm instance in the extension origin.
13. `extension/src/surfaces.ts` discovers service DOM, `analysis.ts` decodes the wire plan and indexes it, `theme.ts` reads the page's theme, and `host.ts` renders spans and implements hover/jump.

The only runtime calls crossing the Wasm boundary are:

```text
analyze_request(source, language_hint, filename) -> language + spans + symbols
theme_wire(requested_theme, prefers_dark)        -> semantic CSS variables
themes_wire()                                    -> selectable theme metadata
```

## Core invariants

- Offsets are UTF-16 code units, matching browser strings and text nodes.
- Tokens are ordered, non-empty, and non-overlapping.
- Scanner cursor arithmetic, token span width, ordered append steps, region
  cursors, line-count arithmetic, analyzer budgets, and dominant evidence
  checks are proved in colocated `.mbtp` contracts beside the MoonBit source
  that owns each invariant.
- Language and theme add-ons are data without callbacks or DOM access.
- Declarative language tables compile once into exact-word and codepoint indexes before scanning.
- Service discovery contains no language vocabulary.
- Rendering retains the original source and preserves GitHub line containers.
- Rendering sweeps ordered segments against ordered tokens once and resolves
  symbols through span-keyed indexes, so a surface costs segments plus tokens
  plus symbols rather than segments times tokens. Skipping, stopping, and slice
  clipping are proved sound in `src/sweep_contract/contract.mbtp`.
- Theme changes never reparse source.
- Unknown and ambiguous blocks are left untouched.
- A browser pass is capped at 48 surfaces. The MoonBit analyzer also owns a
  2 MiB source budget plus token, symbol, and deferred-reference output budgets.
- Oversized sources are rejected by the Wasm boundary before language detection.
  Pathological output growth is capped by verified append predicates.
- Repeated unchanged surfaces are skipped by a source-and-language fingerprint.
- Runtime code contains no `eval`, `new Function`, remote script, or source upload.

## Why Wasm-GC

The extension should remain MoonBit-first as its language catalog grows. Wasm-GC with JavaScript string built-ins keeps the boundary direct: JavaScript passes source strings and receives a compact string plan, while vocabulary lookup, detection, scanning, definitions, references, and theme selection remain compiled MoonBit. The TypeScript host is deliberately limited to DOM discovery, size guards, message passing, and lossless span rendering.

The release analyzer is about 33 KiB raw and 14 KiB Brotli. The browser host and background bridge together remain only a few KiB compressed. Shipping one immutable analyzer is both smaller and safer than carrying a general parser framework plus separately executable grammar packages.

## Detection and injection strategy

Surface extraction and language detection are separate algorithms. GitHub,
GitLab, Discord, Slack, ChatGPT, and generic pages are normalized into the same
surface shape: source, optional hint, optional filename, and ordered DOM
segments. MoonBit then chooses a `DetectionPlan` by explicit hint, exact
filename, extension, or weighted evidence.

Unlabelled inference is fail-closed: the winning signature score must reach the
threshold and beat the runner-up by the configured margin. Ties, weak evidence,
and ordinary prose are not injected. See [Injection Strategy](./injection-strategy.md).

## Declarative rather than TextMate-shaped

TextMate grammars combine regular-expression behavior, recursive repositories, and presentation scopes in a JSON-shaped DSL. Here an add-on declares vocabulary, literal regions, declaration introducers, built-in functions, properties, aliases, filenames, and conservative signatures. The engine owns execution semantics.

Each declarative `Language` compiles to a `CompiledLanguage`: exact-word lexemes are merged into one lookup table, ASCII operator and identifier-extra characters become fixed membership tables, and a `CompiledCatalog` indexes aliases, filenames, and extensions. This keeps the authoring surface readable while making repeated SPA rescans independent from catalog size.

The executable scanner still remains deliberately small: UTF-16 advance,
ordered token append checks, and line-count arithmetic are verified directly
beside the scanner code that calls them, then every emitted analysis is tested
through the same executable predicates. That makes malformed spans and
overlapping tokens fail as core invariants, not only as service-rendering
accidents.

This narrower model gives predictable runtime cost and testable conflict rules. A Monogram-like parser compiler can later emit the same token and symbol plan without changing any service adapter.

## Failure behavior

- Unknown language: preserve upstream rendering.
- Ambiguous unlabelled block: require dominant weighted evidence.
- Unterminated comment or string: consume safely to the end.
- Wasm load or instantiate failure: report a bounded background error, remove the boot marker, and preserve the page.
- Oversized surface: skip it.
- Mutation storm: coalesce work through one idle callback.
- Changed service DOM: repair only discovery and its DOM contract tests.
