import React from "react";
import clsx from "clsx";
import { ThemeClassNames } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Heading from "@theme/Heading";
import MDXContent from "@theme/MDXContent";
import PageActions from "../../../components/PageActions";
import styles from "./styles.module.css";

/**
 * Decide whether a synthetic title should be rendered.
 * Mirrors upstream behavior from @docusaurus/theme-classic.
 */
function useSyntheticTitle(): string | null {
  const { metadata, frontMatter, contentTitle } = useDoc();
  const shouldRender = !frontMatter.hide_title && typeof contentTitle === "undefined";
  if (!shouldRender) {
    return null;
  }
  return metadata.title;
}

export default function DocItemContent({ children }: { children: React.ReactNode }): React.JSX.Element {
  const syntheticTitle = useSyntheticTitle();

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, "markdown")}>
      {syntheticTitle ? (
        <header className={styles.headerRow}>
          <Heading as="h1" className={styles.title}>
            {syntheticTitle}
          </Heading>
          <PageActions />
        </header>
      ) : (
        <div className={styles.actionsOnlyRow}>
          <PageActions />
        </div>
      )}
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
