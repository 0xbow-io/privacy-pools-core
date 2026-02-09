import React from "react";
import Head from "@docusaurus/Head";
import { useLocation } from "@docusaurus/router";

function AlternateMdLink(): React.JSX.Element | null {
  const { pathname } = useLocation();

  // Skip non-doc pages (404, etc.)
  if (pathname.includes(".html")) {
    return null;
  }

  const mdHref =
    (pathname === "/"
      ? "/overview/what-is-privacy-pools"
      : pathname.replace(/\/$/, "")) + ".md";

  return (
    <Head>
      <link rel="alternate" type="text/markdown" href={mdHref} />
    </Head>
  );
}

export default function Root({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <AlternateMdLink />
      {children}
    </>
  );
}
