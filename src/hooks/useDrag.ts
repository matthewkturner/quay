import { useCallback, useEffect, useRef } from 'react';

interface DragOptions {
  onStart?: () => void;
  onDrag: (dx: number, dy: number) => void;
  cursor?: string;
}

export function useDrag({ onStart, onDrag, cursor = 'col-resize' }: DragOptions) {
  const onDragRef = useRef(onDrag);
  const onStartRef = useRef(onStart);
  useEffect(() => {
    onDragRef.current = onDrag;
    onStartRef.current = onStart;
  });

  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      onStartRef.current?.();

      const onMouseMove = (ev: MouseEvent) => {
        onDragRef.current(ev.clientX - startX, ev.clientY - startY);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [cursor],
  );
}
