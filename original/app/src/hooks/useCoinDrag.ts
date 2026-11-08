import { useCallback, useRef, useState, useEffect } from 'react';

interface UseCoinDragOptions {
  holdMs?: number;
  onActivate?: () => void;
  onComboComplete?: () => void;
}

// The secret flip sequence: Up 1x, Down 4x, Up 5x
const COMBO_PATTERN = [
  { direction: 'up' as const, count: 1 },
  { direction: 'down' as const, count: 4 },
  { direction: 'up' as const, count: 5 },
];

const GESTURE_THRESHOLD = 18;
const COMBO_TIMEOUT = 8000;

export function useCoinDrag({ holdMs = 5000, onActivate, onComboComplete }: UseCoinDragOptions) {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [wasActivated, setWasActivated] = useState(false);
  const [comboProgress, setComboProgress] = useState(0);

  const startY = useRef(0);
  const rotationRef = useRef(0);
  const isDraggingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activatedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Combo lock state
  const comboStepRef = useRef(0);
  const comboCountRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCombo = useCallback(() => {
    comboStepRef.current = 0;
    comboCountRef.current = 0;
    setComboProgress(0);
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
    }
  }, []);

  const recordGesture = useCallback(
    (direction: 'up' | 'down') => {
      const step = COMBO_PATTERN[comboStepRef.current];
      if (!step) return;

      if (step.direction !== direction) {
        resetCombo();
        return;
      }

      comboCountRef.current++;

      if (comboCountRef.current >= step.count) {
        comboStepRef.current++;
        comboCountRef.current = 0;
        setComboProgress(comboStepRef.current);

        if (comboStepRef.current >= COMBO_PATTERN.length) {
          resetCombo();
          onComboComplete?.();
          return;
        }
      }

      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        resetCombo();
      }, COMBO_TIMEOUT);
    },
    [onComboComplete, resetCombo]
  );

  const springTo = useCallback((target: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    let pos = rotationRef.current;
    let velocity = 0;
    const spring = 0.08;
    const damping = 0.85;

    const animate = () => {
      const force = (target - pos) * spring;
      velocity += force;
      velocity *= damping;
      pos += velocity;

      rotationRef.current = pos;
      setRotation(pos);

      if (Math.abs(target - pos) < 0.05 && Math.abs(velocity) < 0.05) {
        rotationRef.current = target;
        setRotation(target);
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const start = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }

      isDraggingRef.current = true;
      setIsDragging(true);
      startY.current = e.clientY;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Start hold timer - coin will glow red after holdMs
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        activatedRef.current = true;
        setWasActivated(true);
        onActivate?.();
      }, holdMs);

      rotationRef.current = 0;
      setRotation(0);
    },
    [holdMs, onActivate]
  );

  const move = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    const deltaY = startY.current - e.clientY;
    rotationRef.current = deltaY * 0.8;

    // Only show visual rotation if activated (hold complete)
    if (activatedRef.current) {
      setRotation(rotationRef.current);
    }
  }, []);

  const end = useCallback(
    (e?: React.PointerEvent) => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      setIsDragging(false);

      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      try {
        if (e) {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        }
      } catch {
        // ignore
      }

      // Clear hold timer on release
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      // Record gesture direction for combo lock (always active)
      const netDelta = startY.current - (e?.clientY ?? startY.current);
      if (Math.abs(netDelta) >= GESTURE_THRESHOLD) {
        const direction = netDelta > 0 ? 'up' : 'down';
        recordGesture(direction);
      }

      // Spring back only if activated (hold completed)
      if (activatedRef.current) {
        springTo(0);
      }
    },
    [recordGesture, springTo]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, []);

  return {
    rotation,
    isDragging,
    wasActivated,
    comboProgress,
    handlers: {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
