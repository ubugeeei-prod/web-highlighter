# Architecture

Web Highlighter is an injected-language-support product, not an embeddable highlighting library. Its primary architectural boundary is between product policy in MoonBit and unstable website DOMs in the browser host.

## Layers

1. `src/model.mbt` defines immutable language, grammar, symbol, token, and theme data.
2. `src/catalog.mbt` is the declarative built-in support catalog.
3. `src/detection.mbt` selects support by hint, filename, or weighted literal evidence.
4. `src/scanner.mbt` performs one bounded lexical and symbol pass without constructing an AST.
5. `src/theme.mbt` selects a declarative theme and emits semantic-role colors.
6. `src/wire.mbt` exposes two Wasm-GC functions over a compact tab-delimited protocol.
7. `extension/src/engine.ts` owns the Wasm instance in the extension origin.
8. `extension/src/host.ts` discovers service DOM, renders spans, and implements hover/jump.

The only runtime calls crossing the Wasm boundary are:

```text
analyze_request(source, language_hint, filename) -> language + spans + symbols
theme_wire(requested_theme, prefers_dark)        -> semantic CSS variables
```

## Core invariants

- Offsets are UTF-16 code units, matching browser strings and text nodes.
- Tokens are ordered, non-empty, and non-overlapping.
- Language and theme add-ons are data without callbacks or DOM access.
- Service discovery contains no language vocabulary.
- Rendering retains the original source and preserves GitHub line containers.
- Theme changes never reparse source.
- Unknown and ambiguous blocks are left untouched.
- A surface is capped at 2 MiB; one pass is capped at 48 surfaces.
- Repeated unchanged surfaces are skipped by a source-and-language fingerprint.
- Runtime code contains no `eval`, `new Function`, remote script, or source upload.

## Why Wasm-GC

The extension should remain MoonBit-first as its language catalog grows. Wasm-GC with JavaScript string built-ins keeps the boundary direct: JavaScript passes source strings and receives a compact string plan, while vocabulary lookup, detection, scanning, definitions, references, and theme selection remain compiled MoonBit.

The release analyzer is about 33 KiB raw and 14 KiB Brotli. The browser host and background bridge together remain only a few KiB compressed. Shipping one immutable analyzer is both smaller and safer than carrying a general parser framework plus separately executable grammar packages.

## Declarative rather than TextMate-shaped

TextMate grammars combine regular-expression behavior, recursive repositories, and presentation scopes in a JSON-shaped DSL. Here an add-on declares vocabulary, literal regions, declaration introducers, aliases, filenames, and conservative signatures. The engine owns execution semantics.

This narrower model gives predictable runtime cost, testable conflict rules, and a clean future seam. A Monogram-like parser compiler can later emit the same token and symbol plan without changing any service adapter.

## Failure behavior

- Unknown language: preserve upstream rendering.
- Ambiguous unlabelled block: require weighted evidence above one.
- Unterminated comment or string: consume safely to the end.
- Wasm load or instantiate failure: report a bounded background error, remove the boot marker, and preserve the page.
- Oversized surface: skip it.
- Mutation storm: coalesce work through one idle callback.
- Changed service DOM: repair only discovery and its DOM contract tests.
