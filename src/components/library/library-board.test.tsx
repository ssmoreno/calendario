import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SavedItemKind, SavedItemRecord } from "@/library/types";

import { LibraryBoard } from "./library-board";

function saved(
  id: string,
  kind: SavedItemKind,
  title: string,
): SavedItemRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    domain: "example.com",
    title,
    summary: null,
    kind,
    note: null,
    createdAt: "2026-09-01T10:00:00Z",
  };
}

const ITEMS = [
  saved("a1", "article", "Battery chemistry"),
  saved("r1", "recipe", "Cacio e Pepe"),
  saved("r2", "recipe", "Olive oil cake"),
  saved("v1", "video", "Voyager"),
];

function renderBoard(onForget = vi.fn().mockResolvedValue(true)) {
  render(<LibraryBoard items={ITEMS} onForget={onForget} />);
  return onForget;
}

describe("LibraryBoard", () => {
  it("counts every drawer and opens the first filled one", () => {
    renderBoard();

    expect(
      screen.getByRole("button", { name: /Recipes/ }).textContent,
    ).toContain("02");
    expect(screen.getByRole("button", { name: /Links/ }).textContent).toContain(
      "00",
    );
    expect(
      screen.getByRole("button", { name: /Articles/ }).getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: /Battery chemistry/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Cacio e Pepe/ })).toBeNull();
  });

  it("keeps only one drawer open", async () => {
    renderBoard();

    await userEvent.click(screen.getByRole("button", { name: /Recipes/ }));

    expect(screen.getByRole("button", { name: /Cacio e Pepe/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Olive oil cake/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Battery chemistry/ })).toBeNull();
  });

  it("shuts an open drawer rather than leaving it stuck open", async () => {
    renderBoard();

    await userEvent.click(screen.getByRole("button", { name: /Articles/ }));

    expect(screen.queryByRole("button", { name: /Battery chemistry/ })).toBeNull();
  });

  it("forgets the item whose panel is open", async () => {
    const onForget = renderBoard();

    await userEvent.click(screen.getByRole("button", { name: /Battery chemistry/ }));
    await userEvent.click(screen.getByRole("button", { name: "Forget" }));

    expect(onForget).toHaveBeenCalledWith("a1");
  });
});
