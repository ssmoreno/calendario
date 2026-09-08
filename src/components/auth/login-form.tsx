"use client";

import Image from "next/image";
import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";

import { messages } from "@/calendar/messages";
import { authClient } from "@/lib/auth-client";

import formStyles from "../forms.module.css";
import styles from "./auth.module.css";

const authMessages = messages.auth;

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signInWithGoogle() {
    setSubmitting(true);
    setError(null);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/login?error=google",
    });
    if (result?.error) {
      setError(result.error.message ?? authMessages.genericFailure);
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.authStage}>
      <section className={styles.authCard}>
        <div className={styles.wordmark} aria-hidden="true">
          <span className={styles.mark}>{messages.appName}</span>
        </div>

        <div className={styles.authIntro}>
          <h1 className={styles.authEyebrow}>{authMessages.signInHeading}</h1>
          <p>{authMessages.signInIntro}</p>
        </div>

        <div className={styles.authActions}>
          {error ? (
            <p className={formStyles.formError} role="alert">
              <WarningCircle size={16} aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <button
            className={styles.googleButton}
            type="button"
            disabled={submitting}
            onClick={() => void signInWithGoogle()}
          >
            <Image
              aria-hidden="true"
              className={styles.googleCalendarLogo}
              src="/google-calendar.svg"
              alt=""
              width={24}
              height={24}
            />
            <span>
              {submitting
                ? authMessages.working
                : authMessages.signInWithGoogleCalendar}
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
