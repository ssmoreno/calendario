import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { BookmarkSimple } from "@phosphor-icons/react/dist/ssr/BookmarkSimple";
import { CalendarCheck } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";

import { messages } from "@/calendar/messages";

import { LandingNav } from "./landing-nav";
import { Reveal } from "./reveal";
import { TaglineReveal } from "./tagline-reveal";
import styles from "./landing.module.css";

const PLANE_COLUMNS = 9;
const PLANE_ROWS = 7;
const planeCells = Array.from(
  { length: PLANE_COLUMNS * PLANE_ROWS },
  (_, index) => ({
    column: index % PLANE_COLUMNS,
    row: Math.floor(index / PLANE_COLUMNS),
  }),
);

const weekdays = ["M", "T", "W", "T", "F", "S", "S"] as const;
const mockCells = Array.from({ length: 7 * 5 });

const calendarEvents = [
  { column: 2, row: 1, span: 2, label: "Studio review", moves: false },
  { column: 4, row: 2, span: 1, label: "Dentist", moves: true },
  { column: 6, row: 3, span: 2, label: "Flight to Porto", moves: false },
];

const libraryCards = [
  { name: "Sodium cells in cold climates", source: "batterylab.eu" },
  { name: "The Lisbon coffee map", source: "notes.marta.pt" },
  { name: "Rewriting a rota in one prompt", source: "handbook.ss" },
];

const steps = [
  {
    icon: CalendarCheck,
    title: "Connect the calendar you already use",
    copy: "SS reads and writes your Google Calendar, so there is nothing to migrate and nothing to keep in sync.",
  },
  {
    icon: ChatCircleDots,
    title: "Ask in a sentence",
    copy: "“Move the dentist to Thursday morning and tell Marta” is a complete instruction. No forms, no dropdowns.",
  },
  {
    icon: BookmarkSimple,
    title: "Keep what you want to come back to",
    copy: "Anything worth saving lands in your library, filed under a category you can rename later.",
  },
];

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className={styles.landing}>
      <a className={styles.skip} href="#content">
        Skip to content
      </a>
      <LandingNav signedIn={signedIn} />

      <main className={styles.main} id="content">
        <section className={styles.hero}>
          <div className={styles.plane} aria-hidden="true">
            <div className={styles.planeGrid}>
              {planeCells.map((cell) => (
                <span
                  className={styles.planeCell}
                  key={`${cell.column}-${cell.row}`}
                  style={
                    {
                      "--pulse-delay": `${(cell.column + cell.row) * 160}ms`,
                    } as CSSProperties
                  }
                />
              ))}
              <span className={styles.planeSweep} />
            </div>
          </div>

          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Calendar · Library</p>
              <h1 className={styles.heroHeading}>
                Everything you planned,
                <br />
                and everything you saved,
                <br />
                one message away.
              </h1>
              <p className={styles.heroSub}>
                {messages.appName} runs on your Google Calendar and on the links
                you keep. Text it what you need and it books, moves, and reminds
                while you get on with the day.
              </p>
              <p className={styles.heroProof}>
                Google Calendar · WhatsApp
              </p>
            </div>

            <div className={styles.frames}>
              <p className={styles.framesLabel} id="views-label">
                Choose a view
              </p>
              <div
                className={styles.framesRow}
                role="group"
                aria-labelledby="views-label"
              >
                <Link className={styles.frame} href="/calendar">
                  <span className={styles.frameMock} aria-hidden="true">
                    <span className={styles.mockBar}>
                      <span className={styles.mockBarTitle}>September</span>
                      <span className={styles.mockBarMeta}>Week 37</span>
                    </span>
                    <span className={styles.mockWeekdays}>
                      {weekdays.map((day, index) => (
                        <span key={`${day}-${index}`}>{day}</span>
                      ))}
                    </span>
                    <span className={styles.mockBoard}>
                      <span className={styles.mockGrid}>
                        {mockCells.map((_, index) => (
                          <span className={styles.mockCell} key={index} />
                        ))}
                      </span>
                      <span className={styles.mockEvents}>
                        {calendarEvents.map((event, index) => (
                          <span
                            className={styles.mockEvent}
                            data-moves={event.moves || undefined}
                            key={event.label}
                            style={
                              {
                                "--col": event.column,
                                "--row": event.row,
                                "--rows": event.span,
                                "--event-delay": `${index * 140 + 200}ms`,
                              } as CSSProperties
                            }
                          >
                            {event.label}
                          </span>
                        ))}
                        <span className={styles.mockNow} />
                      </span>
                    </span>
                  </span>
                  <span className={styles.frameCopy}>
                    <span className={styles.frameIndex}>01</span>
                    <span className={styles.frameHeading}>
                      {messages.views.calendar}
                    </span>
                    <span className={styles.frameProse}>
                      Your week as a board you can read in one look. Ask for a
                      change and watch the block land in its new slot.
                    </span>
                    <span className={styles.frameGo}>
                      Open the calendar
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </span>
                </Link>

                <Link className={styles.frame} href="/library">
                  <span className={styles.frameMock} aria-hidden="true">
                    <span className={styles.mockBar}>
                      <span className={styles.mockBarTitle}>Collections</span>
                      <span className={styles.mockBarMeta}>3 categories</span>
                    </span>
                    <span className={styles.mockChips}>
                      <span>Reading</span>
                      <span>Places</span>
                      <span>Work</span>
                    </span>
                    <span className={styles.mockStack}>
                      {libraryCards.map((card, index) => (
                        <span
                          className={styles.mockCard}
                          key={card.name}
                          style={{ "--i": index } as CSSProperties}
                        >
                          <span className={styles.mockCardName}>
                            {card.name}
                          </span>
                          <span className={styles.mockCardSource}>
                            {card.source}
                            <ArrowUpRight size={12} aria-hidden="true" />
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className={styles.frameCopy}>
                    <span className={styles.frameIndex}>02</span>
                    <span className={styles.frameHeading}>
                      {messages.views.library}
                    </span>
                    <span className={styles.frameProse}>
                      The links you meant to return to, filed by category
                      instead of buried in a chat thread.
                    </span>
                    <span className={styles.frameGo}>
                      Open the library
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.taglineSection} aria-label="What SS does">
          <TaglineReveal />
        </section>

        <section className={styles.steps} aria-labelledby="steps-heading">
          <Reveal className={styles.stepsHeader}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 className={styles.stepsHeading} id="steps-heading">
              Three things to set up, then nothing to maintain.
            </h2>
          </Reveal>
          <ol className={styles.stepList}>
            {steps.map((step, index) => (
              <li key={step.title}>
                <Reveal delay={index * 120}>
                  <article className={styles.step}>
                    <span className={styles.stepIcon} aria-hidden="true">
                      <step.icon size={20} />
                    </span>
                    <span className={styles.stepIndex}>
                      {`0${index + 1}`}
                    </span>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepProse}>{step.copy}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.close} aria-labelledby="close-heading">
          <Reveal className={styles.closeInner}>
            <h2 className={styles.closeHeading} id="close-heading">
              Pick where you want to start.
            </h2>
            <div className={styles.closeActions}>
              <Link className={styles.closePrimary} href="/calendar">
                Open the calendar
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className={styles.closeSecondary} href="/library">
                Open the library
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerMark} aria-hidden="true">
          {messages.appName}
        </span>
        <nav className={styles.footerLinks} aria-label="Footer">
          <Link href="/calendar">{messages.views.calendar}</Link>
          <Link href="/library">{messages.views.library}</Link>
          <Link href={signedIn ? "/calendar" : "/login"}>
            {signedIn ? "Open SS" : messages.auth.signInHeading}
          </Link>
        </nav>
        <span className={styles.footerNote}>
          One calendar, one library, one person.
        </span>
      </footer>
    </div>
  );
}
