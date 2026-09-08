"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import styles from "./landing.module.css";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Milliseconds added after the section crosses the trigger line. */
  delay?: number;
}

/*
 * Sections arrive rather than appear. An IntersectionObserver keeps the work
 * off the scroll thread, and the reveal only ever runs once per element.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setRevealed(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
      data-revealed={revealed || undefined}
      ref={ref}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
