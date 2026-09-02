<p align="center">
  <img src="assets/icons/icon-128.png" width="96" height="96" alt="Web Highlighter logo">
</p>

# Web Highlighter

**Web Highlighter is not a syntax-highlighting library.** It is a browser-side language-support injection layer for GitHub, GitLab, Discord, Slack, ChatGPT, Zenn, Qiita, and other pages that are unlikely to support your private, experimental, composite, or simply overlooked language upstream.

When a service renders an `mbtx`, `mbti`, `mbtp`, `vpkg`, `veryl`, `ush`, `tnix`, Flow `@flow` JavaScript, or a brand-new language as plain text, the extension detects that code, asks a tiny MoonBit/Wasm-GC engine for semantic spans and same-file symbols, then patches only the existing code nodes. The page stays in control of layout, selection, copying, and line anchors.

The product is deliberately opinionated:

- language detection, declarative grammars, compiled lexical indexes, tokenization, symbols, proved invariants, and themes live in MoonBit;
- browser JavaScript/TypeScript is only the WebExtension and DOM boundary;
- local add-ons are immutable MoonBit build-time data, never downloaded executable code;
- unknown, ambiguous, oversized, or unsupported input is left untouched;
- no source code leaves the browser.

## What works

- Manifest V3 builds for Chromium browsers, Firefox, and Safari Web Extensions.
- GitHub and GitLab blob lines with their native `LC…` nodes preserved, plus lexical hover and same-file jump-to-definition.
- Discord, Slack, ChatGPT, Zenn, Qiita, and ordinary `pre > code` blocks, including fenced aliases.
- Explicit aliases, filename extensions, special filenames, and conservative weighted inference when a service discards language metadata.
- Declarative MoonBit language and theme add-ons without TextMate/tmLanguage repositories, regex callbacks, `eval`, or remote code.
- Exact-word function and property vocabularies for small languages whose standard helpers matter as much as reserved words, with validation rejecting empty, duplicated, or cross-scope vocabulary.
- Idempotent SPA updates with strict per-pass browser limits plus MoonBit-owned
  source and output budgets so oversized files remain untouched or partially
  highlighted instead of stalling the page.

## Built-in injected support

The requested languages ship in the Wasm catalog:

Source lives under `src/builtin_languages*.mbt`: start at
`src/builtin_languages.mbt`, then edit the requested, curated, or notable group
file that owns the language.

- Idris 2 (`idris`, `idris2`, `.idr`, `.lidr`, `.ipkg`)
- Flow (`flow`, `flowtype`, `flow-js`, `flow-jsx`, `.js.flow`, and `.js`/`.jsx` sources with `@flow`)
- MoonBit (`moonbit`, `mbt`, `mbtx`, `mbti`, `mbtp`, `.mbt`, `.mbtx`, `.mbti`, `.mbtp`)
- [mizchi/vibe-lang](https://github.com/mizchi/vibe-lang) (`vibe`, `vpkg`, `.vibe`, `.vibex`, `.vpkg`)
- [ubugeeei-prod/tnix](https://github.com/ubugeeei-prod/tnix) (`tnix`, `.tnix`)
- [ubugeeei-prod/ush](https://github.com/ubugeeei-prod/ush) (`ush`, `.ush`)
- [ubugeeei-prod/vapor-moon](https://github.com/ubugeeei-prod/vapor-moon) (`mbtv`, `.mbtv`)

Veryl, Mojo, Gleam, Roc, Typst, Nushell, Lean 4, Koka, Nickel, Pkl, and Uiua are also built in.

A second group targets languages that GitHub, GitLab, Discord, Zenn, or Qiita still render as plain text, ordered by how widely known each language is:

| Language   | Aliases and files                  | Still unsupported by               |
| ---------- | ---------------------------------- | ---------------------------------- |
| Zig        | `zig`, `.zig`, `.zon`              | Discord, GitLab source view        |
| V          | `vlang`, `.vsh`, `.vv`, `v.mod`    | Qiita, GitLab diffs                |
| Just       | `just`, `justfile`, `.just`        | Discord, GitLab source view, Qiita |
| Carbon     | `carbon`, `.carbon`                | Discord, GitLab, Zenn, Qiita       |
| Slint      | `slint`, `.slint`                  | Discord, GitLab, Zenn, Qiita       |
| Odin       | `odin`, `.odin`                    | Qiita, GitLab diffs                |
| PureScript | `purescript`, `purs`, `.purs`      | Discord, GitLab source view, Qiita |
| ReScript   | `rescript`, `res`, `.res`, `.resi` | Discord, GitLab source view, Zenn  |

The order is notability, the selection is availability: every entry is missing from at least one of the five services checked. See [the research snapshot](docs/research.md) for the engine behind each service and how the gaps were measured.

## Size and speed

The release engine is a dependency-free Wasm-GC module. A local Apple-silicon run in the pinned Nix environment measured:

| Signal                             |   Measured |        CI budget |
| ---------------------------------- | ---------: | ---------------: |
| Content host + analyzer, Brotli    |   23.9 KiB |   at most 32 KiB |
| Wasm instantiate + first scan      |     4.9 ms |   at most 100 ms |
| Repeated 512 KiB MoonBit scan      | 10.5 MiB/s | at least 2 MiB/s |
| Unlabelled 256 KiB detection sweep | 32.6 MiB/s |                — |

These are reproducible budget signals, not universal hardware claims. Run `vpr tools:bench` for the current machine.

Detection cost does not grow with the catalog: every signature is compiled into one first-code-unit index, so unlabelled inference walks the source once instead of running one substring search per language.

## Development

The Nix flake pins MoonBit CLI `0.1.20260827` with compiler `0.10.11`, Why3 `1.8.2`, CVC5 `1.3.4`, Z3 `4.16.0`, Vite+ `0.3.0`, pnpm `11.9.0`, and Node.js `24.16.0`.

```sh
nix develop
vpr install
vpr verify
```

All project operations are exposed through `vpr`:

```sh
vpr ready        # builds and loads dist/chromium into a local Chromium browser
vpr check        # Oxfmt, Oxlint, and strict TypeScript checking
vpr moon:prove   # Formal verification for the proof-enabled MoonBit package
vpr moon:fuzz    # Deterministic MoonBit fuzz corpus over every built-in language
vpr test --run   # DOM and distribution tests
vpr build        # MoonBit Wasm-GC + all unpacked WebExtensions
vpr browser:smoke # launches the unpacked Chromium extension against fixtures
vpr firefox:lint # Mozilla submission validation
vpr tools:bench        # measured runtime budgets
vpr release:package      # reproducible store/source ZIP archives and SHA256SUMS
vpr verify       # MoonBit checks/tests + all checks above
```

### Documentation site

Docs are built with `@ox-content/vite-plugin@3.0.0-beta.0` and deployed to
Void. The production workflow uses GitHub OIDC, not a long-lived deploy token.

```sh
vpr docs:build
vpr docs:deploy
```

Read [Docs deployment](docs/deployment.md) for Void project variables and the
OIDC workflow shape.

### Chrome local install

```sh
nix develop
vpr ready
```

`vpr ready` builds `dist/chromium`, restarts its isolated Chrome profile, loads
the unpacked extension through Chrome's CDP pipe path, and opens a real GitHub
code page. Chrome 137+ removed command-line unpacked extension loading from
branded Chrome builds, so the `vpr ready` process must stay running while you
use the opened Chrome window. Set `WEB_HIGHLIGHTER_BROWSER=dia` or `chromium`
to force another Chromium browser, and set `WEB_HIGHLIGHTER_BROWSER_PROFILE` to
override the isolated profile location. GitHub, GitLab, Discord, Slack,
ChatGPT, and OpenAI Chat receive automatic host access from the generated
extension. Any other origin is requested explicitly from the popup. Existing
normal browser windows do not receive this unpacked extension automatically; use
the launched profile, or load `dist/chromium` from `chrome://extensions` in the
profile you normally use.

To force a clean Chrome repro for the GitHub page in this README:

```sh
WEB_HIGHLIGHTER_BROWSER=chrome vpr ready
```

For Dia:

```sh
WEB_HIGHLIGHTER_BROWSER=dia vpr ready
```

### Install from GitHub Releases

Download `web-highlighter-vVERSION-chrome-extension.zip` from the latest GitHub
Release, unzip it into a persistent local folder, open `chrome://extensions`,
enable Developer mode, choose **Load unpacked**, and select the unzipped folder
that contains `manifest.json`. Keep that folder in place; Chrome loads the
extension from it on each startup.

For updates, download the newer GitHub Release ZIP, replace the same folder,
then press reload for Web Highlighter on `chrome://extensions`. See
[GitHub install](docs/github-install.md) for checksum verification and the
Chrome Web Store boundary.

Firefox can temporarily load `dist/firefox/manifest.json`; Safari uses
`dist/safari` with `xcrun safari-web-extension-packager`.

## A declarative language add-on

A local add-on is ordinary MoonBit data exported from a normal package. It is
separate from the built-in catalog only by ownership: built-ins live in
`src/builtin_languages*.mbt`, while private or project-specific language
declarations live under `local_addons`. Both paths compile into the same Wasm
catalog and use the same validation, scanner, fuzz, and proof-backed invariants.
An add-on describes facts; it does not supply a tokenizer callback:

```moonbit
pub fn contribution() -> @highlight.Addon {
  @highlight.addon(
    languages=[
      @highlight.make_language(
        "my-lang",
        "My Language",
        ["myl"],
        ["myl"],
        [],
        [@highlight.signature("effect ", 2), @highlight.signature("module my.lang", 3)],
        "effect else fn if let match module return type",
        "Bool Int List Result String",
        "true false none",
        [("fn", @highlight.FunctionSymbol), ("type", @highlight.TypeSymbol)],
        ["//"],
        [@highlight.delimiter("/*", "*/")],
        [@highlight.quoted("\"")],
        "+-*/=<>!&|",
        "$",
        functions="print println",
        properties="std",
      ),
    ],
    themes=[],
  )
}
```

For a local language, create a package under `local_addons/<name>`, import it from
`runtime/analyzer/moon.pkg`, add `@name.contribution()` to `configured_addons` in
`runtime/analyzer/main.mbt`, then run `nix develop -c vpr ready`.

The package imports the core as `@highlight`; the thin analyzer entrypoint imports selected add-on packages and lists their contributions in `configured_addons`. A theme uses the equally declarative `theme(...)` constructor and stable semantic roles. See [Writing add-ons](docs/plugins.md).

## Architecture

```mermaid
flowchart LR
  D["MoonBit declarative add-ons"] --> W["tiny Wasm-GC engine"]
  W --> A["language + tokens + symbols + theme plan"]
  A --> B["minimal extension background bridge"]
  S["thin service DOM discovery"] --> H["TypeScript browser host"]
  B --> H
  H --> P["lossless injected spans, hover, jump"]
```

The Wasm engine never sees a DOM. It runs in the extension origin because that is the reliable Manifest V3 context for packaged Wasm-GC; the content host reaches it through a minimal message bridge. The browser host never contains language vocabulary or theme policy. Service discovery never parses source. This separation keeps syntax growth out of the extension shell and confines service DOM breakage to one small boundary.

Read [Architecture](docs/architecture.md) and [Service adapters](docs/services.md) for invariants and failure behavior.

## Honest navigation boundary

This is not an LSP hidden in every chat message. Declaration introducers such as `fn`, `type`, and `let` produce lexical symbols; references jump to the first same-surface definition. There is no claim of type-aware overload resolution, macro expansion, scope-perfect shadowing, or cross-repository navigation.

## Releases

Change `package.json` and `moon.mod` to the same new semantic version in a conventional pull request. After that pull request passes CI and merges, run **Actions → Release → Run workflow** on `main` (or `gh workflow run release.yml --ref main`). The workflow re-verifies the exact `main` commit, waits for approval in the protected `release` environment, creates an annotated tag, emits GitHub OIDC build-provenance attestations, and publishes the browser archives in a GitHub Release.

For the first release, a clean, synchronized local `main` can bootstrap the same tag-triggered workflow:

```sh
vpr release minor
```

The local task bumps both version files, runs the complete verification suite, creates a conventional release commit and annotated tag, then atomically pushes `main` and the tag. Both entry points create the GitHub Release without reading store credentials. Firefox and Edge credentials are isolated in the separately approved `store-publish` environment; Chrome uses short-lived OIDC instead.

To reconcile an existing release after an interrupted publication, run `gh workflow run release.yml --ref main -f tag=v0.1.0`. The workflow checks out that immutable tag, rebuilds and verifies every archive, and requires an exact byte-for-byte match with the published assets before succeeding.

Store submissions use the canonical [listing copy](publishing/browser-listings/listing.md), [reviewer notes](publishing/browser-listings/reviewer-notes.md), and [privacy policy](PRIVACY.md). The [browser-store publishing guide](docs/store-publishing.md) covers the protected workflow and each one-time account setup.

## License

MIT
