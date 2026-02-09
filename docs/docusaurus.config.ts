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
  onBrokenMarkdownLinks: "warn",

  headTags: [
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
        rootContent:
          "Sitemap: https://docs.privacypools.com/sitemap.xml\nFull docs for LLMs: https://docs.privacypools.com/llms-full.txt\nSkills overview: https://docs.privacypools.com/skills.md",
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
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/privacy-pools-banner.png",
    sidebar: {
      autoCollapseCategories: false,
    },
    navbar: {
      title: "Privacy Pools Documentation",
      logo: {
        alt: "Privacy Pools Logo",
        src: "img/logo.svg",
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
            { label: "skills.md", href: "https://docs.privacypools.com/skills.md" },
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
