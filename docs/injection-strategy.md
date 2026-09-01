# Injection Strategy

Web Highlighter treats hosted pages as untrusted rendering surfaces. The
algorithm is split into three deterministic phases so language accuracy and DOM
survival can evolve independently.

## 1. Surface extraction

Service adapters extract a normalized surface:

```text
Surface = source + language_hint + filename + ordered DOM segments
```

GitHub and GitLab line views are analyzed as one logical source and rendered
back into their original line cells. Discord and generic chat renderers usually
provide a single `pre > code` segment. This means language inference never
depends on a service selector, and DOM patching never depends on a language
vocabulary.

## 2. Evidence-based detection

MoonBit chooses a `DetectionPlan` with:

- selected compiled language;
- reason: explicit hint, exact filename, filename extension, or weighted evidence;
- winning score;
- runner-up score.

The precedence is:

1. exact language alias from a class or data attribute;
2. exact filename such as `moon.pkg`;
3. case-insensitive extension such as `.mbtp`, `.ush`, `.tnix`, `.vibe`, `.vpkg`,
   `.mbtv`, or `.veryl`;
4. weighted literal fingerprints only when metadata is gone.

Weighted inference is fail-closed. A language is selected only when the winning
score reaches the threshold and beats the runner-up by the configured margin.
Weak evidence and tied evidence return `None`, so the browser leaves the block
untouched.

Evidence scoring is one forward pass. Every catalog signature is compiled into a
first-code-unit index, so each source position only tests the signatures that
could start there instead of running one substring search per signature per
language. Adding a language therefore costs catalog bytes, not detection time.

## 3. Bounded scanning

Each selected language is compiled once into:

- exact-word lexeme map for keywords, types, constants, functions, properties,
  and declaration introducers;
- fixed ASCII codepoint tables for operators and identifier extras;
- indexed catalog maps for aliases, filenames, and extensions.

Scanning is one linear pass over UTF-16 code units plus a compact second pass
over deferred reference candidates. It builds no AST, runs no plugin callbacks,
and uses one exact-word lookup per identifier. The MoonBit analyzer budget caps
source units, emitted tokens, symbols, and deferred reference candidates.

## 4. Lossless injection

Rendering wraps only source slices returned by Wasm. It does not rewrite the
surrounding page chrome, copy buttons, line anchors, or message controls.

- GitHub: preserve `LC...` line cells and native line anchors.
- GitLab: preserve visible `LC...` cells and separate `L...` anchors.
- Discord: patch only the code node inside the message.

The host keeps a source fingerprint so SPA hydration and mutation bursts become
idempotent rescans instead of recursive rendering.

Injection is one forward sweep. DOM segments are ordered by construction and
tokens are ordered, non-empty, and non-overlapping by MoonBit invariant, so the
renderer advances one cursor through each list instead of re-filtering the token
list per line, and resolves definitions and references through span-keyed
indexes instead of searching the symbol tables per token. A blob with thousands
of lines therefore stays linear in the host, where the scanner already is.

## Proved Invariants

MoonBit proof mode covers the arithmetic behind the strategy:

- UTF-16 cursor advances remain bounded;
- emitted spans are non-empty, ordered, and in range;
- a token skipped or stopped at by the renderer sweep cannot cover the segment,
  and the same holds for every token before or after it, so one forward pass
  sees exactly what a full scan would;
- clipping a covering token to a segment stays inside the source, and stays
  non-empty for every non-empty segment;
- line-count and budget counters remain non-negative;
- optional output appends preserve configured limits;
- weighted evidence must be dominant before unlabelled inference can inject.
