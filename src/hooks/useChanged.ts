import { useEffect, useRef, useState } from "react";

/**
 * True for a moment after a value changes — never on the first render.
 *
 * Lets a figure announce that it moved without the page announcing itself:
 * opening a screen is not news, a bankroll that just went up is. Never firing
 * on mount also keeps it honest in a test, where the final number is on
 * screen from the first paint.
 */
export function useChanged(value: unknown, forMs = 900): boolean {
  const previous = useRef(value);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setChanged(true);

    const timer = window.setTimeout(() => setChanged(false), forMs);
    return () => window.clearTimeout(timer);
  }, [value, forMs]);

  return changed;
}
