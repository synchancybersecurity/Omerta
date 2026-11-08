import { useCallback, useEffect, useRef, useState } from "react";

interface UseCoinDragOptions {
  holdMs?: number;
  onActivate?: () => void;
  onComboComplete?: () => void;
}

// After the red glow: one flip up, four down, five up.
const COMBO_PATTERN = [
  { direction: "up" as const, count: 1 },
  { direction: "down" as const, count: 4 },
  { direction: "up" as const, count: 5 },
];

const FLICK_THRESHOLD = 22;
const COMBO_TIMEOUT = 12000;

export function useCoinDrag({ holdMs = 5000, onActivate, onComboComplete }: UseCoinDragOptions) {
  const [rotation, setRotation] = useState(0);
  const [wasActivated, setWasActivated] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);

  const startY = useRef(0);
  const lastY = useRef(0);
  const rotationRef = useRef(0);
  const holdingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activatedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const comboStepRef = useRef(0);
  const comboCountRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivateRef = useRef(onActivate);
  const onComboRef = useRef(onComboComplete);
  onActivateRef.current = onActivate;
  onComboRef.current = onComboComplete;

  const resetCombo = useCallback(() => {
    comboStepRef.current = 0;
    comboCountRef.current = 0;
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
    }
  }, []);

  const recordGesture = useCallback(
    (direction: "up" | "down") => {
      if (!activatedRef.current) return;
      const step = COMBO_PATTERN[comboStepRef.current];
      if (!step) return;
      if (step.direction !== direction) {
        resetCombo();
        return;
      }
      comboCountRef.current += 1;
      if (comboCountRef.current >= step.count) {
        comboStepRef.current += 1;
        comboCountRef.current = 0;
        if (comboStepRef.current >= COMBO_PATTERN.length) {
          resetCombo();
          onComboRef.current?.();
          return;
        }
      }
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(resetCombo, COMBO_TIMEOUT);
    },
    [resetCombo],
  );

  const spin = useCallback((delta: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = rotationRef.current;
    const started = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / 460);
      const eased = 1 - Math.pow(1 - t, 3);
      const pos = from + delta * eased;
      rotationRef.current = pos;
      setRotation(pos);
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const clearHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const begin = useCallback(
    (clientY: number) => {
      holdingRef.current = true;
      startY.current = clientY;
      lastY.current = clientY;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearHold();
      if (!activatedRef.current) {
        holdTimerRef.current = setTimeout(() => {
          activatedRef.current = true;
          setWasActivated(true);
          onActivateRef.current?.();
        }, holdMs);
      }
    },
    [clearHold, holdMs],
  );

  const drag = useCallback(
    (clientY: number) => {
      if (!holdingRef.current) return;
      lastY.current = clientY;
      const delta = startY.current - clientY;
      if (!activatedRef.current) {
        if (Math.abs(delta) > 28) clearHold();
        return;
      }
      rotationRef.current = delta * 0.9;
      setRotation(rotationRef.current);
    },
    [clearHold],
  );

  const finish = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    clearHold();
    const net = startY.current - lastY.current;
    if (activatedRef.current && Math.abs(net) >= FLICK_THRESHOLD) {
      const direction = net > 0 ? "up" : "down";
      spin(direction === "up" ? -360 : 360);
      recordGesture(direction);
      return;
    }
    if (activatedRef.current) spin(-(rotationRef.current % 360));
  }, [clearHold, recordGesture, spin]);

  const beginRef = useRef(begin);
  const dragRef = useRef(drag);
  const finishRef = useRef(finish);
  beginRef.current = begin;
  dragRef.current = drag;
  finishRef.current = finish;

  const ref = useCallback((node: HTMLElement | null) => {
    const prev = nodeRef.current as (HTMLElement & { __coinCleanup?: () => void }) | null;
    prev?.__coinCleanup?.();
    nodeRef.current = node;
    if (!node) return;
    const el = node as HTMLElement & { __coinCleanup?: () => void };

    let lastTouch = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      lastTouch = Date.now();
      beginRef.current(e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!holdingRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      dragRef.current(e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches[0]) lastY.current = e.changedTouches[0].clientY;
      finishRef.current();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (Date.now() - lastTouch < 800) return;
      e.preventDefault();
      beginRef.current(e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!holdingRef.current) return;
      dragRef.current(e.clientY);
    };
    const onMouseUp = () => finishRef.current();

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    el.__coinCleanup = () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      const el = nodeRef.current as (HTMLElement & { __coinCleanup?: () => void }) | null;
      el?.__coinCleanup?.();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearHold();
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, [clearHold]);

  return { rotation, wasActivated, ref };
}
