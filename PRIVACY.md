# Web Highlighter Privacy Policy

Effective: July 17, 2026

Web Highlighter has one purpose: inject local language support into code shown by websites that do not provide that support themselves.

## Data handled on your device

To provide highlighting, lexical hover information, and same-file navigation, the extension reads code text already visible in supported pages. It may also read a language label, filename, and the current page path to identify that code. This information is processed transiently by the extension's packaged MoonBit/WebAssembly engine on your device.

The extension stores your selected theme through the browser's `storage.sync` API. Depending on your browser settings, the browser vendor may synchronize that preference with your browser account. Web Highlighter's developer does not operate or receive that synchronization data.

Host access that you explicitly grant from the popup is retained and managed by your browser as an extension permission.

## Data not collected

Web Highlighter does not send code, page contents, browsing history, page URLs, filenames, theme preferences, or permission choices to the developer or to any third party. It has no developer-operated backend, analytics, advertising, account system, telemetry, or remote executable code.

The extension does not sell, share, or use personal data for advertising, profiling, credit decisions, or any purpose unrelated to its single purpose.

## Retention and deletion

Code and page metadata are kept only in extension memory for the time needed to analyze and decorate the current page. They are not retained by the developer. You can delete the stored theme preference and permission grants by removing the extension or clearing its extension data in your browser.

## Permissions

- `storage` stores the selected theme.
- Access to GitHub, GitLab, Discord, Slack, and ChatGPT lets the extension find and decorate code on those services.
- `activeTab` and `scripting` let you enable the extension from its popup on another site only after an explicit action.
- Optional `http` and `https` host access is requested per site and only when you choose to enable that site.

## Changes and contact

Material changes to this policy will be committed to this repository with a new effective date. Questions and privacy requests can be filed through [GitHub Issues](https://github.com/ubugeeei-prod/web-highlighter/issues).
