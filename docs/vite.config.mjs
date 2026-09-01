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
  `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0d1117" />`,
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
        theme: defineTheme({
          extends: defaultTheme,
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
            message:
              'Released under the <a href="https://opensource.org/licenses/MIT">MIT License</a>.',
            copyright: `Copyright (c) ${year} ubugeeei-prod`,
          },
        }),
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
