import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docs: [
    {
      type: "category",
      label: "Overview",
      collapsible: false,
      items: ["overview/what-is-privacy-pools", "overview/core-concepts"],
    },
    {
      type: "category",
      label: "Protocol Components",
      collapsible: false,
      items: [
        {
          type: "category",
          label: "Smart Contracts Layer",
          collapsible: false,
          link: {
            type: "doc",
            id: "layers/contracts",
          },
          items: [
            "layers/contracts/entrypoint",
            "layers/contracts/privacy-pools",
          ],
        },
        {
          type: "category",
          label: "Zero Knowledge Layer",
          collapsible: false,
          link: {
            type: "doc",
            id: "layers/zk",
          },
          items: [
            "layers/zk/commitment",
            "layers/zk/lean-imt",
            "layers/zk/withdrawal",
          ],
        },
        "layers/asp",
      ],
    },
    {
      type: "category",
      collapsible: false,
      label: "Using Privacy Pools",
      items: ["protocol/deposit", "protocol/withdrawal", "protocol/ragequit"],
    },
    {
      type: "category",
      collapsible: false,
      label: "Technical Reference",
      items: ["reference/contracts", "reference/circuits", "reference/sdk"],
    },
    "dev-guide",
  ],
};

export default sidebars;
