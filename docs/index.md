# Web Highlighter

Web Highlighter injects semantic syntax support into hosted code views that do
not natively understand small, private, or experimental languages.

The analyzer core is MoonBit compiled to Wasm-GC. Declarative MoonBit language
definitions describe aliases, extensions, lexical regions, exact-word
vocabulary, declarations, and themes. The browser layer only discovers code
surfaces and applies the token plan returned by Wasm.

## Supported surfaces

- GitHub repository blobs and pull request code views
- GitLab repository blobs and merge request diffs
- Discord, Slack, ChatGPT, and ordinary `pre > code` blocks
- Local and GitHub Release Chrome extension installs
- Build-time add-ons for private or self-authored languages

## Built-in language targets

- MoonBit: `moonbit`, `mbt`, `mbtx`, `mbti`, `mbtp`
- `ubugeeei-prod/ush`
- `ubugeeei-prod/tnix`
- `ubugeeei-prod/vapor-moon`
- `mizchi/vibe-lang`: `vibe`, `vpkg`
- Veryl
- Idris 2, Mojo, Gleam, Roc, Typst, Nushell, Lean 4, Koka, Nickel, Pkl, and Uiua

## Sample code

These are the kinds of fenced blocks Web Highlighter is built to recover on
services that would otherwise show plain text.

```moonbit
pub fn theme_wire(requested : String, prefers_dark : Bool) -> String {
  @core.theme_catalog_wire(theme_catalog, requested, prefers_dark)
}
```

```veryl
module DataSelector #(param Width: u32 = 8) (
  i_clk: input clock,
  i_rst: input reset,
  i_data: input logic<Width>,
  o_data: output logic<Width>,
) {
  always_ff (i_clk, i_rst) {
    if_reset {
      o_data = 0;
    } else {
      o_data = i_data;
    }
  }
}
```

```ush-shell
std::env::get("HOME") | len | print
```

## Engineering shape

- MoonBit owns detection, compiled lexical indexes, scanning, symbol discovery,
  theme serialization, resource budgets, and proof-backed span arithmetic.
- Add-ons export immutable data; no remote plugin code or regex callback runs
  inside the browser.
- Oversized input and pathological output growth are rejected or capped by the
  Wasm analyzer budget.
- GitHub Actions builds the docs with Ox Content v3 beta and deploys with Void
  through GitHub OIDC.

## Start here

- [Architecture](./architecture.md)
- [Injection strategy](./injection-strategy.md)
- [Writing add-ons](./plugins.md)
- [Service adapters](./services.md)
- [Install from GitHub](./github-install.md)
- [Docs deployment](./deployment.md)
