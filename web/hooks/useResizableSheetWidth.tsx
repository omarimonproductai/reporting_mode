"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared resizable-width state for every right-side Sheet in the app
 * (Mode preview, Dry-run, Prompt Assistant, History drawer). A single
 * localStorage key — `right-sheet:width` — backs all four so the user
 * has a coherent visual rhythm when alternating between Sheets.
 *
 * Consumers receive `{ width, handleProps }` and own the markup for
 * the handle element. The hook covers pointer-capture drag logic,
 * persistence, and the min/max/default clamps.
 */

const MIN_WIDTH = 480;
const MAX_WIDTH = 1400;
const DEFAULT_WIDTH = 672;
const STORAGE_KEY = "right-sheet:width";

function loadWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < MIN_WIDTH || n > MAX_WIDTH) {
    return DEFAULT_WIDTH;
  }
  return n;
}

type HandleProps = {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
};

export function useResizableSheetWidth(): {
  width: number;
  handleProps: HandleProps;
} {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null
  );

  // Rehydrate from localStorage after mount so SSR output stays
  // deterministic (default width).
  useEffect(() => {
    setWidth(loadWidth());
  }, []);

  // Pointer-capture on the handle element binds the pointer for the
  // duration of the drag, so move/up events route to the handle
  // regardless of cursor position. This was the fix in PreviewSheet's
  // commit dcb64d0 — kept here verbatim.
  //
  // stopPropagation is also necessary: shadcn's Sheet wraps a Radix
  // DismissableLayer that listens for pointerdown to detect
  // interactions outside the Content. The handle visually sits at the
  // very edge of the Content and Radix can mis-classify the drag as
  // an outside interaction, dismissing the Sheet mid-resize. Stopping
  // propagation keeps the event local to the handle.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, startWidth: width };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = dragStateRef.current;
    if (!s) return;
    // The handle is on the LEFT edge of a right-anchored Sheet: moving
    // the pointer left of the start position grows the panel.
    const dx = s.startX - e.clientX;
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, s.startWidth + dx));
    setWidth(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — capture may have been released already
    }
    const finalWidth = (() => {
      const s = dragStateRef.current;
      if (!s) return width;
      const dx = s.startX - e.clientX;
      return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, s.startWidth + dx));
    })();
    dragStateRef.current = null;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(finalWidth));
    } catch {
      // ignore quota / disabled storage
    }
  }

  return {
    width,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}
