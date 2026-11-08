import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onRelease?: () => void;
  ms?: number;
}

export function useLongPress({ onLongPress, onRelease, ms = 600 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault?.();
      setIsPressed(true);
      timerRef.current = setTimeout(() => {
        onLongPress();
      }, ms);
    },
    [onLongPress, ms]
  );

  const end = useCallback(() => {
    setIsPressed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onRelease?.();
  }, [onRelease]);

  const move = useCallback(() => {
    setIsPressed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    isPressed,
    handlers: {
      onMouseDown: start,
      onMouseUp: end,
      onMouseLeave: end,
      onTouchStart: start,
      onTouchEnd: end,
      onTouchMove: move,
    },
  };
}
