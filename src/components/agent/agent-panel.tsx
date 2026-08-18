"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import type {
  EveMessageData,
  EveMessageInputRequest,
  EveMessagePart,
  UseEveAgentSnapshot,
} from "eve/react";

import { themePreferenceSchema } from "@/calendar/settings";
import { saveThemePreference } from "@/calendar/storage";
import { applyThemePreference } from "@/calendar/theme";
import type { ThemePreference } from "@/calendar/types";

import {
  clearSavedAgent,
  readSavedAgent,
  writeSavedAgent,
  type AgentSnapshot,
} from "./agent-storage";
import styles from "./agent.module.css";

function pendingRequests(data: EveMessageData): readonly EveMessageInputRequest[] {
  return data.messages
    .flatMap((message) => message.parts)
    .flatMap((part) => {
      if (part.type !== "dynamic-tool" || part.state !== "approval-requested") {
        return [];
      }
      const request = part.toolMetadata?.eve?.inputRequest;
      return request ? [request] : [];
    });
}

function themeChanges(
  data: EveMessageData,
): { callId: string; theme: ThemePreference }[] {
  return data.messages
    .flatMap((message) => message.parts)
    .flatMap((part) => {
      if (
        part.type !== "dynamic-tool" ||
        part.toolName !== "update_settings" ||
        part.state !== "output-available"
      ) {
        return [];
      }
      const theme = (part.output as { settings?: { theme?: unknown } } | null)
        ?.settings?.theme;
      const parsed = themePreferenceSchema.safeParse(theme);
      return parsed.success
        ? [{ callId: part.toolCallId, theme: parsed.data }]
        : [];
    });
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function MessagePart({ part }: { part: EveMessagePart }) {
  return part.type === "text" ? <p className={styles.messageText}>{part.text}</p> : null;
}

function HydratedAgentPanel({
  connected,
  onCalendarChanged,
  userId,
}: AgentPanelProps) {
  const [saved] = useState(() => readSavedAgent(userId));
  const [draft, setDraft] = useState("");
  const [freeform, setFreeform] = useState("");
  const [expanded, setExpanded] = useState(saved.events.length > 0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const appliedThemeCalls = useRef(new Set<string>());

  const agent = useEveAgent({
    initialEvents: saved.events as readonly MessageStreamEvent[],
    initialSession: saved.session,
    prepareSend: (payload) => ({
      ...payload,
      clientContext: `Device timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    }),
    onFinish: (snapshot: UseEveAgentSnapshot<EveMessageData>) => {
      const next: AgentSnapshot = {
        events: snapshot.events,
        session: snapshot.session,
      };
      writeSavedAgent(userId, next);
      onCalendarChanged();
    },
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const request = pendingRequests(agent.data).at(-1);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [agent.data.messages]);

  useEffect(() => {
    for (const { callId, theme } of themeChanges(agent.data)) {
      if (appliedThemeCalls.current.has(callId)) continue;
      appliedThemeCalls.current.add(callId);
      applyThemePreference(theme);
      saveThemePreference(safeStorage(), theme);
    }
  }, [agent.data]);

  function respond(response: {
    requestId: string;
    optionId?: string;
    text?: string;
  }) {
    setFreeform("");
    void agent.respond([response]);
  }

  function send() {
    const message = draft.trim();
    if (!message || !connected || isBusy) return;
    setDraft("");
    setExpanded(true);
    void agent.send(message);
  }

  return (
    <section className={styles.panel} aria-labelledby="agent-heading">
      <div className={styles.panelHeading}>
        <h2 id="agent-heading">Agent</h2>
        {expanded ? (
          <button
            className={styles.quietButton}
            disabled={isBusy}
            type="button"
            onClick={() => {
              agent.reset();
              clearSavedAgent(userId);
              setExpanded(false);
            }}
          >
            New conversation
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className={styles.transcript} ref={transcriptRef} aria-live="polite">
          {agent.data.messages.map((message) => {
            const textParts = message.parts.filter((part) => part.type === "text");
            if (!textParts.length) return null;
            return (
              <article className={styles.message} data-role={message.role} key={message.id}>
                <span>{message.role === "user" ? "You" : "SS"}</span>
                {textParts.map((part, index) => (
                  <MessagePart key={index} part={part} />
                ))}
              </article>
            );
          })}

          {request ? (
            <fieldset className={styles.prompt}>
              <legend>
                {request.kind === "tool-approval" ? "Approval" : "One question"}
              </legend>
              <p>{request.prompt}</p>
              <div className={styles.promptOptions}>
                {request.options?.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      respond({ requestId: request.requestId, optionId: option.id })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {request.allowFreeform || !request.options?.length ? (
                <form
                  className={styles.answerForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = freeform.trim();
                    if (text) respond({ requestId: request.requestId, text });
                  }}
                >
                  <input
                    aria-label="Answer"
                    value={freeform}
                    onChange={(event) => setFreeform(event.target.value)}
                  />
                  <button type="submit">Answer</button>
                </form>
              ) : null}
            </fieldset>
          ) : null}

          {agent.error ? <p className={styles.error}>{agent.error.message}</p> : null}
        </div>
      ) : null}

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          aria-label="Ask the calendar agent"
          disabled={!connected || isBusy}
          placeholder={
            connected ? "Ask SS to manage your calendar…" : "Connect Google Calendar first"
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        {isBusy ? (
          <button type="button" onClick={() => agent.stop()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!connected || !draft.trim()} aria-label="Send">
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </form>
    </section>
  );
}

interface AgentPanelProps {
  connected: boolean;
  onCalendarChanged(): void;
  userId: string;
}

export function AgentPanel(props: AgentPanelProps) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  return hydrated ? <HydratedAgentPanel {...props} /> : null;
}
