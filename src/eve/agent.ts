import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta";

import { todayKey } from "@/calendar/date-time";
import type { CalendarService } from "@/calendar/types";

import { createEveTools } from "./tools";

export const EVE_MODEL = "claude-opus-5";
export const EVE_REFUSAL_TEXT = "Sorry, I can't help with that.";

export function buildEveSystemPrompt(timeZone: string, now = new Date()): string {
  const today = todayKey(timeZone, now);
  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "long",
    timeZone,
  }).format(now);
  return `You are Eve, the user's personal calendar assistant. They text you on WhatsApp; you manage their calendar with your tools.

Today is ${weekday}, ${today}, in the user's timezone, ${timeZone}. Resolve every relative expression ("tomorrow", "next Friday", "in two weeks") against this before calling tools.

Working rules:
- The calendar lives behind your tools; never answer about existing events from memory. Check with list_events first.
- Before update_event or delete_event, resolve the target with list_events in this same turn and copy eventId and occurrenceStart exactly.
- When the user gives no duration, use 60 minutes and mention the assumption.
- For an edit or delete of a repeating event, take the scope from their wording; if it is unclear whether they mean one occurrence or the whole series, ask a short clarifying question before acting.
- Confirm before deleting an entire repeating series. Everything else the user explicitly asked for: act first, confirm after.
- Say times in the user's timezone unless the event carries another; write them like 3:30pm, and dates like Fri Aug 14.

Style:
- Text like a sharp, warm human assistant: short messages, no corporate filler, no emoji unless the user uses them.
- WhatsApp formatting only: plain text with optional *bold* for key facts. No markdown headings, tables, or long bullet lists.
- After a successful action, confirm in one line with the key facts (title, date, time).`;
}

export interface EveTurnOptions {
  service: CalendarService;
  /** The user's IANA timezone, e.g. "Europe/Madrid". */
  timeZone: string;
  /** The incoming WhatsApp message text. */
  userMessage: string;
  /** Prior conversation, as returned in a previous EveTurnResult. */
  history?: BetaMessageParam[];
  client?: Anthropic;
  now?: Date;
  maxIterations?: number;
}

export interface EveTurnResult {
  /** Eve's reply, ready to send back over WhatsApp. */
  text: string;
  /** Full conversation including this turn's tool calls; persist and pass back as history. */
  messages: BetaMessageParam[];
  stopReason: BetaMessage["stop_reason"];
}

export async function runEveTurn(options: EveTurnOptions): Promise<EveTurnResult> {
  const client = options.client ?? new Anthropic();
  const tools = createEveTools(options.service, { timeZone: options.timeZone });
  const runner = client.beta.messages.toolRunner({
    model: EVE_MODEL,
    max_tokens: 16_000,
    thinking: { type: "adaptive" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: buildEveSystemPrompt(options.timeZone, options.now),
    messages: [
      ...(options.history ?? []),
      { role: "user", content: options.userMessage },
    ],
    tools: Object.values(tools),
    max_iterations: options.maxIterations ?? 10,
  });
  const finalMessage = await runner;
  const text = finalMessage.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return {
    text: text || (finalMessage.stop_reason === "refusal" ? EVE_REFUSAL_TEXT : text),
    messages: [...runner.params.messages],
    stopReason: finalMessage.stop_reason,
  };
}
