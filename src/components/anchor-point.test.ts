import { act, renderHook } from "@testing-library/react";
import type { PressEvent } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";

import { useAnchorPoint } from "./anchor-point";

function pressEvent(
  target: Element,
  pointerType: PressEvent["pointerType"],
): PressEvent {
  return {
    target,
    pointerType,
    x: 20,
    y: 30,
  } as PressEvent;
}

describe("useAnchorPoint", () => {
  it("converts pointer coordinates from the target to the viewport", () => {
    const target = document.createElement("button");
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 200, 300, 80),
    );
    const { result } = renderHook(() => useAnchorPoint());

    act(() => result.current.onPress(pressEvent(target, "mouse")));

    expect(result.current.getTargetRect?.(target)).toEqual(
      new DOMRect(120, 230, 0, 0),
    );
  });

  it("keeps the trigger as the anchor for keyboard presses", () => {
    const target = document.createElement("button");
    const { result } = renderHook(() => useAnchorPoint());

    act(() => result.current.onPress(pressEvent(target, "keyboard")));

    expect(result.current.getTargetRect).toBeUndefined();
  });
});
