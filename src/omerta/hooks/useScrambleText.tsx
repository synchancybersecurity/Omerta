import { useState, useEffect, useCallback } from 'react';

const CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789';

export function useScrambleText(targetText: string, trigger: boolean, speed = 30) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!trigger) {
      setDisplayText('');
      setIsComplete(false);
      return;
    }

    let index = 0;
    const total = targetText.length;
    setIsComplete(false);

    const interval = setInterval(() => {
      let result = '';
      for (let i = 0; i < total; i++) {
        if (i < index) {
          result += targetText[i];
        } else if (targetText[i] === ' ') {
          result += ' ';
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      setDisplayText(result);

      if (index >= total) {
        setDisplayText(targetText);
        setIsComplete(true);
        clearInterval(interval);
        return;
      }

      index += 1;
    }, speed);

    return () => clearInterval(interval);
  }, [trigger, targetText, speed]);

  return { displayText, isComplete };
}

export function ScrambleText({
  text,
  trigger,
  className = '',
  speed = 30,
}: {
  text: string;
  trigger: boolean;
  className?: string;
  speed?: number;
}) {
  const { displayText } = useScrambleText(text, trigger, speed);
  return <span className={className}>{displayText}</span>;
}

export function GlitchText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(text);
  const [isGlitching, setIsGlitching] = useState(false);

  const glitch = useCallback(() => {
    if (isGlitching) return;
    setIsGlitching(true);
    let count = 0;
    const max = 6;
    const interval = setInterval(() => {
      count++;
      if (count >= max) {
        setDisplay(text);
        setIsGlitching(false);
        clearInterval(interval);
        return;
      }
      let g = '';
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') {
          g += ' ';
        } else if (Math.random() < 0.4) {
          g += CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          g += text[i];
        }
      }
      setDisplay(g);
    }, 40);
  }, [text, isGlitching]);

  return (
    <span className={className} onMouseEnter={glitch}>
      {display}
    </span>
  );
}
