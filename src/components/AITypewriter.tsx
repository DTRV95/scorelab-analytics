import { useEffect, useMemo, useRef, useState } from "react";

interface AITypewriterProps {
  text: string;
  speed?: number;
  startDelay?: number;
  className?: string;
}

export function AITypewriter({
  text,
  speed = 14,
  startDelay = 0,
  className,
}: AITypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const hasAnimatedRef = useRef(false);

  const normalizedText = useMemo(() => text ?? "", [text]);

  useEffect(() => {
    if (!normalizedText) return;

    if (hasAnimatedRef.current) {
      setDisplayed(normalizedText);
      return;
    }

    setDisplayed("");

    let intervalId: number | undefined;
    let index = 0;

    const startTyping = () => {
      intervalId = window.setInterval(() => {
        index += 1;
        setDisplayed(normalizedText.slice(0, index));

        if (index >= normalizedText.length && intervalId) {
          hasAnimatedRef.current = true;
          window.clearInterval(intervalId);
        }
      }, speed);
    };

    const timeoutId = window.setTimeout(() => {
      startTyping();
    }, startDelay);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [normalizedText, speed, startDelay]);

  return <span className={className}>{displayed}</span>;
}
