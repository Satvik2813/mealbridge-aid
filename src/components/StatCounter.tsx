import { useEffect, useRef, useState } from "react";

interface Props {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export const StatCounter = ({ to, duration = 1800, prefix = "", suffix = "" }: Props) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (t: number) => {
              const p = Math.min((t - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(Math.round(to * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {val.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
};
