import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

/**
 * Shared sensor config for every kanban board (Leads/Company tasks/Projects/Workspace).
 * PointerSensor covers mouse/pen with a small movement threshold so a plain click doesn't
 * start a drag. TouchSensor needs its own activation delay — without it, the very first
 * touchmove of a normal scroll gesture inside a column would be captured as a drag, making
 * the column unscrollable on phones/tablets.
 */
export function useKanbanSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
}
