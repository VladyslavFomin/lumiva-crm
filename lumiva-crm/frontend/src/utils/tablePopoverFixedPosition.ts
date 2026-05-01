import type { CSSProperties } from 'react';

const GAP = 6;
const VIEW_MARGIN = 10;
const DEFAULT_MAX_SCROLL = 380;
/** If less space below than this (px), try opening upward */
const FLIP_THRESHOLD = 180;

export type FixedPopoverLayout = {
  style: CSSProperties;
  scrollMaxHeight: number;
};

/**
 * Places a table cell popover with position:fixed (escapes overflow:hidden on wrappers).
 * Chooses above/below the anchor like compact status menus; scroll area height is capped to the viewport.
 */
export function getFixedPopoverLayout(
  anchorRect: DOMRect,
  opts?: { popoverWidth?: number; maxScroll?: number },
): FixedPopoverLayout {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const maxScrollCap = opts?.maxScroll ?? DEFAULT_MAX_SCROLL;
  const width = Math.min(opts?.popoverWidth ?? 320, vw - 2 * VIEW_MARGIN);

  let left = anchorRect.left;
  if (left + width > vw - VIEW_MARGIN) {
    left = Math.max(VIEW_MARGIN, vw - VIEW_MARGIN - width);
  }
  if (left < VIEW_MARGIN) left = VIEW_MARGIN;

  const spaceBelow = vh - anchorRect.bottom - GAP - VIEW_MARGIN;
  const spaceAbove = anchorRect.top - GAP - VIEW_MARGIN;
  const openUp =
    spaceBelow < FLIP_THRESHOLD && spaceAbove > spaceBelow && spaceAbove > 80;

  let style: CSSProperties;
  let scrollMaxHeight: number;

  if (openUp) {
    const bottom = vh - anchorRect.top + GAP;
    style = {
      position: 'fixed',
      left,
      width,
      bottom,
      top: 'auto',
      zIndex: 70,
    };
    scrollMaxHeight = Math.min(maxScrollCap, Math.max(120, spaceAbove));
  } else {
    const top = anchorRect.bottom + GAP;
    style = {
      position: 'fixed',
      left,
      width,
      top,
      bottom: 'auto',
      zIndex: 70,
    };
    scrollMaxHeight = Math.min(maxScrollCap, Math.max(120, spaceBelow));
  }

  return { style, scrollMaxHeight };
}
