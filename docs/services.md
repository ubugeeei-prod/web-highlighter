# Service adapters

The browser host produces the same internal surface shape for every service: source, language hint, optional filename, and one or more DOM segments. Language decisions remain in MoonBit.

| Service      | Discovery                                           | Language signal                                          | Rendering constraint                            |
| ------------ | --------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| GitHub       | current blob line cells plus ordinary fenced blocks | filename first                                           | preserve each `#LC…` line cell and line anchor  |
| Discord      | `pre > code`                                        | `language-*` class, then signatures                      | preserve message controls outside the code node |
| Slack        | `pre > code` and language metadata                  | data attributes, then signatures                         | preserve message and thread containers          |
| ChatGPT      | `pre > code` and language metadata                  | language class/data attribute, then signatures           | preserve copy buttons and code-block chrome     |
| Generic site | code-shaped `pre` nodes only                        | class/data attribute, filename when supplied, signatures | never recolor prose merely containing keywords  |

## SPA updates

The host observes subtree changes, coalesces them into an idle callback, and then performs idempotent discovery. It stores the original source on each code element. A fingerprint prevents injected spans from recursively triggering another render.

## GitHub navigation

GitHub currently renders visible blob text in line cells with `data-testid="code-cell"` and stable `LC…` IDs. The adapter analyzes all lines as one source while rendering tokens back into each original line cell. This preserves native line links, selection, copy behavior, and virtualized layout.

The selector set also contains older blob table and React line variants. DOM contract tests cover each supported shape, and live verification should be repeated when GitHub changes its file renderer.

## Optional sites

The manifest only grants automatic host access to the four supported services. The popup can request one explicit origin at a time for a generic site and inject both the content script and stylesheet. No global optional permission is activated without a user gesture.
