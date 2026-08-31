import { oxContent, defineTheme, defaultTheme } from "@ox-content/vite-plugin";
import { defineConfig } from "vite";

const base = process.env.WEB_HIGHLIGHTER_DOCS_BASE ?? "/";
const siteUrl = process.env.WEB_HIGHLIGHTER_DOCS_SITE_URL ?? "https://web-highlighter.void.app";
const year = new Date().getFullYear();

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
        breadcrumbs: true,
        markdownSource: { copy: true },
        notFound: true,
        pageChrome: true,
        readerChrome: { backToTop: true },
        theme: defineTheme({
          extends: defaultTheme,
          aside: true,
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
                { text: "Store Publishing", link: "/store-publishing.md" },
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
