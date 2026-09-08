"use client";

import { useState } from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";

import { messages } from "@/calendar/messages";
import {
  SAVED_ITEM_KINDS,
  type SavedItemKind,
  type SavedItemRecord,
} from "@/library/types";

import { useAnchorPoint } from "../anchor-point";
import styles from "./library-board.module.css";

const library = messages.library;

const DRAWERS: readonly SavedItemKind[] = [
  ...SAVED_ITEM_KINDS.filter((kind) => kind !== "link"),
  "link",
];

const OPEN_DRAWER_ID = "library-drawer";

interface LibraryBoardProps {
  items: readonly SavedItemRecord[];
  onForget(id: string): Promise<boolean>;
}

function itemName(item: SavedItemRecord) {
  return item.title ?? item.domain;
}

function itemNote(item: SavedItemRecord) {
  return item.note ? `“${item.note}”` : item.summary;
}

function LibraryCard({
  item,
  onForget,
}: {
  item: SavedItemRecord;
  onForget(id: string): Promise<boolean>;
}) {
  const anchor = useAnchorPoint();
  const [forgetFailed, setForgetFailed] = useState(false);
  const name = itemName(item);
  const note = itemNote(item);

  return (
    <DialogTrigger>
      <Button className={styles.card} onPress={anchor.onPress}>
        <span className={styles.cardTop}>
          <small>{item.domain}</small>
          <span className={styles.punch} aria-hidden="true" />
        </span>
        <strong>{name}</strong>
        {note ? <em>{note}</em> : null}
      </Button>
      <Popover
        className={styles.detailsPopover}
        getTargetRect={anchor.getTargetRect}
        placement="bottom start"
        offset={6}
      >
        <Dialog className={styles.detailsDialog} aria-label={name}>
          <div className={styles.details}>
            <h3>{name}</h3>
            <div className={styles.detailMeta}>
              <span>{`${item.domain} · ${library.kinds[item.kind].label}`}</span>
              {item.note ? <span>{`“${item.note}”`}</span> : null}
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            <div className={styles.detailActions}>
              <a
                className={styles.openLink}
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                {library.open}
              </a>
              <button
                className={styles.forgetButton}
                type="button"
                onClick={() => {
                  void onForget(item.id).then((removed) =>
                    setForgetFailed(!removed),
                  );
                }}
              >
                {library.forget}
              </button>
            </div>
            {forgetFailed ? (
              <p className={styles.forgetFailed} role="alert">
                {library.forgetFailed}
              </p>
            ) : null}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function LibraryBoard({ items, onForget }: LibraryBoardProps) {
  const [selected, setSelected] = useState<SavedItemKind | "" | null>(null);
  const firstFilled = DRAWERS.find((kind) =>
    items.some((item) => item.kind === kind),
  );
  const openKind = selected === null ? firstFilled : selected || undefined;
  const openItems = openKind
    ? items.filter((item) => item.kind === openKind)
    : [];

  return (
    <section className={styles.board} aria-labelledby="library-heading">
      <div className={styles.heading}>
        <h2 id="library-heading">{library.title}</h2>
        <span>{library.itemCount(items.length)}</span>
      </div>

      <div className={styles.drawers}>
        {DRAWERS.map((kind) => {
          const kindMessages = library.kinds[kind];
          const count = items.filter((item) => item.kind === kind).length;
          const open = kind === openKind;
          return (
            <button
              className={styles.drawer}
              aria-controls={open ? OPEN_DRAWER_ID : undefined}
              aria-expanded={open}
              data-open={open || undefined}
              key={kind}
              type="button"
              onClick={() => setSelected(open ? "" : kind)}
            >
              <span className={styles.plate}>
                <b>{kindMessages.label}</b>
                <small>{kindMessages.hint}</small>
              </span>
              <span className={styles.count}>
                {String(count).padStart(2, "0")}
              </span>
              <span className={styles.pull} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {openKind ? (
        <div className={styles.openDrawer} id={OPEN_DRAWER_ID}>
          {openItems.length ? (
            openItems.map((item) => (
              <LibraryCard item={item} key={item.id} onForget={onForget} />
            ))
          ) : (
            <p className={styles.emptyDrawer}>{library.emptyDrawer}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
