import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/library/actions", () => ({
  createLibraryItemAction: vi.fn(),
}));

import { LibraryControls } from "./library-view";

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
    expect(screen.getByRole("textbox", { name: "The read (optional)" })).toBeDefined();
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
