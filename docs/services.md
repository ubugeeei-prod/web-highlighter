# Service adapters

The browser host produces the same internal surface shape for every service:
source, language hint, optional filename, and one or more DOM segments. Language
decisions remain in MoonBit and use the evidence strategy documented in
[Injection Strategy](./injection-strategy.md).

| Service      | Discovery                                                           | Language signal                                          | Rendering constraint                            |
| ------------ | ------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| GitHub       | blob line cells, PR diff files, and ordinary fenced blocks          | filename first                                           | preserve each `#LC…` line cell and line anchor  |
| GitLab       | visible blob lines, MR diff files, and plain-source overlays        | filename first                                           | preserve `#LC…` lines and `#L…` anchors         |
| Discord      | `pre code`, CSS-module code nodes, `.hljs`, and code text fallbacks | language class/data attribute, then dominant signatures  | preserve message controls outside the code node |
| Slack        | `pre > code` and language metadata                                  | data attributes, then signatures                         | preserve message and thread containers          |
| ChatGPT      | `pre > code` and language metadata                                  | language class/data attribute, then signatures           | preserve copy buttons and code-block chrome     |
| Generic site | code-shaped `pre` nodes only                                        | class/data attribute, filename when supplied, signatures | never recolor prose merely containing keywords  |

## Startup and SPA updates

The host observes subtree changes, coalesces them into an idle callback, and
then performs idempotent discovery. It also runs a short startup scan ladder so
GitHub, GitLab, and Discord code that appears after the content script starts
is still picked up without a manual theme change. A cold background service
worker or Wasm startup failure does not stop the observer; transient analysis
failures are retried with bounded backoff.

The original source is stored on each code element. A fingerprint prevents
injected spans from recursively triggering another render. In automatic theme
mode, every highlight pass re-checks the page's visible background and root
theme hints before rendering, so dark Discord/GitHub views do not depend on a
later popup theme change to become visible.

## GitHub navigation

GitHub currently renders visible blob text in line cells with `data-testid="code-cell"` and stable `LC…` IDs. The adapter analyzes all lines as one source while rendering tokens back into each original line cell. Pull request diff rows are grouped per file container and pass that file path into MoonBit, so filename fallback still works when GitHub does not expose a language class. This preserves native line links, selection, copy behavior, and virtualized layout.

The selector set also contains older blob table and React line variants. DOM contract tests cover each supported shape, and live verification should be repeated when GitHub changes its file renderer.

## GitLab blobs

GitLab renders a transparent plain-source `code[data-testid="content"]` overlay followed by the visible `#LC…` line nodes. The adapter only patches those visible line nodes, leaving the overlay and separate `#L…` anchors intact. Merge request diff rows are grouped per file container before analysis. The same DOM signatures also work on self-managed GitLab instances after the user grants that origin from the popup.

## Discord messages

Discord exposes code blocks through both ordinary `pre code` nodes and
CSS-module containers such as `codeContainer...`, `codeBlock...`, and
`codeBlockText...`. The adapter patches only the code-bearing node, so
reactions, copy affordances, message menus, and thread UI remain owned by
Discord. When the class or wrapper metadata contains a supported alias such as
`language-mbtp`, `hljs mbtp`, or `data-code-lang="mbtp"`, MoonBit treats it as
explicit evidence. Without that metadata, weighted inference must be dominant or
the block is left as Discord rendered it.

Discord can re-render a code block after an interaction, replacing the injected
tokens with its original plain text. The host still observes subtree mutations,
but Discord also gets an interaction recovery path: code-block clicks, pointer
ups, focus changes, and keyboard activation schedule a few short delayed
highlights so React rollbacks converge back to the highlighted state.

## Optional sites

The manifest only grants automatic host access to the listed supported services. The popup can request one explicit origin at a time for a generic site and inject both the content script and stylesheet. No global optional permission is activated without a user gesture.
