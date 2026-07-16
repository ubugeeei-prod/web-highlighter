# Language support research

Research snapshot: 2026-07-16.

The goal was not to maximize a language count. It was to identify languages that are actively used yet are missing from one or more common web highlighting paths, then keep each built-in small enough to ship by default.

## Sources and decision method

- GitHub documents that repository language detection and syntax highlighting use [GitHub Linguist](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-repository-languages).
- GitHub's native code navigation supports a deliberately smaller language set and is based on tree-sitter; the official list does not include any requested custom language, Idris, MoonBit, Mojo, Gleam, Roc, Typst, Nushell, Lean, Koka, Nickel, Pkl, or Uiua. See [Navigating code on GitHub](https://docs.github.com/en/repositories/working-with-files/using-files/navigating-code-on-github).
- Highlight.js notes that only roughly forty common languages are in its default web build and many listed languages require separate third-party packages. See [Supported Languages](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md).
- The current Prism component catalog was checked directly in [Prism's repository](https://github.com/PrismJS/prism/blob/v2/src/components.json).
- Open GitHub Linguist requests included Uiua and other languages as of the snapshot, demonstrating that the hosted-language queue continues to lag new and niche languages. See [Linguist issues](https://github.com/github-linguist/linguist/issues).
- Johnson Chu's [Monogram](https://github.com/johnsoncodehk/monogram) established the key design direction: one executable grammar model that can produce parser and highlighting artifacts instead of maintaining a standalone TextMate regex pile.

## Built-in selection

| Language | Reason for inclusion |
|---|---|
| Idris 2 | explicitly requested; absent from GitHub native navigation; inconsistent web bundles |
| MoonBit / mbtx | explicitly requested; young language; executable-script alias is frequently lost |
| Vibe | explicitly requested experimental language with `.vibe` sources |
| tNix | explicitly requested custom typed Nix language |
| ush | explicitly requested custom shell language |
| mbtv | explicitly requested custom MoonBit SFC format |
| Mojo | visible developer interest, but absent from the checked default/common highlighter paths |
| Gleam | growing ecosystem; support often depends on an optional package rather than default bundles |
| Roc | experimental functional language with recurring unsupported fences |
| Typst | widely shared in technical chat, but absent from the checked default/common bundles |
| Nushell | popular modern shell whose `nu` blocks are commonly treated as plain text |
| Lean 4 | theorem-proving snippets are common in research discussion; no GitHub native navigation |
| Koka | effect language with sparse hosted-service support |
| Nickel | configuration language often misidentified as Nix or plain text |
| Pkl | configuration language; support varies and is not universal across services |
| Uiua | active Linguist add-language request at the snapshot date |

## Important limitation

This investigation compares availability, not language popularity rankings. No credible cross-service telemetry was found that measures how often users paste each unsupported language. The built-in list is therefore a curated, evidence-backed starting point, not a claim that these are objectively the sixteen most demanded languages.

Language ecosystems and hosted-service support change quickly. Re-run the catalog checks before using this snapshot to make a future support claim.
