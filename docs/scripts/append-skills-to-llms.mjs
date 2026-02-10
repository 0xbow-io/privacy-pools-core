/**
 * Post-build script: prepends skills-core.md and skills.md to llms-full.txt
 *
 * The docusaurus-plugin-llms generates llms-full.txt from docs pages, but the
 * agent-facing files (skills-core.md and skills.md) live in static/ and aren't
 * included automatically.
 *
 * This script prepends both so llms-full.txt is fully self-contained:
 *   1. skills-core.md — concise operational quickstart (high-signal, low-context)
 *   2. skills.md — canonical deep reference (SDK, API schemas, ABIs, error handling)
 *   3. Original docusaurus-generated docs pages
 *
 * Agents that receive llms-full.txt can execute end-to-end without following
 * external URLs. The progressive structure lets truncated pipelines still get
 * the most critical content first.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(__dirname, "..", "build");
const skillsCorePath = resolve(__dirname, "..", "static", "skills-core.md");
const skillsDeepPath = resolve(__dirname, "..", "static", "skills.md");
const llmsFullPath = resolve(buildDir, "llms-full.txt");

if (!existsSync(llmsFullPath)) {
  console.error("[append-skills] llms-full.txt not found in build/ — skipping.");
  process.exit(0);
}

if (!existsSync(skillsCorePath)) {
  console.error("[append-skills] static/skills-core.md not found — skipping.");
  process.exit(0);
}

const skillsCore = readFileSync(skillsCorePath, "utf8");
const llmsFull = readFileSync(llmsFullPath, "utf8");
const marker = "<!-- skills-core-prepended -->";

if (llmsFull.includes(marker)) {
  console.log("[append-skills] skills marker already present in llms-full.txt — skipping.");
  process.exit(0);
}

// Build the prepended content: skills-core first, then skills.md if available
const coreHeader = [
  marker,
  "Agent quickstart (skills-core.md)",
  "",
  "This is the concise operational guide for autonomous and human+agent workflows.",
  "The canonical deep reference (skills.md) follows immediately after this section.",
  "",
].join("\n");

let deepSection = "";
if (existsSync(skillsDeepPath)) {
  const skillsDeep = readFileSync(skillsDeepPath, "utf8");
  deepSection = [
    "",
    "---",
    "",
    "Canonical deep reference (skills.md)",
    "",
    "Complete SDK, API, and protocol integration reference.",
    "This is the source of truth for Privacy Pools agent workflows.",
    "",
    skillsDeep,
  ].join("\n");
  console.log("[append-skills] Including skills.md in llms-full.txt");
} else {
  console.warn("[append-skills] static/skills.md not found — prepending skills-core.md only.");
}

const merged = `${coreHeader}${skillsCore}${deepSection}\n\n---\n\n${llmsFull}`;
writeFileSync(llmsFullPath, merged, "utf8");

console.log("[append-skills] Prepended skills-core.md + skills.md to llms-full.txt");
