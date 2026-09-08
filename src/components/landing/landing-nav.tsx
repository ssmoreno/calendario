"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { messages } from "@/calendar/messages";

import styles from "./landing.module.css";

const links = [
  { href: "/calendar", label: messages.views.calendar },
  { href: "/library", label: messages.views.library },
] as const;

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const entry = signedIn
    ? { href: "/calendar", label: "Open SS" }
    : { href: "/login", label: messages.auth.signInHeading };

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={styles.navPill}>
        <span className={styles.navMark} aria-hidden="true">
          {messages.appName}
        </span>
        <nav className={styles.navLinks} aria-label="Views">
          {links.map((link) => (
            <Link className={styles.navLink} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <Link className={styles.navEntry} href={entry.href}>
          {entry.label}
        </Link>
        <button
          aria-controls="landing-menu"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className={styles.navToggle}
          data-open={open || undefined}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div
        className={styles.navOverlay}
        data-open={open || undefined}
        id="landing-menu"
        inert={!open}
      >
        <nav aria-label="Menu">
          {[...links, entry].map((link, index) => (
            <Link
              className={styles.navOverlayLink}
              href={link.href}
              key={link.href}
              onClick={() => setOpen(false)}
              style={{ "--link-delay": `${index * 70 + 90}ms` } as CSSProperties}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
