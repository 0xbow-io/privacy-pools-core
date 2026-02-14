import React from "react";
import Head from "@docusaurus/Head";
import { useLocation } from "@docusaurus/router";
import { useEffect, useRef } from "react";

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

function usePreserveScrollOnThemeToggle(): void {
  const pendingBottomOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    const selector = 'button[class*="toggleButton"], button[aria-label*="mode"]';

    const captureToggleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      const toggle = target?.closest(selector);
      if (!toggle) {
        return;
      }

      const doc = document.documentElement;
      pendingBottomOffsetRef.current = doc.scrollHeight - (window.scrollY + window.innerHeight);
    };

    const observer = new MutationObserver((mutations) => {
      const changedTheme = mutations.some(
        (mutation) => mutation.type === "attributes" && mutation.attributeName === "data-theme",
      );

      if (!changedTheme || pendingBottomOffsetRef.current === null) {
        return;
      }

      const bottomOffset = pendingBottomOffsetRef.current;
      pendingBottomOffsetRef.current = null;

      // Wait for layout to settle after theme-driven rerenders (e.g. Mermaid).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const doc = document.documentElement;
          const maxScrollTop = Math.max(0, doc.scrollHeight - window.innerHeight);
          const nextTop = Math.max(0, maxScrollTop - bottomOffset);
          window.scrollTo({ top: nextTop, behavior: "auto" });
        });
      });
    });

    document.addEventListener("click", captureToggleClick, true);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      document.removeEventListener("click", captureToggleClick, true);
      observer.disconnect();
    };
  }, []);
}

export default function Root({ children }: { children: React.ReactNode }): React.JSX.Element {
  usePreserveScrollOnThemeToggle();

  return (
    <>
      <AlternateMdLink />
      {children}
    </>
  );
}
