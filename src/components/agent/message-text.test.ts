import { describe, expect, it } from "vitest";
import type { EveMessage } from "eve/react";

import { messageText } from "./message-text";

function message(role: EveMessage["role"], ...texts: string[]): EveMessage {
  return {
    id: `turn_1:${role}`,
    metadata: { status: "complete", turnId: "turn_1" },
    parts: texts.map((text) => ({ state: "done", text, type: "text" as const })),
    role,
  };
}

describe("messageText", () => {
  it("shows the agent's last text, not the narration before the tool call", () => {
    expect(
      messageText(
        message(
          "assistant",
          "Listo — cumple de Teo hoy de 20:00 a 01:00 en Castelar",
          "Ya está: cumple de Teo hoy 20:00, con recordatorio 30 minutos antes",
        ),
      ),
    ).toBe("Ya está: cumple de Teo hoy 20:00, con recordatorio 30 minutos antes");
  });

  it("falls back to the narration when the turn produced nothing after it", () => {
    expect(messageText(message("assistant", "Creando el evento…"))).toBe(
      "Creando el evento…",
    );
    expect(messageText(message("assistant"))).toBe("");
  });

  it("drops emphasis markers the agent wrote, and leaves unpaired ones", () => {
    expect(messageText(message("assistant", "Listo — **Cumple de Teo** hoy"))).toBe(
      "Listo — Cumple de Teo hoy",
    );
    expect(messageText(message("assistant", "Guardé `Cumple Teo`"))).toBe(
      "Guardé Cumple Teo",
    );
    expect(messageText(message("assistant", "Cita 5 * 3 sin cierre **"))).toBe(
      "Cita 5 * 3 sin cierre **",
    );
  });

  it("shows what the user typed exactly, across every part", () => {
    expect(messageText(message("user", "recordá `cumple teo` **hoy**"))).toBe(
      "recordá `cumple teo` **hoy**",
    );
    expect(messageText(message("user", "cumple teo", "en castelar"))).toBe(
      "cumple teo\nen castelar",
    );
  });
});
