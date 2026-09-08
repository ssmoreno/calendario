"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import styles from "./landing.module.css";

const tagline =
  "You should not have to open an app to move a meeting. Say it once and the rest of the week rearranges itself.";

const words = tagline.split(" ");

/*
 * Each word lights on its own as it crosses the trigger line, in reading
 * order. One observer watches every word, so scrolling stays cheap.
 */
export function TaglineReveal() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState<number[]>([]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const arrived = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number(entry.target.getAttribute("data-index")));
        if (!arrived.length) return;
        setLit((current) => [...new Set([...current, ...arrived])]);
        for (const entry of entries) {
          if (entry.isIntersecting) observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -32% 0px", threshold: 1 },
    );
    for (const word of node.querySelectorAll("[data-index]")) {
      observer.observe(word);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <p className={styles.tagline} ref={ref}>
      {words.map((word, index) => (
        <span
          className={styles.taglineWord}
          data-index={index}
          data-lit={lit.includes(index) || undefined}
          key={`${word}-${index}`}
          style={{ "--word-delay": `${(index % 6) * 60}ms` } as CSSProperties}
        >
          {word}{" "}
        </span>
      ))}
    </p>
  );
}
