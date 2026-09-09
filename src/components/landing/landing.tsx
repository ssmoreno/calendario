import Link from "next/link";
import type { CSSProperties } from "react";

import { messages } from "@/calendar/messages";

import { HeroScene } from "./hero-scene";
import styles from "./landing.module.css";

// Two lines, broken where the thought breaks.
const headingLines = ["Your calendar ", "and your library."];
const line = `Text ${messages.appName} to book something, move it, or keep a link for later.`;

export function Landing({ signedIn }: { signedIn: boolean }) {
  const links = signedIn
    ? [
        { href: "/calendar", label: messages.views.calendar },
        { href: "/library", label: messages.views.library },
      ]
    : [{ href: "/login", label: messages.auth.signInHeading }];

  return (
    <main className={styles.landing}>
      <div className={styles.stage}>
        <div className={styles.inner}>
          <p className={styles.mark}>{messages.appName}</p>
          <h1 className={styles.heading}>
            {headingLines.map((text, index) => (
              <span
                className={styles.headLine}
                key={text}
                style={{ "--i": index } as CSSProperties}
              >
                {text}
              </span>
            ))}
          </h1>
          <p className={styles.line}>
            {line.split(" ").map((word, index) => (
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

        <HeroScene />
      </div>
    </main>
  );
}
