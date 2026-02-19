import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Privacy Pools Documentation",
  tagline: "Technical documentation for Privacy Pools protocol",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://docs.privacypools.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "0xbow-io", // Usually your GitHub org/user name.
  projectName: "privacy-pools-core", // Usually your repo name.

  onBrokenLinks: "throw",
  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        href: "/img/favicon-light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        href: "/img/favicon-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    },
    {
      tagName: "meta",
      attributes: { property: "og:type", content: "website" },
    },
    {
      tagName: "meta",
      attributes: { name: "twitter:site", content: "@0xprivacypools" },
    },
    {
      tagName: "meta",
      attributes: { name: "twitter:creator", content: "@0xbowio" },
    },
    {
      tagName: "meta",
      attributes: { name: "twitter:card", content: "summary_large_image" },
    },
    {
      tagName: "meta",
      attributes: { name: "robots", content: "index, follow" },
    },
  ],

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  themes: ["@docusaurus/theme-mermaid"],

  plugins: [
    [
      "docusaurus-plugin-llms",
      {
        generateMarkdownFiles: true,
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        excludeImports: true,
        removeDuplicateHeadings: true,
        ignoreFiles: ["toc.md", "privacy-policy.md"],
        rootContent:
          "Sitemap: https://docs.privacypools.com/sitemap.xml\nFull docs for LLMs: https://docs.privacypools.com/llms-full.txt\nAgent quickstart: https://docs.privacypools.com/skills-core.md\nCanonical deep reference: https://docs.privacypools.com/skills.md",
        fullRootContent:
          "Start here: https://docs.privacypools.com/skills-core.md (agent quickstart).\nCanonical deep reference: https://docs.privacypools.com/skills.md (full operational detail).\nSitemap: https://docs.privacypools.com/sitemap.xml\nSDK package: @0xbow/privacy-pools-core-sdk (npm)",
        pathTransformation: {
          ignorePaths: ["docs"],
        },
      },
    ],
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl:
            "https://github.com/0xbow-io/privacy-pools-core/tree/main/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
        sitemap: {
          createSitemapItems: async (params) => {
            const { defaultCreateSitemapItems, ...rest } = params;
            const items = await defaultCreateSitemapItems(rest);
            // Include LLM/AI static artifacts in sitemap for crawler discoverability
            return [
              ...items,
              { url: "https://docs.privacypools.com/skills-core.md", changefreq: "weekly" as const, priority: 0.7 },
              { url: "https://docs.privacypools.com/skills.md", changefreq: "weekly" as const, priority: 0.7 },
              { url: "https://docs.privacypools.com/llms.txt", changefreq: "weekly" as const, priority: 0.6 },
              { url: "https://docs.privacypools.com/llms-full.txt", changefreq: "weekly" as const, priority: 0.6 },
            ];
          },
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/privacy-pools-banner.png",
    mermaid: {
      theme: {
        light: "neutral",
        dark: "dark",
      },
    },
    sidebar: {
      autoCollapseCategories: false,
    },
    navbar: {
      title: "Privacy Pools Documentation",
      logo: {
        alt: "Privacy Pools Logo",
        src: "img/logo.svg",
        srcDark: "img/logo-dark.svg",
      },
      items: [
        {
          href: "https://github.com/0xbow-io/privacy-pools-core",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "For AI Agents",
          items: [
            { label: "llms.txt", href: "https://docs.privacypools.com/llms.txt" },
            { label: "llms-full.txt", href: "https://docs.privacypools.com/llms-full.txt" },
            { label: "skills-core.md", href: "https://docs.privacypools.com/skills-core.md" },
            { label: "skills.md", href: "https://docs.privacypools.com/skills.md" },
            { label: "agent-workflows", to: "/agent-workflows" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 0XBOW LTD`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["solidity"],
    },
    docs: {
      sidebar: {
        hideable: false,
        autoCollapseCategories: false,
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
