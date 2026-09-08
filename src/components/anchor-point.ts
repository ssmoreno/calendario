"use client";

import { useCallback, useMemo, useState } from "react";
import type { PressEvent } from "react-aria-components";

interface Anchor {
  onPress(event: PressEvent): void;
  getTargetRect?: (target: Element) => DOMRect;
}

export function useAnchorPoint(): Anchor {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  const onPress = useCallback((event: PressEvent) => {
    if (event.pointerType === "keyboard" || event.pointerType === "virtual") {
      setPoint(null);
      return;
    }
    const rect = event.target.getBoundingClientRect();
    setPoint({ x: rect.left + event.x, y: rect.top + event.y });
  }, []);

  const getTargetRect = useMemo(
    () => (point ? () => new DOMRect(point.x, point.y, 0, 0) : undefined),
    [point],
  );

  return { onPress, getTargetRect };
}
