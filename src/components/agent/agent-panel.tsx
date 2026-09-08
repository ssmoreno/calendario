"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import type {
  EveMessage,
  EveMessageData,
  EveMessageInputRequest,
  UseEveAgentSnapshot,
} from "eve/react";

import {
  clearSavedAgent,
  readSavedAgent,
  writeSavedAgent,
  type AgentSnapshot,
} from "./agent-storage";
import { messageText } from "./message-text";
import { failedTurns } from "./turn-failures";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Stop } from "@phosphor-icons/react/dist/ssr/Stop";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";

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

function Message({ children, role }: { children: ReactNode; role: EveMessage["role"] }) {
  return (
    <article className={styles.message} data-role={role}>
      <span>{role === "user" ? "You" : "SS"}</span>
      {children}
    </article>
  );
}

function WorkingMessage() {
  return (
    <Message role="assistant">
      <p className={styles.working}>Working…</p>
    </Message>
  );
}

/**
 * What a turn that produced no reply shows. Every turn is meant to end in text,
 * so an empty settled turn is a failure whether or not the stream recorded one,
 * and saying nothing is what makes it read as an agent that ignored the user.
 */
function FailedMessage() {
  return (
    <Message role="assistant">
      <p className={styles.error}>
        <WarningCircle size={16} aria-hidden="true" />
        Something went wrong on my end and that didn’t go through. Try sending it
        again.
      </p>
    </Message>
  );
}

/**
 * The turn still running, if any. Neither status on its own can say which
 * message that is: the session reports `submitted` before the turn's messages
 * exist, and a message's own status reads `complete` as soon as any text part
 * finishes — including the narration the agent writes before a tool call.
 */
function activeTurnId(
  events: readonly MessageStreamEvent[],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "turn.started") return event.data.turnId;
    if (
      event.type === "turn.completed" ||
      event.type === "turn.failed" ||
      event.type === "turn.cancelled"
    ) {
      return undefined;
    }
  }
  return undefined;
}

function HydratedAgentPanel({
  connected,
  mode,
  onBusyChange,
  onCalendarChanged,
  onModeChange,
  userId,
}: AgentPanelProps) {
  const [saved] = useState(() => readSavedAgent(userId));
  const [draft, setDraft] = useState("");
  const [freeform, setFreeform] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = mode === "docked";
  const shape = "docked";

  const agent = useEveAgent({
    initialEvents: saved.events as readonly MessageStreamEvent[],
    initialSession: saved.session,
    // The transcript says only that the turn failed. The reason belongs here,
    // where it can be read while debugging, and not in front of the user.
    onEvent: (event: MessageStreamEvent) => {
      if (event.type === "turn.failed") {
        console.error("[agent] turn failed", event.data);
      }
    },
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
  const runningTurn = isBusy ? activeTurnId(agent.events) : undefined;
  const isRunning = (message: EveMessage) =>
    message.role === "assistant" &&
    runningTurn !== undefined &&
    message.metadata?.turnId === runningTurn;

  // A turn that fails before its first model call — a hook or a dynamic
  // instruction that threw — never gets an assistant message to render into.
  const turnsWithMessage = new Set(
    agent.data.messages.flatMap((message) =>
      message.role === "assistant" && message.metadata?.turnId
        ? [message.metadata.turnId]
        : [],
    ),
  );
  const unshownFailures = [...failedTurns(agent.events)].filter(
    (turnId) => !turnsWithMessage.has(turnId),
  );

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [agent.data.messages]);

  /* Closed, the panel is invisible, so the trigger carries the running turn. */
  useEffect(() => {
    onBusyChange(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (mode !== "closed") inputRef.current?.focus();
  }, [mode]);

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
    onModeChange("docked");
    void agent.send(message);
  }

  return (
    <div
      className={styles.layer}
      data-mode={mode}
      data-shape={shape}
      inert={mode === "closed"}
    >
      <button
        className={styles.backdrop}
        aria-label="Dismiss the agent"
        tabIndex={-1}
        type="button"
        onClick={() => onModeChange("closed")}
      />

      <section className={styles.panel} aria-labelledby="agent-heading">
        <div className={styles.panelHeading}>
          <h2 className={styles.eyebrow} id="agent-heading">SS Agent</h2>
          <div className={styles.headingActions}>
            {expanded ? (
              <button
                className={styles.quietButton}
                disabled={isBusy}
                type="button"
                onClick={() => {
                  agent.reset();
                  clearSavedAgent(userId);
                  onModeChange("docked");
                }}
              >
                <ArrowsClockwise size={14} aria-hidden="true" />
                New conversation
              </button>
            ) : null}
            <button
              className={styles.closeButton}
              aria-label="Close the agent"
              type="button"
              onClick={() => onModeChange("closed")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.transcript} ref={transcriptRef} aria-live="polite">
          {agent.data.messages.map((message) => {
            if (isRunning(message)) return <WorkingMessage key={message.id} />;
            const text = messageText(message);
            if (!text) {
              return message.role === "assistant" ? (
                <FailedMessage key={message.id} />
              ) : null;
            }
            return (
              <Message key={message.id} role={message.role}>
                <p className={styles.messageText}>{text}</p>
              </Message>
            );
          })}

          {unshownFailures.map((turnId) => (
            <FailedMessage key={turnId} />
          ))}

          {isBusy && !agent.data.messages.some(isRunning) ? (
            <WorkingMessage />
          ) : null}

          {request ? (
            <fieldset className={styles.prompt}>
              <legend>
                {request.kind === "tool-approval" ? "Approval" : "One question"}
              </legend>
              <p>{request.prompt}</p>
              <div className={styles.promptOptions}>
                {request.options?.map((option) => (
                  <button
                    className={styles.promptButton}
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
                    className={styles.answerInput}
                    aria-label="Answer"
                    value={freeform}
                    onChange={(event) => setFreeform(event.target.value)}
                  />
                  <button className={styles.promptButton} type="submit">
                    Answer
                  </button>
                </form>
              ) : null}
            </fieldset>
          ) : null}

          {agent.error ? (
            <p className={styles.error}>
              <WarningCircle size={16} aria-hidden="true" />
              {agent.error.message}
            </p>
          ) : null}
        </div>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            aria-label="Ask the calendar agent"
            disabled={!connected || isBusy}
            placeholder={
              connected ? "Ask SS to manage your calendar…" : "Connect Google Calendar first"
            }
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {isBusy ? (
            <button
              className={styles.stopButton}
              type="button"
              onClick={() => agent.stop()}
            >
              <Stop size={14} weight="fill" aria-hidden="true" />
              Stop
            </button>
          ) : (
            <button
              className={styles.sendButton}
              type="submit"
              disabled={!connected || !draft.trim()}
              aria-label="Send"
            >
              <PaperPlaneTilt size={18} aria-hidden="true" />
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

/**
 * Closed, the panel keeps running: unmounting it would drop a turn already in
 * flight and tear down the live stream behind it.
 */
export type AgentMode = "closed" | "docked";

interface AgentPanelProps {
  connected: boolean;
  mode: AgentMode;
  onBusyChange(busy: boolean): void;
  onCalendarChanged(): void;
  onModeChange(mode: AgentMode): void;
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
