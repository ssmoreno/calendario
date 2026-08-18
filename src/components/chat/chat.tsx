"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import type {
  EveMessageInputRequest,
  EveMessagePart,
  UseEveAgentSnapshot,
} from "eve/react";
import type { EveMessageData } from "eve/react";

import styles from "./chat.module.css";

export interface ChatSnapshot {
  events: readonly MessageStreamEvent[];
  session: ClientSessionState | undefined;
}

interface ChatProps {
  initialEvents: readonly MessageStreamEvent[];
  initialSession: ClientSessionState | undefined;
  onPersist(snapshot: ChatSnapshot): void;
  onForget(): void;
}

function pendingRequests(
  data: EveMessageData,
): readonly EveMessageInputRequest[] {
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

function toolLabel(part: Extract<EveMessagePart, { type: "dynamic-tool" }>) {
  const detail =
    part.state === "output-error"
      ? part.errorText
      : part.state === "output-denied"
        ? "denied"
        : part.state;
  return `${part.toolName} · ${detail}`;
}

function MessagePart({ part }: { part: EveMessagePart }) {
  if (part.type === "text") return <p className={styles.text}>{part.text}</p>;
  if (part.type === "reasoning") {
    return <p className={styles.reasoning}>{part.text}</p>;
  }
  if (part.type === "dynamic-tool") {
    return <p className={styles.tool}>{toolLabel(part)}</p>;
  }
  return null;
}

export function Chat({
  initialEvents,
  initialSession,
  onPersist,
  onForget,
}: ChatProps) {
  const [draft, setDraft] = useState("");
  const [freeform, setFreeform] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  const agent = useEveAgent({
    initialEvents,
    initialSession,
    prepareSend: (payload) => ({
      ...payload,
      clientContext: `Device timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    }),
    onFinish: (snapshot: UseEveAgentSnapshot<EveMessageData>) =>
      onPersist({ events: snapshot.events, session: snapshot.session }),
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const requests = pendingRequests(agent.data);
  const request = requests.at(-1);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [agent.data.messages]);

  function respond(response: { requestId: string; optionId?: string; text?: string }) {
    setFreeform("");
    void agent.respond([response]);
  }

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <h1 className={styles.title}>Eve calendar agent</h1>
        <span className={styles.status}>{agent.status}</span>
        <button
          className={styles.button}
          disabled={isBusy}
          onClick={() => {
            agent.reset();
            onForget();
          }}
          type="button"
        >
          New session
        </button>
      </div>

      <div className={styles.transcript} ref={transcriptRef}>
        {agent.data.messages.map((message) => (
          <article className={styles.message} key={message.id}>
            <span className={styles.role}>{message.role}</span>
            {message.parts.map((part, index) => (
              <MessagePart key={index} part={part} />
            ))}
          </article>
        ))}

        {request ? (
          <fieldset className={styles.prompt}>
            <legend className={styles.role}>
              {request.kind === "tool-approval" ? "Approval" : "Question"}
            </legend>
            <p className={styles.promptText}>{request.prompt}</p>
            <div className={styles.promptOptions}>
              {request.options?.map((option) => (
                <button
                  className={styles.button}
                  key={option.id}
                  onClick={() =>
                    respond({ optionId: option.id, requestId: request.requestId })
                  }
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {request.allowFreeform || !request.options?.length ? (
              <form
                className={styles.composer}
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = freeform.trim();
                  if (text) respond({ requestId: request.requestId, text });
                }}
              >
                <input
                  aria-label="Answer"
                  className={styles.input}
                  onChange={(event) => setFreeform(event.target.value)}
                  value={freeform}
                />
                <button className={styles.button} type="submit">
                  Answer
                </button>
              </form>
            ) : null}
          </fieldset>
        ) : null}

        {agent.error ? <p className={styles.error}>{agent.error.message}</p> : null}
      </div>

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          const message = draft.trim();
          if (!message) return;
          setDraft("");
          void agent.send(message);
        }}
      >
        <input
          aria-label="Message"
          className={styles.input}
          disabled={isBusy}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Eve about your calendar"
          value={draft}
        />
        <button className={styles.button} disabled={isBusy} type="submit">
          Send
        </button>
        <button
          className={styles.button}
          disabled={!isBusy}
          onClick={() => agent.stop()}
          type="button"
        >
          Stop
        </button>
      </form>
    </div>
  );
}
