# Reviewer notes

## Purpose and test account

Web Highlighter has one purpose: add local language support where a code host or chat service renders an unsupported language without useful highlighting or navigation. No account, payment, server, or special test credentials are required.

## Manual verification

1. Install the submitted extension package.
2. Open `https://github.com/ubugeeei-prod/ush/blob/16690ef8e20d64836024505971d4f45384c93207/examples/control_flow.ush`.
3. Confirm that the `.ush` source receives semantic colors after the page settles.
4. Hover a recognized declaration and confirm that a local symbol tooltip appears.
5. Activate a reference to a same-file symbol and confirm that the corresponding definition is focused.
6. Select and copy code and confirm that the copied text is unchanged.
7. Open the extension popup, change the theme, and confirm that the page updates.

The extension intentionally leaves unsupported, ambiguous, empty, and oversized code unchanged. Navigation is lexical and same-file only; it is not an LSP or type-aware cross-repository navigation service.

## Permissions

Automatic host access is limited to GitHub, GitLab, Discord, Slack, and ChatGPT. On another HTTP or HTTPS site, the extension requests that single origin only after the reviewer selects **Enable on this site** in the popup. `activeTab` and `scripting` perform that explicit injection. `storage` stores only the selected theme.

## Local processing and remote code

Visible code text, a language hint, and a filename are passed from the content script to the packaged MoonBit/Wasm-GC analyzer in the extension origin. No source text or browsing data is sent over the network. There is no analytics endpoint, developer backend, advertisement, account system, dynamically loaded script, `eval`, or remotely downloaded language/theme definition. The only `fetch` loads the packaged `analyzer.wasm` through `runtime.getURL`.

The extension page CSP includes `wasm-unsafe-eval` only so the packaged Wasm module can be instantiated. It does not permit or retrieve remote executable code.

## Reproducible build

The submitted JavaScript is minified by Vite+ and the Wasm-GC module is compiled from MoonBit. The accompanying source archive contains the complete sources, exact lockfiles, Nix development environment, tests, and build scripts.

From the source root:

```sh
nix develop
vp install --frozen-lockfile
vp run verify
vp run package
```

`vp run verify` checks and tests MoonBit, formats/lints/type-checks JavaScript and TypeScript, builds each browser distribution, runs Firefox's add-on linter, tests the distribution contract, and enforces runtime budgets. `vp run package` creates the submission archives and checksums.
