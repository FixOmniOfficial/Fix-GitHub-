import { useRef, useCallback } from 'react';

interface LongPressOptions {
  delay?: number;
  onLongPress: () => void;
  onClick?: () => void;
}

export function useLongPress({ delay = 600, onLongPress, onClick }: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Only mouse left-click or touch
    if ('button' in e && e.button !== 0) return;
    triggered.current = false;
    timerRef.current = setTimeout(() => {
      triggered.current = true;
      onLongPress();
    }, delay);
  }, [delay, onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const end = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    cancel();
    if (!triggered.current && onClick) {
      onClick();
    }
  }, [cancel, onClick]);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchMove: cancel,
  };
}
