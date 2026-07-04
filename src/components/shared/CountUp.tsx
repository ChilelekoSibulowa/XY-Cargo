import { useEffect, useState, useRef } from "react";

interface CountUpProps {
  end: string;
  duration?: number;
}

export const CountUp = ({ end, duration = 1500 }: CountUpProps) => {
  const [count, setCount] = useState("");
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animate();
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [end]);

  const animate = () => {
    const isSpecialTime = end === "24/7";
    if (isSpecialTime) {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = progress * (2 - progress); // easeOutQuad
        const current24 = Math.floor(easeProgress * 24);
        const current7 = Math.floor(easeProgress * 7);
        setCount(`${current24}/${current7}`);
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setCount(end);
        }
      };
      window.requestAnimationFrame(step);
      return;
    }

    const numberRegex = /([\d,.]+)/;
    const match = end.match(numberRegex);
    if (!match) {
      setCount(end);
      return;
    }

    const rawNumberStr = match[1];
    const suffix = end.replace(rawNumberStr, "");
    const targetValue = parseFloat(rawNumberStr.replace(/,/g, ""));
    const isDecimal = rawNumberStr.includes(".");
    const decimalPlaces = isDecimal ? rawNumberStr.split(".")[1].length : 0;
    const hasCommas = rawNumberStr.includes(",");

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
      const currentValue = targetValue * easeProgress;
      
      let formattedValue = currentValue.toFixed(decimalPlaces);
      if (hasCommas) {
        const parts = formattedValue.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\n))/g, ",");
        formattedValue = parts.join(".");
      }
      
      setCount(`${formattedValue}${suffix}`);
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    
    window.requestAnimationFrame(step);
  };

  return <span ref={elementRef} className="tabular-nums">{count || "0"}</span>;
};
