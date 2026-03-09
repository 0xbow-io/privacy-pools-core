import React, { useEffect, useMemo, useRef, useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import styles from "./styles.module.css";

const NO_MARKDOWN_DOC_IDS = new Set(["toc", "privacy-policy"]);

function toMarkdownPathFromSource(source: string, permalink: string): string {
  const normalizedSource = source.replace(/\\/g, "/");
  const siteDocsMatch = normalizedSource.match(/^@site\/docs\/docs\/(.+?)\.(md|mdx)$/i);
  if (siteDocsMatch?.[1]) {
    return `/${siteDocsMatch[1]}.md`;
  }

  const i18nDocsMatch = normalizedSource.match(/docusaurus-plugin-content-docs\/current\/(.+?)\.(md|mdx)$/i);
  if (i18nDocsMatch?.[1]) {
    return `/${i18nDocsMatch[1]}.md`;
  }

  const fallbackPath = permalink === "/" ? "/overview/what-is-privacy-pools" : permalink.replace(/\/$/, "");
  return `${fallbackPath}.md`;
}

function toCanonicalUrl(siteUrl: string, baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  const withTrailingSlash = normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(`${withTrailingSlash}${normalizedPath}`, siteUrl).toString();
}

async function fetchMarkdownText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch markdown (${response.status})`);
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const looksLikeHtml =
    /^\s*<!doctype html/i.test(text) ||
    /^\s*<html[\s>]/i.test(text) ||
    text.includes('<div id="__docusaurus"></div>');

  // Some hosts/dev servers return the SPA shell (HTML) for unknown routes.
  // Treat that as a failed markdown fetch so fallback URLs can be tried.
  if (contentType.includes("text/html") || looksLikeHtml) {
    throw new Error("Received HTML instead of markdown");
  }

  return text;
}

async function fetchMarkdownWithFallback(primaryUrl: string, fallbackUrl: string): Promise<string> {
  try {
    return await fetchMarkdownText(primaryUrl);
  } catch {
    return fetchMarkdownText(fallbackUrl);
  }
}

function fallbackCopyText(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

async function copyTextToClipboard(text: string): Promise<void> {
  const clipboard = navigator.clipboard;
  if (!clipboard) {
    if (fallbackCopyText(text)) {
      return;
    }
    throw new Error("Clipboard unavailable");
  }

  if (typeof clipboard.writeText === "function") {
    await clipboard.writeText(text);
    return;
  }

  if (fallbackCopyText(text)) {
    return;
  }
  throw new Error("Clipboard write failed");
}

export default function PageActions(): React.JSX.Element | null {
  const { metadata } = useDoc();
  const { siteConfig } = useDocusaurusContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const markdownPath = toMarkdownPathFromSource(metadata.source, metadata.permalink);
  const localMarkdownUrl = useBaseUrl(markdownPath);
  const canonicalMarkdownUrl = useMemo(
    () => toCanonicalUrl(siteConfig.url, siteConfig.baseUrl, localMarkdownUrl),
    [localMarkdownUrl, siteConfig.baseUrl, siteConfig.url],
  );

  const dismissToast = (): void => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  };

  const setToastMessage = (message: string, variant: "success" | "error" = "success"): void => {
    setToast({ message, variant });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2000);
  };

  const closeMenu = (): void => setIsOpen(false);
  const toggleMenu = (): void => {
    setIsOpen((open) => {
      const next = !open;
      if (next) {
        dismissToast();
      }
      return next;
    });
  };

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  if (NO_MARKDOWN_DOC_IDS.has(metadata.id)) {
    return null;
  }

  const copyPageMarkdown = async (): Promise<void> => {
    closeMenu();
    try {
      const clipboard = navigator.clipboard;
      const supportsPromiseClipboard =
        typeof window !== "undefined" &&
        "ClipboardItem" in window &&
        !!clipboard &&
        typeof clipboard.write === "function";

      if (supportsPromiseClipboard) {
        // Keep clipboard.write() in the user-gesture chain for Safari.
        const blobPromise = fetchMarkdownWithFallback(localMarkdownUrl, canonicalMarkdownUrl).then(
          (text) => new Blob([text], { type: "text/plain" }),
        );
        const clipboardItem = new ClipboardItem({
          "text/plain": blobPromise,
        });
        await clipboard.write([clipboardItem]);
      } else {
        const markdown = await fetchMarkdownWithFallback(localMarkdownUrl, canonicalMarkdownUrl);
        await copyTextToClipboard(markdown);
      }

      setToastMessage("Page copied", "success");
    } catch {
      try {
        await copyTextToClipboard(canonicalMarkdownUrl);
        setToastMessage("Copied .md page URL", "success");
      } catch {
        setToastMessage("Unable to copy page", "error");
      }
    }
  };

  const viewPageMarkdown = (): void => {
    closeMenu();
    // Always use canonical URL for view action to avoid local-dev 404 behavior.
    // Production host serves this route directly.
    window.open(canonicalMarkdownUrl, "_blank", "noopener,noreferrer");
  };

  const openInChatgpt = (): void => {
    closeMenu();
    const prompt = `Read from ${canonicalMarkdownUrl} so I can ask questions about it.`;
    const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openInClaude = (): void => {
    closeMenu();
    const prompt = `Read from ${canonicalMarkdownUrl} so I can ask questions about it.`;
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Page actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <span className={styles.triggerLabel}>
          <svg
            className={styles.copyIcon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect x="9" y="7" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 16V6a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Copy page</span>
        </span>
        <span className={styles.triggerDivider} aria-hidden="true" />
        <svg
          className={styles.chevron}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.menu} role="menu" aria-label="Page actions menu">
          <button type="button" className={styles.menuItem} role="menuitem" onClick={copyPageMarkdown}>
            Copy page as Markdown
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemExternal}`}
            role="menuitem"
            onClick={viewPageMarkdown}
          >
            View as Markdown
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemExternal}`}
            role="menuitem"
            onClick={openInChatgpt}
          >
            Open in ChatGPT
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemExternal}`}
            role="menuitem"
            onClick={openInClaude}
          >
            Open in Claude
          </button>
        </div>
      )}

      {toast && (
        <div
          className={`${styles.toast} ${toast.variant === "error" ? styles.toastError : styles.toastSuccess}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
