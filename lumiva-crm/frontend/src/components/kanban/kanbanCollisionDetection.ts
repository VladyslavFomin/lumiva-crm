import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';

/**
 * `closestCenter` (dnd-kit's other common choice) picks the droppable whose CENTER is nearest
 * to the dragged item's center — for a row of side-by-side columns that means you have to drag
 * roughly past the midpoint between two columns before a drop into the neighboring one even
 * registers, which reads as "it won't let me drop it here" on a short/adjacent-column drag.
 * `pointerWithin` instead resolves to whichever column your pointer is literally inside right
 * now — the intuitive "I dropped it inside this column" behavior real kanban boards use. Falls
 * back to `rectIntersection` for the rare case the pointer ends up over a gap between columns
 * with no direct pointerWithin match (e.g. a fast drag that overshoots the gutter).
 */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};
