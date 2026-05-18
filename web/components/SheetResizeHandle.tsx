"use client";

import { GripVertical } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * Visible, draggable handle for resizing right-anchored Sheets. Pair
 * with `useResizableSheetWidth()` — pass `handleProps` straight from
 * the hook. The handle is intentionally always-visible (not just on
 * hover) so users discover the resize affordance without trial and
 * error.
 */
export function SheetResizeHandle(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      aria-hidden
      // - w-2 (8px) instead of w-1.5: easier to grab on touchpad.
      // - bg-zinc-100 default + bg-zinc-200 on hover: visible at rest,
      //   gives feedback on hover. Previously the line was almost
      //   invisible on white (transparent default), so users assumed
      //   the feature didn't exist.
      // - text-zinc-500 default icon: dark enough to be discoverable;
      //   text-zinc-700 on hover for emphasis.
      // - before:* extends the hit area ~6px each side beyond the
      //   visible 8px line, totalling a 20px hit target.
      // - [&_svg]:pointer-events-none: lucide icons default to
      //   pointer-events: auto, which would swallow the pointerdown
      //   before the wrapper's listener fires.
      className="group absolute inset-y-0 left-0 z-30 flex w-2 cursor-col-resize touch-none select-none items-center justify-center bg-zinc-100 transition-colors before:absolute before:-left-1.5 before:-right-1.5 before:inset-y-0 before:content-[''] hover:bg-zinc-200 [&_svg]:pointer-events-none"
    >
      <GripVertical className="size-3 text-zinc-500 transition-colors group-hover:text-zinc-700" />
    </div>
  );
}
