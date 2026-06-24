import { cn } from "@/lib/utils";
import { riskBand } from "@/types/domain";

const BAND_COLOR: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--destructive)",
};

const BAND_LABEL: Record<string, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

interface RiskGaugeProps {
  score: number;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function RiskGauge({ score, size = 96, showLabel = true, className }: RiskGaugeProps) {
  const band = riskBand(score);
  const color = BAND_COLOR[band];
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(score, 0), 100) / 100);
  const showSuffix = size >= 56;
  const numberFontSize = Math.max(10, Math.round(size * 0.26));
  const suffixFontSize = Math.max(8, Math.round(size * 0.11));

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-semibold tabular-nums" style={{ fontSize: numberFontSize }}>
            {Math.round(score)}
          </span>
          {showSuffix && (
            <span className="text-muted-foreground" style={{ fontSize: suffixFontSize }}>
              / 100
            </span>
          )}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {BAND_LABEL[band]}
        </span>
      )}
    </div>
  );
}
