# Install from GitHub

GitHub Releases publish a Chrome-ready ZIP named
`web-highlighter-vVERSION-chrome-extension.zip`. It is the same reviewed
Manifest V3 Chromium bundle used for the Chrome Web Store upload, but named for
manual GitHub distribution.

## Install

1. Open the latest GitHub Release for this repository.
2. Download `web-highlighter-vVERSION-chrome-extension.zip` and `SHA256SUMS`.
3. Verify the ZIP when possible:

   ```sh
   sha256sum --check SHA256SUMS --ignore-missing
   ```

   On macOS without GNU coreutils:

   ```sh
   shasum -a 256 web-highlighter-vVERSION-chrome-extension.zip
   ```

   Compare the printed digest with the matching line in `SHA256SUMS`.

4. Unzip the archive into a persistent folder such as
   `~/Applications/web-highlighter`.
5. Open `chrome://extensions`.
6. Enable Developer mode.
7. Choose **Load unpacked** and select the unzipped folder that contains
   `manifest.json`.
8. Open a supported page such as GitHub, GitLab, or Discord and reload it if the
   tab was already open.

## Update

1. Download the newer `web-highlighter-vVERSION-chrome-extension.zip`.
2. Replace the contents of the same folder used during installation.
3. Open `chrome://extensions` and press reload on Web Highlighter.

## Boundary

Chrome's documented non-Web-Store self-hosted installation path is Linux-only.
For regular macOS and Windows users, GitHub distribution therefore uses Chrome's
documented local unpacked-extension flow. The release workflow still also
produces `web-highlighter-vVERSION-chrome-web-store.zip` for Chrome Web Store
submission.

References:

- [Chrome self-hosting for Linux](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux)
- [Chrome alternative installation methods](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)
