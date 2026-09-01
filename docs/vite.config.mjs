import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { oxContent, defineTheme, defaultTheme } from "@ox-content/vite-plugin";
import { defineConfig } from "vite";

const docsRoot = import.meta.dirname;
const projectRoot = resolve(docsRoot, "..");
const base = process.env.WEB_HIGHLIGHTER_DOCS_BASE ?? "/";
const siteUrl = process.env.WEB_HIGHLIGHTER_DOCS_SITE_URL ?? "https://web-highlighter.void.app";
const year = new Date().getFullYear();
const normalizedBase = base.endsWith("/") ? base : `${base}/`;
const docsIconBase = "assets/icons";
const docsIconSource = resolve(projectRoot, docsIconBase);
const docsOutput = resolve(projectRoot, "dist/docs");
const poimandresCodeTokens = {
  "syntax-attribute": "#add7ff",
  "syntax-builtin": "#91ddff",
  "syntax-comment": "#767c9d",
  "syntax-constant": "#fffac2",
  "syntax-deleted": "#d0679d",
  "syntax-function": "#91ddff",
  "syntax-heading": "#add7ff",
  "syntax-inserted": "#5de4c7",
  "syntax-keyword": "#5de4c7",
  "syntax-link": "#91ddff",
  "syntax-number": "#d0679d",
  "syntax-operator": "#89ddff",
  "syntax-property": "#add7ff",
  "syntax-punctuation": "#767c9d",
  "syntax-string": "#5de4c7",
  "syntax-tag": "#5de4c7",
  "syntax-text": "#a6accd",
  "syntax-type": "#add7ff",
  "syntax-variable": "#a6accd",
};
const editorialThemeCss = `
.header-title,
.header-nav a,
.sidebar,
.toc,
.pager,
.last-updated,
.ox-breadcrumbs {
  font-family: var(--octc-font-sans);
}

.header-title,
.header-nav a,
.content h1,
.content h2,
.content h3,
.content h4,
.content .ox-callout-title,
.content .ox-container-title,
.content .ox-container summary,
.content .ox-badge {
  letter-spacing: 0;
}

.header {
  gap: 1rem;
}

.header-title {
  flex: 0 0 auto;
}

.header-nav {
  min-width: 0;
}

.header-nav-list {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.header-nav-item a {
  color: var(--octc-color-text);
  white-space: nowrap;
}

.content {
  max-width: min(var(--octc-max-content-width), 74ch);
  font-family: var(--octc-font-editorial);
  font-size: 1.0625rem;
  line-height: 1.78;
}

.content h1,
.content h2,
.content h3,
.content h4 {
  font-family: var(--octc-font-sans);
  font-weight: 720;
}

.content h1 {
  max-width: 12ch;
  font-size: 2.75rem;
  line-height: 1.08;
}

.content h1::after {
  content: "";
  display: block;
  width: 4rem;
  height: 2px;
  margin-top: 1.15rem;
  background: var(--octc-color-primary);
}

.content h2 {
  border-bottom: 0;
  padding-bottom: 0;
}

.content h2::before {
  content: "";
  display: block;
  width: 2.25rem;
  height: 1px;
  margin-bottom: 0.85rem;
  background: color-mix(in srgb, var(--octc-color-primary) 72%, transparent);
}

.content p,
.content li {
  color: color-mix(in srgb, var(--octc-color-text) 92%, var(--octc-color-text-muted));
}

.content strong {
  color: var(--octc-color-text);
}

.content blockquote {
  font-style: italic;
}

.content pre,
.content code.ox-highlight-inline.ox-api-entry__signature--highlighted,
.content code.ox-highlight-inline.ox-api-module__signature--highlighted {
  box-shadow: 0 18px 48px color-mix(in srgb, #1b1e28 16%, transparent);
}

.content pre code {
  color: var(--octc-color-code-text);
}

.content table {
  border-radius: 6px;
}

@media (max-width: 760px) {
  .header {
    padding-inline: 1rem;
  }

  .header-nav {
    display: none;
  }

  .content {
    font-size: 1rem;
  }

  .content h1 {
    max-width: none;
    font-size: 2.2rem;
  }
}
`.trim();
const editorialTheme = defineTheme({
  name: "editorial",
  fonts: {
    sans: '"Inter", "Avenir Next", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    mono: '"Berkeley Mono", "IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
    named: {
      editorial: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    },
  },
  layout: {
    sidebarWidth: "272px",
    headerHeight: "62px",
    maxContentWidth: "1080px",
  },
  css: editorialThemeCss,
});
const poimandresTheme = defineTheme({
  name: "poimandres",
  colors: {
    primary: "#3f6f9f",
    primaryHover: "#2f5e8c",
    background: "#f7f8fb",
    backgroundAlt: "#eef2f8",
    text: "#222437",
    textMuted: "#66708a",
    border: "#d8deea",
    codeBackground: "#1b1e28",
    codeBackgroundTop: "#222637",
    codeText: "#a6accd",
  },
  darkColors: {
    primary: "#add7ff",
    primaryHover: "#91ddff",
    background: "#10131d",
    backgroundAlt: "#171b26",
    text: "#d7dbea",
    textMuted: "#8f98b7",
    border: "#2b3144",
    codeBackground: "#1b1e28",
    codeBackgroundTop: "#222637",
    codeText: "#a6accd",
  },
  tokens: poimandresCodeTokens,
  darkTokens: poimandresCodeTokens,
});
const docsTheme = defineTheme({
  name: "editorial-poimandres",
  aside: true,
  header: {
    logo: docsIconPath("icon.svg"),
    logoWidth: 28,
    logoHeight: 28,
  },
  nav: [
    { text: "Architecture", link: `${base}architecture/` },
    { text: "Add-ons", link: `${base}plugins/` },
    { text: "Deploy", link: `${base}deployment/` },
  ],
  sidebar: [
    {
      text: "Guide",
      items: [
        { text: "Overview", link: "/index.md" },
        { text: "Architecture", link: "/architecture.md" },
        { text: "Injection Strategy", link: "/injection-strategy.md" },
        { text: "Writing Add-ons", link: "/plugins.md" },
        { text: "Service Adapters", link: "/services.md" },
        { text: "Research Snapshot", link: "/research.md" },
      ],
    },
    {
      text: "Operations",
      items: [
        { text: "Docs Deployment", link: "/deployment.md" },
        { text: "Browser Store Publishing", link: "/store-publishing.md" },
      ],
    },
  ],
  footer: {
    message: 'Released under the <a href="https://opensource.org/licenses/MIT">MIT License</a>.',
    copyright: `Copyright (c) ${year} ubugeeei-prod`,
  },
});

function withBase(path) {
  return `${normalizedBase}${path.replace(/^\/+/u, "")}`;
}

function docsIconPath(file) {
  return withBase(`${docsIconBase}/${file}`);
}

const docsIconUrl = new URL(docsIconPath("icon-128.png"), siteUrl).href;
const docsIdentityHead = [
  `<link data-web-highlighter-docs-icon rel="icon" type="image/svg+xml" href="${docsIconPath("icon.svg")}" />`,
  `<link rel="icon" type="image/png" sizes="32x32" href="${docsIconPath("icon-32.png")}" />`,
  `<link rel="icon" type="image/png" sizes="16x16" href="${docsIconPath("icon-16.png")}" />`,
  `<link rel="apple-touch-icon" sizes="128x128" href="${docsIconPath("icon-128.png")}" />`,
  `<meta name="application-name" content="Web Highlighter" />`,
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f8fb" />`,
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1b1e28" />`,
].join("\n    ");

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
    }),
  );
  return files.flat();
}

function docsIdentityPlugin() {
  return {
    name: "web-highlighter-docs-identity",
    apply: "build",
    async closeBundle() {
      await cp(docsIconSource, resolve(docsOutput, docsIconBase), { force: true, recursive: true });
      const pages = await htmlFiles(docsOutput);
      if (pages.length === 0) throw new Error("docs build produced no HTML files");

      await Promise.all(
        pages.map(async (path) => {
          const html = await readFile(path, "utf8");
          const next = html.includes("data-web-highlighter-docs-icon")
            ? html
            : html.replace("</head>", `    ${docsIdentityHead}\n  </head>`);
          if (next === html && !html.includes("data-web-highlighter-docs-icon"))
            throw new Error(`docs page has no </head>: ${path}`);
          if (!next.includes(`href="${docsIconPath("icon.svg")}"`))
            throw new Error(`docs page is missing the SVG favicon: ${path}`);
          await writeFile(path, next);
        }),
      );
    },
  };
}

export default defineConfig({
  root: "docs",
  base,
  plugins: [
    oxContent({
      srcDir: ".",
      outDir: "../dist/docs",
      base,
      docs: false,
      highlight: true,
      siteMaps: true,
      publishState: true,
      redirects: true,
      ssg: {
        siteName: "Web Highlighter",
        siteUrl,
        ogImage: docsIconUrl,
        breadcrumbs: true,
        markdownSource: { copy: true },
        notFound: true,
        pageChrome: true,
        readerChrome: { backToTop: true },
        theme: [defaultTheme, editorialTheme, poimandresTheme, docsTheme],
      },
    }),
    docsIdentityPlugin(),
  ],
  server: {
    port: 4174,
  },
  preview: {
    port: 4174,
  },
  build: {
    outDir: "../dist/docs",
    emptyOutDir: true,
  },
});
