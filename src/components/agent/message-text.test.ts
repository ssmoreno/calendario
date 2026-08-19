import { describe, expect, it } from "vitest";
import type { EveMessage } from "eve/react";

import { plainText, replyText } from "./message-text";

function assistantMessage(...texts: string[]): EveMessage {
  return {
    id: "turn_1:assistant",
    metadata: { status: "complete", turnId: "turn_1" },
    parts: texts.map((text) => ({ state: "done", text, type: "text" as const })),
    role: "assistant",
  };
}

describe("replyText", () => {
  it("takes the last text, not the narration before the tool call", () => {
    const message = assistantMessage(
      "Listo — cumple de Teo hoy de 20:00 a 01:00 en Castelar",
      "Ya está: cumple de Teo hoy 20:00, con recordatorio 30 minutos antes",
    );

    expect(replyText(message)).toBe(
      "Ya está: cumple de Teo hoy 20:00, con recordatorio 30 minutos antes",
    );
  });

  it("falls back to the narration when the turn ended with nothing", () => {
    expect(replyText(assistantMessage("Creando el evento…", "   "))).toBe(
      "Creando el evento…",
    );
    expect(replyText(assistantMessage())).toBe("");
  });
});

describe("plainText", () => {
  it("drops emphasis markers around the text they wrap", () => {
    expect(plainText("Listo — **Cumple de Teo** hoy a las 20:00")).toBe(
      "Listo — Cumple de Teo hoy a las 20:00",
    );
    expect(plainText("__Cena__ con Ana")).toBe("Cena con Ana");
    expect(plainText("Guardé `Cumple Teo`")).toBe("Guardé Cumple Teo");
  });

  it("leaves unpaired markers and ordinary punctuation alone", () => {
    expect(plainText("Cita 5 * 3 sin cierre **")).toBe("Cita 5 * 3 sin cierre **");
    expect(plainText("Tarea__pendiente")).toBe("Tarea__pendiente");
  });
});
