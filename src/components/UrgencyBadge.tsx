import { cn } from "@/lib/utils";
import { Flame, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export type Urgency = "critical" | "high" | "medium" | "low";

const config: Record<Urgency, { label: string; cls: string; Icon: typeof Flame }> = {
  critical: {
    label: "Critical",
    cls: "bg-urgent-critical/15 text-urgent-critical ring-1 ring-urgent-critical/30",
    Icon: Flame,
  },
  high: {
    label: "High",
    cls: "bg-urgent-high/15 text-urgent-high ring-1 ring-urgent-high/30",
    Icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    cls: "bg-urgent-medium/15 text-urgent-medium ring-1 ring-urgent-medium/30",
    Icon: Clock,
  },
  low: {
    label: "Fresh",
    cls: "bg-urgent-low/15 text-urgent-low ring-1 ring-urgent-low/30",
    Icon: CheckCircle2,
  },
};

interface Props {
  urgency: Urgency;
  timeLeft?: string;
  className?: string;
  pulse?: boolean;
}

export const UrgencyBadge = ({ urgency, timeLeft, className, pulse }: Props) => {
  const { label, cls, Icon } = config[urgency];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        cls,
        pulse && urgency === "critical" && "animate-pulse-urgent",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {timeLeft && <span className="opacity-80">· {timeLeft}</span>}
    </span>
  );
};
