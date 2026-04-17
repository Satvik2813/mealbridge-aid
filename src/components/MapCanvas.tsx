import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  height?: number;
  showRoute?: boolean;
  pins?: { x: number; y: number; color?: string; pulse?: boolean }[];
}

/**
 * Stylised "map" placeholder used in prototype dashboards.
 * Renders an SVG city grid with food pins. Can be replaced with
 * Google Maps JS later — keeps the same prop surface for swap-in.
 */
export const MapCanvas = ({
  className,
  height = 380,
  showRoute = false,
  pins = [
    { x: 28, y: 38, color: "hsl(var(--urgent-critical))", pulse: true },
    { x: 55, y: 30, color: "hsl(var(--urgent-high))" },
    { x: 70, y: 58, color: "hsl(var(--urgent-medium))" },
    { x: 38, y: 70, color: "hsl(var(--urgent-low))" },
    { x: 82, y: 42, color: "hsl(var(--primary))" },
  ],
}: Props) => {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl ring-1 ring-border bg-[hsl(var(--muted))]",
        className
      )}
      style={{ height }}
    >
      {/* Soft gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(142_30%_88%)] via-[hsl(38_44%_94%)] to-[hsl(38_60%_88%)]" />
      {/* Street grid */}
      <svg
        className="absolute inset-0 h-full w-full opacity-50"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="hsl(30 18% 78%)" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        {/* Major roads */}
        <path d="M0 50 L100 50" stroke="hsl(30 18% 70%)" strokeWidth="1.2" />
        <path d="M50 0 L50 100" stroke="hsl(30 18% 70%)" strokeWidth="1.2" />
        <path d="M0 20 Q40 35 100 25" stroke="hsl(30 18% 75%)" strokeWidth="0.8" fill="none" />
        <path d="M0 80 Q60 65 100 75" stroke="hsl(30 18% 75%)" strokeWidth="0.8" fill="none" />
        {/* Lake */}
        <ellipse cx="22" cy="62" rx="10" ry="6" fill="hsl(200 50% 80% / 0.6)" />

        {showRoute && (
          <path
            d="M 18 78 Q 35 60 50 50 T 82 22"
            stroke="hsl(var(--primary))"
            strokeWidth="1.4"
            strokeDasharray="2 1.5"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Pins */}
      {pins.map((p, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          <div
            className={cn(
              "relative h-7 w-7 rounded-full ring-2 ring-white shadow-warm",
              p.pulse && "animate-pulse-urgent"
            )}
            style={{ backgroundColor: p.color }}
          />
          <div
            className="mx-auto h-2 w-2 -translate-y-1 rotate-45 ring-2 ring-white"
            style={{ backgroundColor: p.color }}
          />
        </div>
      ))}

      {/* Attribution corner */}
      <div className="absolute bottom-2 right-3 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur">
        FeedLoop live map · Hyderabad
      </div>
    </div>
  );
};
