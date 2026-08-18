"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { messages } from "@/calendar/messages";
import { authClient } from "@/lib/auth-client";

import calendarStyles from "../calendar/calendar.module.css";
import styles from "./auth.module.css";

const authMessages = messages.auth;

export function LoginForm() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = creating
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? authMessages.genericFailure);
      setSubmitting(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className={styles.authStage}>
      <section className={styles.authCard}>
        <div className={styles.authIntro}>
          <h1>
            {creating ? authMessages.signUpHeading : authMessages.signInHeading}
          </h1>
          <p>
            {creating ? authMessages.signUpIntro : authMessages.signInIntro}
          </p>
        </div>

        <form className={styles.authForm} onSubmit={submit} noValidate>
          {creating ? (
            <label className={calendarStyles.field}>
              <span>{authMessages.name}</span>
              <input
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : null}

          <label className={calendarStyles.field}>
            <span>{authMessages.email}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className={calendarStyles.field}>
            <span>{authMessages.password}</span>
            <input
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {creating ? <small>{authMessages.passwordHint}</small> : null}
          </label>

          {error ? (
            <p className={calendarStyles.formError} role="alert">
              {error}
            </p>
          ) : null}

          <button
            className={styles.submitButton}
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? authMessages.working
              : creating
                ? authMessages.signUp
                : authMessages.signIn}
          </button>

          <button
            className={styles.modeToggle}
            type="button"
            onClick={() => {
              setCreating((current) => !current);
              setError(null);
            }}
          >
            {creating ? authMessages.toSignIn : authMessages.toSignUp}
          </button>
        </form>
      </section>
    </main>
  );
}
