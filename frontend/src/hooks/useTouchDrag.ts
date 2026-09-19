import { useEffect, useRef, useCallback } from 'react';

interface TouchDragOptions {
  onDragStart: (entryId: string, sourceDate: Date) => void;
  onDrop: (targetDate: Date) => void;
  onDragEnd: () => void;
  getEntryIdFromElement: (el: Element) => string | null;
  getDateFromElement: (el: Element) => Date | null;
}

/**
 * Custom hook for touch-based drag and drop on calendar entries.
 * HTML5 drag-and-drop doesn't work on touch devices, so we implement
 * a custom touch handler that simulates the same behavior.
 */
export function useTouchDrag({
  onDragStart,
  onDrop,
  onDragEnd,
  getEntryIdFromElement,
  getDateFromElement,
}: TouchDragOptions) {
  const dragState = useRef<{
    entryId: string;
    sourceDate: Date;
    ghostEl: HTMLElement | null;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const DRAG_THRESHOLD = 10; // pixels before drag starts

  const createGhost = useCallback((entryEl: HTMLElement): HTMLElement => {
    const ghost = entryEl.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.zIndex = '10000';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.8';
    ghost.style.transform = 'scale(1.05)';
    ghost.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
    ghost.style.width = `${entryEl.offsetWidth}px`;
    document.body.appendChild(ghost);
    return ghost;
  }, []);

  const findDropTarget = useCallback(
    (x: number, y: number): Date | null => {
      // Hide ghost temporarily to get the element underneath
      if (dragState.current?.ghostEl) {
        dragState.current.ghostEl.style.display = 'none';
      }
      const el = document.elementFromPoint(x, y);
      if (dragState.current?.ghostEl) {
        dragState.current.ghostEl.style.display = '';
      }

      if (!el) return null;

      // Walk up to find a calendar-day element
      let current: Element | null = el;
      while (current && !current.classList.contains('calendar-day')) {
        current = current.parentElement;
      }

      if (current) {
        return getDateFromElement(current);
      }
      return null;
    },
    [getDateFromElement]
  );

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const entryEl = target.closest('.calendar-entry') as HTMLElement | null;
      if (!entryEl) return;

      const entryId = getEntryIdFromElement(entryEl);
      if (!entryId) return;

      // Find the source date from the parent calendar-day
      const dayEl = entryEl.closest('.calendar-day');
      const sourceDate = dayEl ? getDateFromElement(dayEl) : null;
      if (!sourceDate) return;

      const touch = e.touches[0];
      dragState.current = {
        entryId,
        sourceDate,
        ghostEl: null,
        startX: touch.clientX,
        startY: touch.clientY,
        isDragging: false,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragState.current) return;

      const touch = e.touches[0];
      const dx = touch.clientX - dragState.current.startX;
      const dy = touch.clientY - dragState.current.startY;

      // Start dragging if moved beyond threshold
      if (
        !dragState.current.isDragging &&
        (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)
      ) {
        dragState.current.isDragging = true;
        const entryEl = document.querySelector(`[data-entry-id="${dragState.current.entryId}"]`);
        if (entryEl) {
          dragState.current.ghostEl = createGhost(entryEl as HTMLElement);
          (entryEl as HTMLElement).classList.add('calendar-entry--dragging');
        }
        onDragStart(dragState.current.entryId, dragState.current.sourceDate);
      }

      if (dragState.current.isDragging && dragState.current.ghostEl) {
        e.preventDefault();
        const ghost = dragState.current.ghostEl;
        ghost.style.left = `${touch.clientX - ghost.offsetWidth / 2}px`;
        ghost.style.top = `${touch.clientY - ghost.offsetHeight / 2}px`;

        // Highlight drop target
        document.querySelectorAll('.calendar-day--touch-drop-target').forEach((el) => {
          el.classList.remove('calendar-day--touch-drop-target');
        });
        const dropDate = findDropTarget(touch.clientX, touch.clientY);
        if (dropDate) {
          const dropEl = document.querySelector(`[data-date="${dropDate.toISOString()}"]`);
          if (dropEl) {
            dropEl.classList.add('calendar-day--touch-drop-target');
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!dragState.current) return;

      if (dragState.current.isDragging) {
        const touch = e.changedTouches[0];
        const dropDate = findDropTarget(touch.clientX, touch.clientY);

        // Clean up ghost
        if (dragState.current.ghostEl) {
          dragState.current.ghostEl.remove();
        }

        // Clean up dragging class
        const entryEl = document.querySelector(`[data-entry-id="${dragState.current.entryId}"]`);
        if (entryEl) {
          (entryEl as HTMLElement).classList.remove('calendar-entry--dragging');
        }

        // Clean up drop target highlights
        document.querySelectorAll('.calendar-day--touch-drop-target').forEach((el) => {
          el.classList.remove('calendar-day--touch-drop-target');
        });

        if (dropDate) {
          onDrop(dropDate);
        } else {
          onDragEnd();
        }
      }

      dragState.current = null;
    };

    // Attach listeners to the calendar grid
    const grid = document.querySelector('.calendar-grid');
    if (grid) {
      grid.addEventListener('touchstart', handleTouchStart, { passive: true });
      grid.addEventListener('touchmove', handleTouchMove, { passive: false });
      grid.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (grid) {
        grid.removeEventListener('touchstart', handleTouchStart);
        grid.removeEventListener('touchmove', handleTouchMove);
        grid.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [
    onDragStart,
    onDrop,
    onDragEnd,
    getEntryIdFromElement,
    getDateFromElement,
    createGhost,
    findDropTarget,
  ]);
}
