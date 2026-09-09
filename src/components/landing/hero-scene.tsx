"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { messages } from "@/calendar/messages";

import { Butler } from "./butler";
import styles from "./hero-scene.module.css";

type Slot = { day: number; start: number; span: number; time: string };

type Block = Slot & { id: string; label: string; waiting?: boolean };

/* A week of somebody's real life, so the grid reads as a calendar. */
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const rowCount = 10;

const blocks: Block[] = [
  { id: "standup", label: "Standup", time: "09:00", day: 0, start: 1, span: 1 },
  { id: "dentist", label: "Dentist", time: "11:30", day: 1, start: 3, span: 2 },
  { id: "review", label: "Design review", time: "14:00", day: 2, start: 5, span: 2 },
  { id: "pickup", label: "Pickup, Mateo", time: "16:30", day: 4, start: 7, span: 2 },
  { id: "dinner", label: "Dinner, Nadia", time: "20:00", day: 5, start: 8, span: 2 },
  { id: "lisbon", label: "Lisbon, LX417", time: "06:40", day: 6, start: 0, span: 2 },
  { id: "run", label: "Long run", time: "07:00", day: 4, start: 0, span: 1, waiting: true },
];

type Script = {
  ask: string;
  reply: string;
  block: string;
  to?: Slot;
  show?: true;
  link?: true;
};

const scripts: Script[] = [
  {
    ask: "move my dentist to thursday at 4",
    reply: "Moved. Thursday, 4:00 PM.",
    block: "dentist",
    to: { day: 3, start: 7, span: 2, time: "16:00" },
  },
  {
    ask: "book a 7am run on friday",
    reply: "On the calendar. Friday, 7:00 AM.",
    block: "run",
    show: true,
  },
  {
    ask: "keep this link for the design review",
    reply: `Saved to your ${messages.views.library.toLowerCase()}.`,
    block: "review",
    link: true,
  },
];

export type Phase = "typing" | "thinking" | "acting" | "resting";

const nextPhase: Record<Phase, Phase> = {
  typing: "thinking",
  thinking: "acting",
  acting: "resting",
  resting: "typing",
};

const letterMs = 45;

function holdFor(phase: Phase, ask: string) {
  if (phase === "typing") return ask.length * letterMs + 500;
  if (phase === "thinking") return 800;
  if (phase === "acting") return 1500;
  return 2800;
}

export function HeroScene() {
  const [still, setStill] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState(0);
  const slab = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const script = scripts[cursor];
  // Without motion the scene holds one finished exchange instead of looping.
  const shown: Phase = still ? "resting" : phase;

  useEffect(() => {
    if (still) return;
    const timer = setTimeout(() => {
      if (phase === "resting") {
        setCursor((at) => (at + 1) % scripts.length);
        setTyped(0);
      }
      setPhase(nextPhase[phase]);
    }, holdFor(phase, scripts[cursor].ask));
    return () => clearTimeout(timer);
  }, [cursor, phase, still]);

  useEffect(() => {
    if (still || phase !== "typing") return;
    const timer = setInterval(() => setTyped((at) => at + 1), letterMs);
    return () => clearInterval(timer);
  }, [phase, still]);

  // The slab leans toward the pointer, a long beat behind it.
  useEffect(() => {
    if (still) return;
    let frame = 0;
    const lean = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = slab.current;
        if (!node) return;
        node.style.setProperty(
          "--px",
          (event.clientX / window.innerWidth - 0.5).toFixed(3),
        );
        node.style.setProperty(
          "--py",
          (event.clientY / window.innerHeight - 0.5).toFixed(3),
        );
      });
    };
    window.addEventListener("pointermove", lean, { passive: true });
    return () => {
      window.removeEventListener("pointermove", lean);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [still]);

  // Everything the week shows is derived from where the loop stands, so a
  // wrap back to the first script puts the week back the way it started.
  const settled = (index: number) =>
    cursor > index ||
    (cursor === index && (shown === "acting" || shown === "resting"));

  const asked = shown === "typing" ? script.ask.slice(0, typed) : script.ask;

  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.slab} ref={slab}>
        <div className={styles.week} style={{ "--rows": rowCount } as CSSProperties}>
          <div className={styles.head}>
            {days.map((day) => (
              <span className={styles.day} key={day}>
                {day}
              </span>
            ))}
          </div>

          <div className={styles.grid}>
            {days.map((day, index) => (
              <span
                className={styles.column}
                key={day}
                style={{ "--i": index } as CSSProperties}
              />
            ))}
            {Array.from({ length: rowCount }, (_, index) => (
              <span
                className={styles.rule}
                key={index}
                style={{ "--i": index } as CSSProperties}
              />
            ))}

            {blocks.map((block, index) => {
              let slot: Slot = block;
              let waiting = Boolean(block.waiting);
              let linked = false;
              scripts.forEach((entry, at) => {
                if (entry.block !== block.id || !settled(at)) return;
                if (entry.to) slot = entry.to;
                if (entry.show) waiting = false;
                if (entry.link) linked = true;
              });
              const live = block.id === script.block && shown === "acting";

              return (
                <span
                  className={styles.block}
                  data-linked={linked || undefined}
                  data-live={live || undefined}
                  data-span={slot.span}
                  data-waiting={waiting || undefined}
                  key={block.id}
                  style={
                    {
                      "--day": slot.day,
                      "--i": index,
                      "--span": slot.span,
                      "--start": slot.start,
                    } as CSSProperties
                  }
                >
                  <span className={styles.card}>
                    <span className={styles.time}>{slot.time}</span>
                    <span className={styles.label}>{block.label}</span>
                  </span>
                </span>
              );
            })}

            <span className={styles.now} />
          </div>

          <span className={styles.sheen} />
        </div>
      </div>

      <Butler phase={shown} />

      <div className={styles.thread}>
        <p className={styles.ask}>
          {asked}
          <span className={styles.caret} data-idle={shown !== "typing" || undefined} />
        </p>
        <p className={styles.reply} data-open={shown !== "typing" || undefined}>
          {shown === "thinking" ? (
            <span className={styles.dots}>
              <span />
              <span />
              <span />
            </span>
          ) : (
            script.reply
          )}
        </p>
      </div>
    </div>
  );
}
