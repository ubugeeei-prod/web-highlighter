# Store listing copy

The copy below is the canonical source for Chrome Web Store, Microsoft Edge Add-ons, Firefox Add-ons, and Safari/App Store Connect fields. The product name is **Web Highlighter** and the category is **Developer Tools** where that category is available.

## English (United States)

### Summary

Inject lightweight language support into code hosts and chats that do not support your language.

### Description

Web Highlighter injects missing language support into code hosts and chat services. It is built for private, experimental, composite, and overlooked languages that GitHub, GitLab, Discord, Slack, ChatGPT, and similar services are unlikely to support upstream.

The extension detects code already present on a page and processes it locally with a small MoonBit/WebAssembly engine. It adds semantic colors, lexical hover information, and same-file jump-to-definition while preserving the page's own layout, line anchors, selection, and copy behavior. Unsupported or ambiguous code is left unchanged.

Built-in injected support includes Idris 2 and `.ipkg` files, MoonBit Executable (`mbtx`), vibe-lang, tnix, ush, mbtv, Mojo, Gleam, Roc, Typst, Nushell, Lean 4, Koka, Nickel, Pkl, and Uiua. Themes and declarative language add-ons are compiled into the extension; executable code is never downloaded.

Web Highlighter is not a general-purpose syntax-highlighting library and does not replace an editor or language server. Its single purpose is to supply a fast, lightweight browser-side compatibility layer where the website itself does not support a language. Code never leaves the browser, and the extension contains no analytics, ads, account system, or remote code.

### Single purpose

Inject local highlighting, lexical hover information, and same-file navigation for languages that the current code host or chat service does not support.

## Japanese

### Summary

未対応言語のハイライト・hover・同一ファイル内ジャンプを、コードホストやチャットへ軽量に注入します。

### Description

Web Highlighter は、コードホストやチャットサービスに欠けている言語サポートを外部から注入するブラウザ拡張です。GitHub、GitLab、Discord、Slack、ChatGPT などで今後も公式対応を期待しにくい、自作・実験的・複合的・見落とされている言語を対象にしています。

ページ上にすでに表示されているコードを検出し、小さな MoonBit/WebAssembly エンジンで端末内処理します。ページ自身のレイアウト、行アンカー、選択、コピー動作を保ったまま、意味に沿った色、字句的な hover 情報、同一ファイル内の定義ジャンプを追加します。未対応または判定が曖昧なコードは変更しません。

Idris 2 と `.ipkg`、MoonBit Executable (`mbtx`)、vibe-lang、tnix、ush、mbtv のほか、Mojo、Gleam、Roc、Typst、Nushell、Lean 4、Koka、Nickel、Pkl、Uiua をビルトインで扱います。テーマと言語アドオンは宣言的データとして拡張本体へコンパイルされ、実行コードを外部からダウンロードしません。

これは汎用シンタックスハイライトライブラリでも、エディタや言語サーバーの代替でもありません。サイト側で言語対応がない場面を補う、高速で軽量なブラウザ内互換レイヤーです。コードがブラウザの外へ送られることはなく、解析、広告、アカウント、リモートコードもありません。

### Single purpose

現在のコードホストやチャットサービスが対応していない言語へ、端末内のハイライト、字句的 hover 情報、同一ファイル内ナビゲーションを注入します。

## Permission justifications

| Permission                                          | Store justification                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `storage`                                           | Stores only the user's selected theme through the browser synchronization API.                                    |
| Supported-service host access                       | Finds and decorates code on GitHub, GitLab, Discord, Slack, and ChatGPT without requiring a click on every visit. |
| `activeTab`                                         | Reads the active tab only after the user opens the popup to enable another site.                                  |
| `scripting`                                         | Injects the packaged content script and stylesheet after the user grants access to another site.                  |
| Optional `http://*/*` and `https://*/*` host access | Lets the user opt in one additional origin at a time; no optional origin is granted automatically.                |

## Data and code declarations

- Data collection: none.
- Data sale or sharing: none.
- Remote code: none. JavaScript, CSS, themes, language definitions, and Wasm are packaged with the extension.
- Authentication or paid features: none.
- Privacy policy: `https://github.com/ubugeeei-prod/web-highlighter/blob/main/PRIVACY.md`
- Support: `https://github.com/ubugeeei-prod/web-highlighter/issues`
- Homepage: `https://github.com/ubugeeei-prod/web-highlighter`
