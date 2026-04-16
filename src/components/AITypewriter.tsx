import { useEffect, useMemo, useState } from "react";

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

  const normalizedText = useMemo(() => text ?? "", [text]);

  useEffect(() => {
    setDisplayed("");

    if (!normalizedText) return;

    let intervalId: number | undefined;
    let index = 0;

    const startTyping = () => {
      intervalId = window.setInterval(() => {
        index += 1;
        setDisplayed(normalizedText.slice(0, index));

        if (index >= normalizedText.length && intervalId) {
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
