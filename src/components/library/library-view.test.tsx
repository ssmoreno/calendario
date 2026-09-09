import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/library/actions", () => ({
  createLibraryItemAction: vi.fn(),
}));

import { LibraryBrowser, LibraryControls } from "./library-view";

describe("LibraryControls", () => {
  it("keeps the creation form out of the default library view", () => {
    render(<LibraryControls availableTags={[]} />);

    expect(screen.queryByRole("form", { name: "Create library item" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to library" })).toBeDefined();
  });

  it("opens one tagged-link form", async () => {
    render(<LibraryControls availableTags={["article", "Personal"]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add to library" }));
    expect(screen.getByRole("dialog", { name: "Add to your library" })).toBeDefined();
    expect(screen.getByRole("form", { name: "Create library item" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Tags" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Note (optional)" })).toBeDefined();
    expect(
      screen
        .getByRole("textbox", { name: "Link (optional)" })
        .hasAttribute("required"),
    ).toBe(false);
    expect(screen.getAllByRole("checkbox", { name: /article/i })).toHaveLength(
      1,
    );
    expect(screen.getByRole("checkbox", { name: "Personal" })).toBeDefined();
    expect(screen.queryByText("Category")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("form", { name: "Create library item" })).toBeNull();
  });
});

const items = [
  {
    id: "one",
    title: "Prisma guide",
    description: "Type-safe queries.",
    note: null,
    link: "https://prisma.io",
    tags: ["Coding"],
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "two",
    title: "Sourdough",
    description: "Bread that takes days.",
    note: "Feed the starter twice a day.",
    link: null,
    tags: ["Recipe", "Food"],
    createdAt: "2026-09-02T00:00:00.000Z",
  },
  {
    id: "three",
    title: "Type-safe forms",
    description: "Validation without duplication.",
    note: null,
    link: null,
    tags: ["Coding", "Article"],
    createdAt: "2026-09-03T00:00:00.000Z",
  },
];

const availableTags = ["Article", "Coding", "Food", "Recipe"];

function visibleTitles(): string[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.textContent ?? "")
    .map((text) => text.trim());
}

describe("LibraryBrowser", () => {
  it("filters as you type, with no search button", async () => {
    render(<LibraryBrowser items={items} availableTags={availableTags} />);

    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText("Note")).toBeDefined();
    expect(screen.getAllByText("View")).toHaveLength(2);

    await userEvent.type(screen.getByRole("searchbox"), "type-safe");
    expect(visibleTitles().some((text) => text.includes("Prisma guide"))).toBe(
      true,
    );
    expect(
      visibleTitles().some((text) => text.includes("Type-safe forms")),
    ).toBe(true);
    expect(visibleTitles().some((text) => text.includes("Sourdough"))).toBe(
      false,
    );
    expect(screen.getByText("2 of 3 items")).toBeDefined();
  });

  it("matches the note, and shows nothing when no item matches", async () => {
    render(<LibraryBrowser items={items} availableTags={availableTags} />);

    await userEvent.type(screen.getByRole("searchbox"), "starter");
    expect(visibleTitles()).toHaveLength(1);
    expect(visibleTitles()[0]).toContain("Sourdough");

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("No matching items")).toBeDefined();
  });

  it("narrows on tag press and keeps earlier tags selected", async () => {
    render(<LibraryBrowser items={items} availableTags={availableTags} />);

    const coding = screen.getByRole("button", { name: "Coding", pressed: false });
    await userEvent.click(coding);
    expect(coding.getAttribute("aria-pressed")).toBe("true");
    expect(visibleTitles()).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Article" }));
    expect(
      screen.getByRole("button", { name: "Coding" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(visibleTitles()).toHaveLength(1);
    expect(visibleTitles()[0]).toContain("Type-safe forms");

    await userEvent.click(screen.getByRole("button", { name: "Article" }));
    expect(visibleTitles()).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(visibleTitles()).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Coding" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
