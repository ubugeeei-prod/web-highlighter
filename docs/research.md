# Language support research

Research snapshot: 2026-09-01. It supersedes the 2026-07-16 snapshot kept below.

The goal was not to maximize a language count. It was to identify languages that are actively used yet are missing from one or more common web highlighting paths, then keep each built-in small enough to ship by default.

## Which engine each service actually runs

Support is a property of the highlighting engine, not of the site, so the gap
analysis starts from the engines. All five were checked directly on the dates
below rather than from documentation summaries.

| Service | Engine                                              | List used                                                       |
| ------- | --------------------------------------------------- | --------------------------------------------------------------- |
| GitHub  | Linguist                                            | `lib/linguist/languages.yml`, 833 languages                      |
| GitLab  | highlight.js in the source viewer, Rouge on the back end | `SUPPORTED_LANGUAGES.md` bundled rows, 379 aliases; 234 Rouge lexers |
| Discord | highlight.js                                        | same bundled highlight.js rows                                   |
| Zenn    | Shiki, `bundledLanguages`                           | `packages/shiki/src/langs-bundle-full.ts`, 343 ids and aliases    |
| Qiita   | Rouge                                               | `lib/rouge/lexers`, 234 lexers                                   |

Two findings changed the previous snapshot:

- Zenn no longer uses Prism. `zenn-markdown-html` depends on Shiki and loads
  `bundledLanguages` on demand, which closed several gaps the earlier snapshot
  listed and opened different ones.
- Zenn discards the fence language for anything Shiki cannot load: the block is
  rendered as `text`, so the language name never reaches the DOM. Qiita keeps it
  in `data-lang` on the code frame, so an explicit hint still survives there.
  The browser host therefore relies on weighted evidence for Zenn and on
  metadata for Qiita.

## Selection method

1. Take each engine's own language list, including aliases.
2. Score a candidate as unsupported by a service when none of its names appear
   in that service's engine list.
3. Keep candidates missing from at least one of the five services.
4. Order what remains by notability, using GitHub stars of the language's own
   repository as the only cross-language proxy that could be measured
   consistently on 2026-09-01.

## Added in this snapshot

| Language   | Stars  | Unsupported by                       |
| ---------- | -----: | ------------------------------------ |
| Zig        | 43,311 | Discord, GitLab source viewer        |
| V          | 37,806 | Qiita, GitLab diffs                  |
| Just       | 35,560 | Discord, GitLab source viewer, Qiita |
| Carbon     | 33,867 | Discord, GitLab, Zenn, Qiita         |
| Slint      | 23,650 | Discord, GitLab, Zenn, Qiita         |
| Odin       | 11,829 | Qiita, GitLab diffs                  |
| PureScript |  8,902 | Discord, GitLab source viewer, Qiita |
| ReScript   |  7,434 | Discord, GitLab source viewer, Zenn  |

Vocabularies were taken from each language's own lexer or grammar rather than
from memory: Zig `lib/std/zig/tokenizer.zig`, V `vlib/v/token/token.v`, Just
`src/keyword.rs`, Carbon `toolchain/lex/token_kind.def`, Odin
`core/odin/tokenizer/token.odin`, and the Slint VS Code TextMate grammar.

`v` and `res` show why aliases stay conservative. GitHub reads a bare ```` ```v ````
fence as Verilog, so V is registered as `vlang` and claims only `.vsh`, `.vv`,
and `v.mod`; a `.v` file is left to whichever language owns it upstream. V code
in an unlabelled block is still detected by weighted evidence.

## Next candidates

Unison (6,720 stars) and CUE (6,243) are unsupported by every one of the five
services and are the next entries if the size budget allows. Grain, Dhall,
Starlark, Hare, and Slint-adjacent DSLs remain unsupported everywhere but are an
order of magnitude less widely known.

## Cost

Eight languages and the new signature index together cost 9.0 KiB of raw Wasm
and 2.9 KiB Brotli, which leaves the release runtime at 23.6 KiB against the
32 KiB budget. The index itself is 0.3 KiB of that and makes detection
independent of catalog size, so these entries do not slow unlabelled inference
down: an unlabelled 256 KiB block went from 51.6 ms to 7.7 ms per pass.

---

# Previous snapshot (2026-07-16)

Research snapshot: 2026-07-16.

## Sources and decision method

- GitHub documents that repository language detection and syntax highlighting use [GitHub Linguist](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-repository-languages).
- GitHub's native code navigation supports a deliberately smaller language set and is based on tree-sitter; the official list does not include any requested custom language, Idris, MoonBit, Veryl, Mojo, Gleam, Roc, Typst, Nushell, Lean, Koka, Nickel, Pkl, or Uiua. See [Navigating code on GitHub](https://docs.github.com/en/repositories/working-with-files/using-files/navigating-code-on-github).
- Highlight.js notes that only roughly forty common languages are in its default web build and many listed languages require separate third-party packages. See [Supported Languages](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md).
- The current Prism component catalog was checked directly in [Prism's repository](https://github.com/PrismJS/prism/blob/v2/src/components.json).
- Open GitHub Linguist requests included Uiua and other languages as of the snapshot, demonstrating that the hosted-language queue continues to lag new and niche languages. See [Linguist issues](https://github.com/github-linguist/linguist/issues).
- Veryl's official site identifies it as a modern hardware description language based on SystemVerilog and documents `.veryl` source examples. See [Veryl](https://veryl-lang.org/).
- Johnson Chu's [Monogram](https://github.com/johnsoncodehk/monogram) established the key design direction: one executable grammar model that can produce parser and highlighting artifacts instead of maintaining a standalone TextMate regex pile.

## Built-in selection

| Language      | Reason for inclusion                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| Idris 2       | explicitly requested; absent from GitHub native navigation; inconsistent web bundles        |
| MoonBit files | explicitly requested; young language; executable/interface/proof aliases are often lost     |
| Vibe          | explicitly requested experimental language with `.vibe` and `.vpkg` sources                 |
| tNix          | explicitly requested custom typed Nix language                                              |
| ush           | explicitly requested custom shell language                                                  |
| mbtv          | explicitly requested custom MoonBit SFC format                                              |
| Veryl         | modern HDL with active development and recurring hosted-service highlighting gaps           |
| Mojo          | visible developer interest, but absent from the checked default/common highlighter paths    |
| Gleam         | growing ecosystem; support often depends on an optional package rather than default bundles |
| Roc           | experimental functional language with recurring unsupported fences                          |
| Typst         | widely shared in technical chat, but absent from the checked default/common bundles         |
| Nushell       | popular modern shell whose `nu` blocks are commonly treated as plain text                   |
| Lean 4        | theorem-proving snippets are common in research discussion; no GitHub native navigation     |
| Koka          | effect language with sparse hosted-service support                                          |
| Nickel        | configuration language often misidentified as Nix or plain text                             |
| Pkl           | configuration language; support varies and is not universal across services                 |
| Uiua          | active Linguist add-language request at the snapshot date                                   |

## Important limitation

This investigation compares availability, not language popularity rankings. No credible cross-service telemetry was found that measures how often users paste each unsupported language. The built-in list is therefore a curated, evidence-backed starting point, not a claim that these are objectively the seventeen most demanded languages.

Language ecosystems and hosted-service support change quickly. Re-run the catalog checks before using this snapshot to make a future support claim.
