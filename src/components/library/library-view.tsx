"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { BookmarkSimple } from "@phosphor-icons/react/dist/ssr/BookmarkSimple";

import { messages } from "@/calendar/messages";
import type { SavedItemRecord } from "@/library/types";

import { LibraryBoard } from "./library-board";
import styles from "../view-state.module.css";

const library = messages.library;

export function LibraryView() {
  const [items, setItems] = useState<readonly SavedItemRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      if (!response.ok) throw new Error(library.failed);
      const result = (await response.json()) as { items: SavedItemRecord[] };
      setItems(result.items);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const forget = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/library/${id}`, { method: "DELETE" });
      if (!response.ok) return false;
      const { deleted } = (await response.json()) as { deleted: boolean };
      if (deleted) {
        setItems((current) => current?.filter((item) => item.id !== id) ?? null);
      }
      return deleted;
    } catch {
      return false;
    }
  }, []);

  if (failed) {
    return (
      <div className={styles.notice}>
        <h2 className={styles.eyebrow}>{library.title}</h2>
        <p className={styles.noticeProse} role="alert">
          {library.failed}
        </p>
        <button
          className={styles.retryButton}
          type="button"
          onClick={() => void refresh()}
        >
          <ArrowClockwise size={16} aria-hidden="true" />
          {library.retry}
        </button>
      </div>
    );
  }

  if (!items) {
    return (
      <div
        className={styles.skeleton}
        role="status"
        aria-label={library.loadingLabel}
      >
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={styles.notice}>
        <BookmarkSimple size={28} aria-hidden="true" />
        <p className={styles.noticeProse}>{library.empty}</p>
      </div>
    );
  }

  return <LibraryBoard items={items} onForget={forget} />;
}
