import Link from "next/link";
import type { CSSProperties } from "react";

import { messages } from "@/calendar/messages";

import styles from "./landing.module.css";

const line = `Text ${messages.appName} to book something, move it, or keep a link for later.`;
const words = line.split(" ");

export function Landing({ signedIn }: { signedIn: boolean }) {
  const links = signedIn
    ? [
        { href: "/calendar", label: messages.views.calendar },
        { href: "/library", label: messages.views.library },
      ]
    : [{ href: "/login", label: messages.auth.signInHeading }];

  return (
    <main className={styles.landing}>
      {/* The now line from the calendar, drifting down an empty page. */}
      <span className={styles.now} aria-hidden="true" />

      <div className={styles.inner}>
        <p className={styles.mark}>{messages.appName}</p>
        <h1 className={styles.heading}>Your calendar and your library.</h1>
        <p className={styles.line}>
          {words.map((word, index) => (
            <span
              className={styles.word}
              key={`${word}-${index}`}
              style={{ "--i": index } as CSSProperties}
            >
              {word}{" "}
            </span>
          ))}
        </p>
        <nav className={styles.links} aria-label="Views">
          {links.map((link) => (
            <Link className={styles.link} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
