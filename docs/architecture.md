# Architecture

Web Highlighter is organized around one rule: service DOM, language analysis, and presentation must be independently replaceable.

## Layers

1. `plugins/` contains typed declarative data. Add-ons cannot touch the DOM or execute matcher callbacks.
2. `extension/src/plugin-api.ts` validates, normalizes, freezes, and compiles that data into compact wire tables.
3. `src/` is the MoonBit analysis kernel. A language table is compiled once to a handle; every source scan then returns ordered UTF-16 spans.
4. `extension/src/surfaces.ts` converts service-specific DOM into a service-neutral `CodeSurface`.
5. `extension/src/renderer.ts` applies spans without replacing GitHub line containers or changing source text.
6. `extension/src/navigation.ts` implements hover and same-file jump from the same analysis result.
7. `extension/src/engine.ts` owns scheduling, idempotence, source-size limits, and MutationObserver lifecycle.

## Core invariants

- Offsets are UTF-16 code units. They match JavaScript strings and browser text nodes without conversion.
- Tokens are ordered, non-empty, and non-overlapping.
- Service adapters never parse a language.
- Language definitions never query a page.
- Rendering is text-lossless: `textContent` before and after must match.
- Themes only update CSS variables and never run the analyzer.
- Every remote page is untrusted input. No source is evaluated, uploaded, or interpolated into CSS.
- Runtime work is bounded: 2 MiB per surface and 48 surfaces per scheduling pass.
- A repeated unchanged surface is skipped using a source-and-language fingerprint.

## Why MoonBit targets JavaScript

The scanner is written in MoonBit but compiled to JavaScript because current browser extension execution already pays the JavaScript startup cost. For this small allocation-sensitive kernel, the JS target avoids a separate Wasm fetch/instantiate path and ships as one bundle. The boundary is kept narrow (`compile_language_wire`, `analyze_handle_wire`) so a future Wasm or Wasm-GC target can be benchmarked without changing callers.

## Declarative rather than TextMate-shaped

TextMate grammars mix matching behavior, recursive repositories, and presentation-oriented scopes in a JSON-shaped regex DSL. Web Highlighter instead declares language vocabulary, lexical regions, declaration introducers, filenames, aliases, and literal detection signatures. The MoonBit engine decides how those declarations execute.

This is less expressive than a full parser today, deliberately. It gives three useful properties:

- deterministic validation before shipping;
- a single bounded execution model across every add-on;
- a stable path to parser-derived artifacts later.

The public result type—not the current scanner algorithm—is the architectural seam. A Monogram-like parser compiler can eventually derive the same semantic token and symbol spans.

## Navigation model

A declaration introducer such as `fn`, `type`, or `let` classifies the following identifier. The scanner indexes the first declaration of each name, then emits references for matching identifiers. The renderer attaches metadata only to emitted definition/reference spans.

This offers honest same-file navigation. It does not attempt lexical scope shadowing or semantic resolution. A plugin cannot accidentally make navigation slower than highlighting because both are generated in the same scan and merged linearly.

## Failure behavior

- Unknown language: leave the service rendering untouched.
- Ambiguous unlabeled block: leave it untouched unless signatures score at least two.
- Unterminated comment or string: consume to the end, never throw.
- Oversized surface: skip it rather than freezing the page.
- Repeated DOM mutation: coalesce through one idle callback.
- Changed service DOM: only that service discovery adapter should need repair.
