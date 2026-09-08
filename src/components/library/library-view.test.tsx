import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/library/actions", () => ({
  createCategoryAction: vi.fn(),
  createLibraryItemAction: vi.fn(),
}));

import { LibraryControls } from "./library-view";

const CATEGORIES = [{ id: "reference", name: "Reference" }];

describe("LibraryControls", () => {
  it("keeps creation forms out of the default library view", () => {
    render(<LibraryControls categories={CATEGORIES} />);

    expect(screen.queryByRole("form", { name: "Create category" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Create library item" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to library" })).toBeDefined();
  });

  it("opens item creation and offers category creation in the dialog", async () => {
    render(<LibraryControls categories={CATEGORIES} />);

    await userEvent.click(screen.getByRole("button", { name: "Add to library" }));
    expect(screen.getByRole("dialog", { name: "Add to your library" })).toBeDefined();
    expect(screen.getByRole("form", { name: "Create library item" })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Category" }));
    expect(screen.getByRole("form", { name: "Create category" })).toBeDefined();
    expect(screen.queryByRole("form", { name: "Create library item" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Add to library" }));
    expect(screen.getByRole("form", { name: "Create library item" })).toBeDefined();
  });

  it("starts with category creation when the library is empty", async () => {
    render(<LibraryControls categories={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add to library" }));
    expect(screen.getByRole("form", { name: "Create category" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Item" })).toBeNull();
  });
});
