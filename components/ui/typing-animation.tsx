"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypingAnimationProps {
  text: string;
  className?: string;
  duration?: number;
  cursorClassName?: string;
}

export function TypingAnimation({
  text,
  className,
  duration = 100,
  cursorClassName,
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let currentIndex = 0;
    setDisplayedText("");
    setIsTyping(true);

    const intervalId = setInterval(() => {
      if (currentIndex < text.length) {
        // Use functional state update correctly to avoid stale state issues
        // But simply using text.charAt(currentIndex) is safer than text[currentIndex] 
        // inside a closure if currentIndex wasn't tracked via ref, 
        // though here it is a local variable in useEffect.
        // The issue "undefined" usually happens if index goes out of bounds.
        
        const char = text.charAt(currentIndex);
        setDisplayedText((prev) => prev + char);
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);
      }
    }, duration);

    return () => clearInterval(intervalId);
  }, [text, duration]);

  return (
    <span className={cn("inline-block", className)}>
      {displayedText}
      <span
        className={cn(
          "inline-block w-[3px] h-[1em] translate-y-[0.1em] bg-current ml-1 animate-blink",
          !isTyping && "opacity-0", 
          cursorClassName
        )}
      />
    </span>
  );
}
